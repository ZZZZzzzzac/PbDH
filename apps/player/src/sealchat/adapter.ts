// 仅描述已核对的 SealChat 7a7b5bb Embed SDK 子集；SDK 由宿主加载。
import { readNumbers, numberFields, type NumberId, type Numbers } from "./numbers.ts";
import { readDiceData, rollCommand, type DiceData, type RollRequest } from "./roll.ts";
export interface EmbedContext {
  channel: { id: string };
  currentUser: { id: string } | null;
  currentCharacter: { id: string; name?: string } | null;
  connection: { state: string };
  permissions: { canSendMessage: boolean };
}

export interface EmbedCard {
  name: string;
  sheetType: string;
  attrs: Record<string, unknown>;
}

export interface EmbedClient {
  capabilities: readonly string[];
  context: { get(): Promise<EmbedContext>; onChanged(cb: (context: EmbedContext) => void): () => void };
  connection: { getState(): Promise<{ state: string }>; onChanged(cb: (state: { state: string }) => void): () => void };
  characterCard: { getCurrent(): Promise<{ status: { available: boolean; reason?: string }; card: EmbedCard | null }> };
  messages: { send(options: { text: string; identityId?: string; icMode: "ooc" }): Promise<unknown> };
  session: { onClosed(cb: () => void): () => void };
  close(): void;
}

export const daggerheartSystemId = "01a0132c-4eef-7703-94ac-ec8d1a660001";
export const resourceFields = {
  hp: { attr: "生命", max: "生命上限", alias: "hp", maxAlias: "hpMax" },
  stress: { attr: "压力", max: "压力上限", alias: "stress", maxAlias: "stressMax" },
  "armor-slots": { attr: "护甲", max: "护甲上限", alias: "armor", maxAlias: "armorMax" },
  hope: { attr: "希望", max: "希望上限", alias: "hope", maxAlias: "hopeMax" },
} as const;
export const goldFields = {
  "handful-gold": { attr: "金币把", max: 9 },
  "bag-gold": { attr: "金币袋", max: 9 },
  "chest-gold": { attr: "金币箱", max: null },
} as const;
export type ResourceId = keyof typeof resourceFields | keyof typeof goldFields;
export function adjustableMaximum(id: ResourceId): id is keyof typeof resourceFields { return Object.hasOwn(resourceFields, id); }
export interface ResourceValue { current: number; max: number | null }
export type Resources = Record<ResourceId, ResourceValue | null>;
export const emptyResources = (): Resources => ({ hp: null, stress: null, "armor-slots": null, hope: null, "handful-gold": null, "bag-gold": null, "chest-gold": null });

export function resourceId(id: string): ResourceId | null {
  return (Object.hasOwn(resourceFields, id) || Object.hasOwn(goldFields, id)) ? id as ResourceId : null;
}

function integer(value: unknown): number | null {
  if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function readResources(attrs: Record<string, unknown>): Resources {
  const result = emptyResources();
  for (const id of Object.keys(resourceFields) as Array<keyof typeof resourceFields>) {
    const field = resourceFields[id];
    const current = integer(Object.hasOwn(attrs, field.attr) ? attrs[field.attr] : attrs[field.alias]);
    const max = integer(Object.hasOwn(attrs, field.max) ? attrs[field.max] : attrs[field.maxAlias]);
    // 防止坏数据生成无界标记；未知和明确的 0 保持不同。
    result[id] = current !== null && max !== null && current <= max && max <= 60 ? { current, max } : null;
  }
  for (const id of Object.keys(goldFields) as Array<keyof typeof goldFields>) {
    const field = goldFields[id];
    const current = integer(attrs[field.attr]);
    // 金币保留 PbDH 9/9/无上限的步进边界；外部较大值照实显示，仍可递减。
    result[id] = current !== null && current <= 1_000_000 ? { current, max: field.max } : null;
  }
  return result;
}

export interface EmbedConfig { hostOrigin: string; sdkUrl: string }
export function readEmbedConfig(href: string, embedded: boolean): EmbedConfig | null {
  const url = new URL(href);
  if (url.searchParams.get("sealchat") !== "1" || !embedded) return null;
  const host = new URL(url.searchParams.get("hostOrigin") ?? "");
  const sdk = new URL(url.searchParams.get("sdkUrl") ?? "");
  const local = host.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(host.hostname);
  if ((!local && host.protocol !== "https:") || host.origin !== host.href.replace(/\/$/, "")
      || host.username || host.password || sdk.origin !== host.origin || sdk.username || sdk.password
      || sdk.search || sdk.hash || !sdk.pathname.endsWith("/api/v1/channel-embed-sdk.js")) {
    throw new Error("SealChat 接入地址无效。");
  }
  return { hostOrigin: host.origin, sdkUrl: sdk.href };
}

function contextKey(context: EmbedContext): string {
  return JSON.stringify([context.channel.id, context.currentUser?.id, context.currentCharacter?.id]);
}
function remoteKey(context: EmbedContext, card: EmbedCard): string {
  // 官方返回值没有稳定 Dice 卡 ID，只能关联当前账号、频道、身份、卡名及卡类型。
  return JSON.stringify([contextKey(context), card.name, card.sheetType]);
}

export interface SyncState {
  phase: "connecting" | "ready" | "bound" | "closed" | "error";
  cardName: string;
  resources: Resources;
  numbers: Numbers;
  bindingToken: string;
  dice: DiceData;
  busy: boolean;
  canBind: boolean;
  message: string;
}

export class SealChatSync {
  state: SyncState = { phase: "connecting", cardName: "", resources: emptyResources(), numbers: readNumbers({}), bindingToken: "", dice: readDiceData({}), busy: false, canBind: false, message: "正在连接 SealChat…" };
  private localKey: string;
  private epoch = 0;
  private boundKey: string | null = null;
  private remote: { context: EmbedContext; card: EmbedCard } | null = null;
  private reading: Promise<void> | null = null;
  private refreshQueued = false;
  private connected = false;
  private stopped = false;
  private cleanups: Array<() => void> = [];

  constructor(private client: EmbedClient, localKey: string, private changed: (state: SyncState) => void) {
    this.localKey = localKey;
  }
  private publish(patch: Partial<SyncState>) {
    if (this.stopped) return;
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  private unbind(message: string) {
    this.epoch++;
    this.boundKey = null;
    this.remote = null;
    this.publish({ phase: "ready", resources: emptyResources(), numbers: readNumbers({}), bindingToken: "", dice: readDiceData({}), canBind: false, message });
  }
  async start() {
    if (!["context.read", "characterCard.read", "messages.send"].every(cap => this.client.capabilities.includes(cap))) {
      this.publish({ phase: "error", message: "iForm 缺少 context.read、characterCard.read 或 messages.send 权限。" });
      return;
    }
    this.cleanups.push(this.client.context.onChanged(context => {
      if (this.remote && contextKey(context) !== contextKey(this.remote.context)) this.unbind("SealChat 身份或频道已变化，请重新关联。");
      if (!context.permissions.canSendMessage) this.unbind("当前身份不能发送消息。");
      void this.refresh();
    }));
    this.cleanups.push(this.client.connection.onChanged(connection => {
      this.connected = connection.state === "connected";
      if (!this.connected) this.unbind("SealChat 已断线；恢复后请重新关联。");
      void this.refresh();
    }));
    this.cleanups.push(this.client.session.onClosed(() => {
      this.connected = false;
      this.unbind("SealChat 会话已结束，请重新连接。");
      this.publish({ phase: "closed" });
    }));
    this.connected = (await this.client.connection.getState()).state === "connected";
    await this.refresh();
  }
  setLocalKey(key: string) {
    if (key === this.localKey) return;
    this.localKey = key;
    this.unbind("PbDH 人物已变化，请重新关联。");
    void this.refresh();
  }
  async refresh(): Promise<void> {
    if (this.stopped || this.state.phase === "closed") return;
    this.refreshQueued = true;
    if (this.reading) return this.reading;
    this.reading = (async () => {
      while (this.refreshQueued && !this.stopped) {
        this.refreshQueued = false;
        const epoch = this.epoch;
        try {
          if (!this.connected) {
            this.publish({ canBind: false, message: "SealChat 未连接。" });
            continue;
          }
          const before = await this.client.context.get();
          const result = await this.client.characterCard.getCurrent();
          const after = await this.client.context.get();
          if (this.stopped || epoch !== this.epoch) continue;
          if (contextKey(before) !== contextKey(after)) {
            this.unbind("读取期间身份发生变化，请重新关联。");
            this.refreshQueued = true;
            continue;
          }
          if (!result.status.available || !result.card) {
            this.unbind(result.status.reason || "当前频道没有可用的 Dice 活动人物卡。");
            continue;
          }
          const card = result.card;
          const usable = ["daggerheart", "dh"].includes(card.sheetType) && !!after.currentUser?.id
            && after.permissions.canSendMessage && after.connection.state === "connected";
          const key = remoteKey(after, card);
          if (this.boundKey && this.boundKey !== key) this.unbind("Dice 活动人物卡已变化，请重新关联。");
          if (!usable && this.boundKey) this.unbind("当前卡类型、连接或权限不可用。");
          this.remote = { context: after, card };
          this.publish({ phase: this.boundKey ? "bound" : "ready", cardName: card.name, canBind: usable,
            resources: this.boundKey ? readResources(card.attrs) : emptyResources(),
            numbers: this.boundKey ? readNumbers(card.attrs) : readNumbers({}), bindingToken: this.bindingToken(),
            dice: this.boundKey ? readDiceData(card.attrs) : readDiceData({}),
            message: usable ? (this.boundKey ? "资源、金币与属性由 Dice 保存。" : "确认关联后使用 Dice 当前数值。") : "请启用匕首之心规则并确认发送权限。" });
        } catch (error) {
          if (epoch !== this.epoch || this.stopped) continue;
          this.unbind(error instanceof Error ? error.message : "人物卡读取失败。");
          this.publish({ phase: "error" });
        }
      }
    })().finally(() => { this.reading = null; });
    return this.reading;
  }
  async bind() {
    if (this.state.busy) return;
    const epoch = this.epoch;
    await this.refresh();
    if (epoch !== this.epoch || !this.remote || !this.state.canBind || this.stopped) return;
    this.boundKey = remoteKey(this.remote.context, this.remote.card);
    this.publish({ phase: "bound", resources: readResources(this.remote.card.attrs), numbers: readNumbers(this.remote.card.attrs), bindingToken: this.bindingToken(), dice: readDiceData(this.remote.card.attrs), message: "资源、金币与属性由 Dice 保存。" });
  }
  pause() { this.unbind("同步已暂停，请重新确认关联。"); }
  private bindingToken() { return this.boundKey ? JSON.stringify([this.localKey, this.boundKey, this.epoch]) : ""; }
  async sendBound(build: () => string | null, expectedBinding = this.bindingToken()): Promise<boolean> {
    if (this.state.busy || !this.boundKey || !this.connected || expectedBinding !== this.bindingToken()) return false;
    const key = this.boundKey;
    const epoch = this.epoch;
    this.publish({ busy: true });
    try {
      await this.refresh();
      if (this.stopped || epoch !== this.epoch || key !== this.boundKey || !this.remote) return false;
      let text: string | null;
      try { text = build(); }
      catch (error) { this.publish({ message: error instanceof Error ? error.message : "选项无效。" }); return false; }
      if (!text) return false;
      await this.client.messages.send({ text,
        ...(this.remote.context.currentCharacter ? { identityId: this.remote.context.currentCharacter.id } : {}), icMode: "ooc" });
      // 回执不证明 Dice 已执行；继续回读，不乐观修改，不自动重发。
      if (epoch === this.epoch) this.publish({ message: "已发送，请在聊天查看结果；数值等待 Dice 回读。" });
      await this.refresh();
      return epoch === this.epoch && !this.stopped;
    } catch {
      if (epoch === this.epoch) {
        this.unbind("请求结果未知，请核对聊天后重新关联；不会自动重发。");
        this.publish({ phase: "error" });
      }
      return false;
    } finally { this.publish({ busy: false }); }
  }
  roll(request: RollRequest, expectedBinding?: string) {
    return this.sendBound(() => rollCommand(request, this.state.dice, this.state.resources.hope?.current ?? null), expectedBinding);
  }
  change(id: ResourceId, delta: number, expectedBinding?: string) {
    return this.sendBound(() => {
      if (![1, -1].includes(delta) || !resourceId(id)) return null;
      const value = this.state.resources[id];
      if (!value || value.current + delta < 0 || (delta > 0 && value.current + delta > (value.max ?? 1_000_000))) return null;
      const attr = adjustableMaximum(id) ? resourceFields[id].attr : goldFields[id].attr;
      return `.st ${attr}${delta > 0 ? "+" : "-"}1`;
    }, expectedBinding);
  }
  changeMax(id: ResourceId, delta: number, expectedBinding?: string) {
    return this.sendBound(() => {
      if (!adjustableMaximum(id) || ![1, -1].includes(delta)) return null;
      const value = this.state.resources[id];
      if (!value || value.max === null || value.max + delta < value.current || value.max + delta < 0 || value.max + delta > 60) return null;
      return `.st ${resourceFields[id].max}${delta > 0 ? "+" : "-"}1`;
    }, expectedBinding);
  }
  setNumber(id: NumberId, value: string, expectedBinding?: string) {
    return this.sendBound(() => {
      const field = numberFields[id];
      if (!field || !/^[+-]?\d+$/.test(value.trim())) throw Error("请输入整数。");
      const next = Number(value);
      if (!Number.isSafeInteger(next) || next < field.min || next > field.max) throw Error("数值超出范围。");
      if (id === "armor-value" && next < (this.state.resources["armor-slots"]?.current ?? 0)) throw Error("护甲上限不能低于当前护甲槽。");
      if (this.state.numbers[id] === next) return null;
      return `.st ${field.attr}=${next}`;
    }, expectedBinding);
  }
  stop() {
    this.stopped = true;
    this.epoch++;
    this.cleanups.splice(0).forEach(off => off());
    this.client.close();
  }
}
