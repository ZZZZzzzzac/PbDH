// 仅描述已核对的 SealChat 7a7b5bb Embed SDK 子集；SDK 由宿主加载。
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
export type ResourceId = keyof typeof resourceFields;
export interface ResourceValue { current: number; max: number }
export type Resources = Record<ResourceId, ResourceValue | null>;
export const emptyResources = (): Resources => ({ hp: null, stress: null, "armor-slots": null, hope: null });

export function resourceId(id: string): ResourceId | null {
  return Object.hasOwn(resourceFields, id) ? id as ResourceId : null;
}

function integer(value: unknown): number | null {
  if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function readResources(attrs: Record<string, unknown>): Resources {
  const result = emptyResources();
  for (const id of Object.keys(resourceFields) as ResourceId[]) {
    const field = resourceFields[id];
    const current = integer(Object.hasOwn(attrs, field.attr) ? attrs[field.attr] : attrs[field.alias]);
    const max = integer(Object.hasOwn(attrs, field.max) ? attrs[field.max] : attrs[field.maxAlias]);
    // 防止坏数据生成无界标记；未知和明确的 0 保持不同。
    result[id] = current !== null && max !== null && current <= max && max <= 60 ? { current, max } : null;
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
  dice: DiceData;
  busy: boolean;
  canBind: boolean;
  message: string;
}

export class SealChatSync {
  state: SyncState = { phase: "connecting", cardName: "", resources: emptyResources(), dice: readDiceData({}), busy: false, canBind: false, message: "正在连接 SealChat…" };
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
    this.publish({ phase: "ready", resources: emptyResources(), dice: readDiceData({}), canBind: false, message });
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
            dice: this.boundKey ? readDiceData(card.attrs) : readDiceData({}),
            message: usable ? (this.boundKey ? "生命、压力、护甲、希望由 Dice 保存。" : "确认关联后，四项资源使用 Dice 当前值。") : "请启用匕首之心规则并确认发送权限。" });
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
    this.publish({ phase: "bound", resources: readResources(this.remote.card.attrs), dice: readDiceData(this.remote.card.attrs), message: "生命、压力、护甲、希望由 Dice 保存。" });
  }
  pause() { this.unbind("同步已暂停，请重新确认关联。"); }
  async roll(request: RollRequest): Promise<boolean> {
    if (this.state.busy || !this.boundKey || !this.connected) return false;
    const key = this.boundKey;
    const epoch = this.epoch;
    this.publish({ busy: true });
    try {
      await this.refresh();
      if (this.stopped || epoch !== this.epoch || key !== this.boundKey || !this.remote) return false;
      let text: string;
      try { text = rollCommand(request, this.state.dice, this.state.resources.hope?.current ?? null); }
      catch (error) { this.publish({ message: error instanceof Error ? error.message : "掷骰选项无效。" }); return false; }
      await this.client.messages.send({ text,
        ...(this.remote.context.currentCharacter ? { identityId: this.remote.context.currentCharacter.id } : {}), icMode: "ooc" });
      if (epoch === this.epoch) this.publish({ message: "已请求掷骰，请在聊天查看结果；资源等待 Dice 回读。" });
      await this.refresh();
      return epoch === this.epoch && !this.stopped;
    } catch {
      if (epoch === this.epoch) {
        this.unbind("掷骰请求结果未知，请核对聊天后重新关联；不会自动重发。");
        this.publish({ phase: "error" });
      }
      return false;
    } finally { this.publish({ busy: false }); }
  }
  async change(id: ResourceId, delta: number) {
    if (this.state.busy || !this.boundKey || !this.connected || ![1, -1].includes(delta)) return;
    const key = this.boundKey;
    const epoch = this.epoch;
    this.publish({ busy: true });
    try {
      await this.refresh();
      if (this.stopped || epoch !== this.epoch || key !== this.boundKey || !this.remote) return;
      const value = this.state.resources[id];
      if (!value || value.current + delta < 0 || value.current + delta > value.max) return;
      await this.client.messages.send({ text: `.st ${resourceFields[id].attr}${delta > 0 ? "+" : "-"}1`,
        ...(this.remote.context.currentCharacter ? { identityId: this.remote.context.currentCharacter.id } : {}), icMode: "ooc" });
      // 消息回执不证明 Dice 已执行；后续轮询继续读取，绝不自动重发。
      if (epoch === this.epoch) this.publish({ message: "已请求修改，等待 Dice 回读确认。" });
      await this.refresh();
    } catch {
      if (epoch === this.epoch) {
        this.unbind("请求结果未知，请核对聊天和当前资源后重新关联；不会自动重发。");
        this.publish({ phase: "error" });
      }
    } finally {
      this.publish({ busy: false });
    }
  }
  stop() {
    this.stopped = true;
    this.epoch++;
    this.cleanups.splice(0).forEach(off => off());
    this.client.close();
  }
}
