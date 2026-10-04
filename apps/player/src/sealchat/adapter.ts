// 仅使用官方 Channel Embed SDK；不访问宿主内部 API。
import { emptyRollData, rollCommand, type RollData, type RollRequest } from "./roll.ts";
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
function supportsCardType(type: string): boolean { return ["", "daggerheart", "dh"].includes(type); }
function bindingBlocker(context: EmbedContext, card: EmbedCard): string | null {
  if (!context.currentUser?.id) return "请先登录 SealChat。";
  if (context.connection.state !== "connected") return "SealChat 未连接，请重连后再关联。";
  if (!context.permissions.canSendMessage) return "当前身份没有发送权限，请确认已加入频道且未处于旁观模式。";
  if (!supportsCardType(card.sheetType)) return "Dice 当前人物卡类型为 " + card.sheetType + "；请切换到匕首之心人物卡后关联。";
  return null;
}
function remoteKey(context: EmbedContext, card: EmbedCard): string {
  // 官方返回值没有稳定 Dice 卡 ID，只能关联当前账号、频道、身份、卡名及卡类型。
  // 空卡经官方 .st 格式化为 DH 类型属于同一次关联；已有其他规则卡仍拒绝。
  return JSON.stringify([contextKey(context), card.name, supportsCardType(card.sheetType) ? "daggerheart" : card.sheetType]);
}

export interface PlayerSnapshot { key: string; documentId: string; name: string; resources: Resources; rolls: RollData }
export interface PlayerSource { read(): PlayerSnapshot | null; applyResources(resources: Partial<Resources>, key: string): void }
export interface SyncState {
  phase: "connecting" | "ready" | "binding" | "bound" | "closed" | "error";
  cardName: string; resources: Resources; rolls: RollData; bindingToken: string; busy: boolean; canBind: boolean; message: string;
}
export const sourceField = "DHPbDH来源";
export const nameField = "DHPbDH姓名";
const same = (a: ResourceValue | null | undefined, b: ResourceValue | null | undefined) => a?.current === b?.current && a?.max === b?.max;
type Pending = { expected: Partial<Record<ResourceId, Partial<ResourceValue>>>; source: PlayerSnapshot; initialize: boolean; started: number };
export class SealChatSync {
  state: SyncState = { phase: "connecting", cardName: "", resources: emptyResources(), rolls: emptyRollData(), bindingToken: "", busy: false, canBind: false, message: "正在连接 SealChat…" };
  private epoch = 0;
  private boundKey: string | null = null;
  private remote: { context: EmbedContext; card: EmbedCard } | null = null;
  private reading: Promise<void> | null = null;
  private refreshQueued = false;
  private connected = false;
  private authorized = false;
  private stopped = false;
  private sending = false;
  private mirror: Resources | null = null;
  private pending: Pending | null = null;
  private cleanups: Array<() => void> = [];
  constructor(private client: EmbedClient, private localKey: string, private changed: (state: SyncState) => void, private source: PlayerSource) {}
  private publish(patch: Partial<SyncState>) {
    if (this.stopped) return;
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  private snapshot() { const s = this.source.read(); return s?.key === this.localKey ? s : null; }
  private unbind(message: string) {
    this.epoch++; this.boundKey = null; this.remote = null; this.mirror = null; this.pending = null;
    this.publish({ phase: "ready", resources: emptyResources(), bindingToken: "", busy: this.sending, canBind: false, message });
  }
  async start() {
    const missing = ["context.read", "characters.read", "characterCard.read", "messages.send"].filter(cap => !this.client.capabilities.includes(cap));
    if (missing.length) {
      this.publish({ phase: "error", message: "iForm 缺少 " + missing.join("、") + " 权限，请检查 Embed API 配置及频道发送权限。" }); return;
    }
    this.authorized = true;
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
      this.connected = false; this.unbind("SealChat 会话已结束，请重新连接。"); this.publish({ phase: "closed" });
    }));
    this.connected = (await this.client.connection.getState()).state === "connected";
    await this.refresh();
  }
  setLocalKey(key: string) {
    if (key === this.localKey) return;
    this.localKey = key; this.unbind("PbDH 人物已变化，请重新关联。"); void this.refresh();
  }
  private bindingToken() { return this.boundKey ? JSON.stringify([this.localKey, this.boundKey, this.epoch]) : ""; }
  private apply(resources: Resources, captured?: PlayerSnapshot) {
    if (Object.values(resources).some(v => !v || v.max !== null && v.current > v.max)) throw Error("Dice 资源缺失或越界，已停止同步；请核对后重新关联。");
    const now = this.snapshot();
    if (!now || !this.boundKey) return;
    const patch: Partial<Resources> = {};
    for (const id of Object.keys(resources) as ResourceId[]) {
      // 等待执行期间本地又改过的字段，留给下一轮同步，不能用旧结果覆盖。
      if (resources[id] && (!captured || same(now.resources[id], captured.resources[id]))) patch[id] = resources[id];
    }
    this.mirror = structuredClone(resources);
    this.source.applyResources(patch, this.localKey);
  }
  async refresh(): Promise<void> {
    if (this.stopped || !this.authorized || this.state.phase === "closed") return;
    this.refreshQueued = true;
    if (this.reading) return this.reading;
    this.reading = (async () => {
      while (this.refreshQueued && !this.stopped) {
        this.refreshQueued = false;
        const epoch = this.epoch;
        try {
          const source = this.snapshot();
          this.publish({ rolls: source?.rolls ?? emptyRollData() });
          if (!this.connected) { this.publish({ canBind: false, message: "SealChat 未连接。" }); continue; }
          const before = await this.client.context.get();
          const result = await this.client.characterCard.getCurrent();
          const after = await this.client.context.get();
          if (this.stopped || epoch !== this.epoch) continue;
          if (!this.snapshot() || contextKey(before) !== contextKey(after)) {
            this.unbind("读取期间人物或身份发生变化，请重新关联。"); continue;
          }
          if (!result.status.available || !result.card) { this.unbind(result.status.reason || "当前频道没有可用的 Dice 活动人物卡。"); continue; }
          const card = result.card;
          const blocker = bindingBlocker(after, card);
          const usable = blocker === null;
          const key = remoteKey(after, card);
          if (this.boundKey && this.boundKey !== key) this.unbind("Dice 活动人物卡已变化，请重新关联。");
          if (!usable && this.boundKey) this.unbind("当前卡类型、连接或权限不可用。");
          this.remote = { context: after, card };
          const current = this.snapshot()!;
          const resources = readResources(card.attrs);
          if (this.pending) {
            const p = this.pending;
            const confirmed = card.attrs[sourceField] === p.source.documentId && (!p.initialize || card.attrs[nameField] === p.source.name.trim()) && Object.entries(p.expected).every(([id, expected]) => {
              const actual = resources[id as ResourceId];
              return actual && Object.entries(expected).every(([property, value]) => actual[property as keyof ResourceValue] === value);
            });
            if (!confirmed) {
              if (Date.now() - p.started > 30_000) this.unbind("资源写入尚未确认，请查看聊天中的 Dice 回复后重新关联；尚未启用群规则时先发送 .set dh。不会自动重发。");
              continue;
            }
            this.pending = null; this.apply(resources, p.source); this.refreshQueued = true;
          } else if (this.boundKey) {
            if (card.attrs[sourceField] !== current.documentId) { this.unbind("Dice 的 PbDH 关联已变化，请重新关联。"); continue; }
            if (this.mirror) {
              const changes: Partial<Record<ResourceId, Partial<ResourceValue>>> = {};
              for (const id of Object.keys(resources) as ResourceId[]) {
                const local = current.resources[id], previous = this.mirror[id];
                if (local && previous && !same(local, previous)) {
                  const fields: Partial<ResourceValue> = {};
                  if (local.current !== previous.current) fields.current = local.current;
                  if (local.max !== previous.max && adjustableMaximum(id)) fields.max = local.max;
                  if (Object.keys(fields).length) changes[id] = fields;
                }
              }
              if (Object.keys(changes).length) { await this.writeResources(current, changes, false); continue; }
            }
            this.apply(resources);
          }
          this.publish({ phase: this.boundKey ? "bound" : "ready", cardName: this.boundKey ? current.name : card.name, canBind: usable,
            resources: this.boundKey ? resources : emptyResources(), bindingToken: this.bindingToken(), rolls: this.snapshot()?.rolls ?? emptyRollData(),
            busy: this.sending || !!this.pending,
            message: usable ? (this.boundKey ? "PbDH 保存人物；Dice 资源结果自动保存并沿用原有云同步。" : (card.sheetType === "" ? "Dice 当前卡未标记类型；可关联，Dice 会校验群规则。尚未启用时请先发送 .set dh。" : "关联时以当前 PbDH 存档初始化 Dice 资源。")) : blocker! });
        } catch (error) {
          if (epoch !== this.epoch || this.stopped) continue;
          this.unbind(error instanceof Error ? error.message : "人物卡读取失败。"); this.publish({ phase: "error" });
        }
      }
    })().finally(() => { this.reading = null; });
    return this.reading;
  }
  private async writeResources(source: PlayerSnapshot, expected: Pending["expected"], initialize: boolean) {
    if (!this.remote || !this.boundKey || this.pending) return;
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(source.documentId)) throw Error("PbDH 存档标识无效。");
    const epoch = this.epoch;
    const parts: string[] = [];
    const values: Record<string, number> = {};
    for (const [id, fields] of Object.entries(expected) as Array<[ResourceId, Partial<ResourceValue>]>) {
      const field = adjustableMaximum(id) ? resourceFields[id] : goldFields[id];
      if (fields.current !== undefined) { parts.push(field.attr + "=" + fields.current); values[field.attr] = fields.current; }
      if (fields.max !== undefined && adjustableMaximum(id)) { parts.push(resourceFields[id].max + "=" + fields.max); values[resourceFields[id].max] = fields.max!; }
    }
    if (!parts.length) return;
    if (initialize && (!source.name.trim() || source.name.length > 100 || /[\u0000-\u001f\u007f]/.test(source.name))) throw Error("PbDH 人物姓名无效，请先检查姓名。");
    const text = initialize ? ".dh pbdh " + encodeURIComponent(JSON.stringify({ source: source.documentId, name: source.name.trim(), values })) : ".st " + parts.join(" ");
    this.pending = { expected, source: structuredClone(source), initialize, started: Date.now() };
    this.publish({ phase: "binding", cardName: this.remote.card.name, busy: true, canBind: false, message: initialize ? "正在用 PbDH 初始化资源，等待 Dice 确认…" : "正在同步 PbDH 的资源修改…" });
    try {
      await this.client.messages.send({ text, ...(this.remote.context.currentCharacter ? { identityId: this.remote.context.currentCharacter.id } : {}), icMode: "ooc" });
      if (epoch === this.epoch && !this.stopped) this.refreshQueued = true;
    } catch { if (epoch === this.epoch) { this.unbind("资源请求结果未知，请核对聊天后重新关联；不会自动重发。"); this.publish({ phase: "error" }); } }
  }
  async bind() {
    if (this.state.busy) return;
    const epoch = this.epoch; await this.refresh();
    const source = this.snapshot();
    if (epoch !== this.epoch || !source || !this.remote || !this.state.canBind || this.stopped) return;
    if (Object.values(source.resources).some(value => !value || value.max !== null && value.current > value.max)) { this.publish({ message: "请检查 PbDH 的资源当前值与上限。" }); return; }
    this.boundKey = remoteKey(this.remote.context, this.remote.card);
    const expected = Object.fromEntries(Object.entries(source.resources).map(([id, value]) => [id, { current: value!.current, ...(adjustableMaximum(id as ResourceId) ? { max: value!.max } : {}) }]));
    try { await this.writeResources(source, expected, true); await this.refresh(); }
    catch (error) { this.unbind(error instanceof Error ? error.message : "关联数据无效。"); this.publish({ phase: "error" }); }
  }
  pause() { this.unbind("同步已暂停，请重新确认关联。"); }
  async sendBound(build: () => string | null, expectedBinding = this.bindingToken()): Promise<boolean> {
    if (this.state.busy || this.state.phase !== "bound" || !this.boundKey || !this.connected || expectedBinding !== this.bindingToken()) return false;
    const key = this.boundKey, epoch = this.epoch;
    this.sending = true; this.publish({ busy: true });
    try {
      await this.refresh();
      if (this.stopped || epoch !== this.epoch || key !== this.boundKey || !this.remote || this.pending || this.state.phase !== "bound") return false;
      let text: string | null;
      try { text = build(); } catch (error) { this.publish({ message: error instanceof Error ? error.message : "选项无效。" }); return false; }
      if (!text) return false;
      await this.client.messages.send({ text, ...(this.remote.context.currentCharacter ? { identityId: this.remote.context.currentCharacter.id } : {}), icMode: "ooc" });
      if (epoch === this.epoch) this.publish({ message: "已发送，请在聊天查看结果；资源等待 Dice 回读后自动保存。" });
      await this.refresh(); return epoch === this.epoch && !this.stopped;
    } catch {
      if (epoch === this.epoch) { this.unbind("请求结果未知，请核对聊天后重新关联；不会自动重发。"); this.publish({ phase: "error" }); }
      return false;
    } finally { this.sending = false; this.publish({ busy: !!this.pending }); }
  }
  roll(request: RollRequest, expectedBinding?: string) {
    return this.sendBound(() => { const source = this.snapshot(); return source ? rollCommand(request, source.rolls, this.state.resources.hope?.current ?? null, source.documentId) : null; }, expectedBinding);
  }
  change(id: ResourceId, delta: number, expectedBinding?: string) {
    return this.sendBound(() => {
      if (![1, -1].includes(delta) || !resourceId(id)) return null;
      const value = this.state.resources[id];
      if (!value || value.current + delta < 0 || delta > 0 && value.current + delta > (value.max ?? 1_000_000)) return null;
      const attr = adjustableMaximum(id) ? resourceFields[id].attr : goldFields[id].attr;
      return ".st " + attr + (delta > 0 ? "+" : "-") + "1";
    }, expectedBinding);
  }
  changeMax(id: ResourceId, delta: number, expectedBinding?: string) {
    return this.sendBound(() => {
      if (!adjustableMaximum(id) || ![1, -1].includes(delta)) return null;
      const value = this.state.resources[id];
      if (!value || value.max === null || value.max + delta < value.current || value.max + delta < 0 || value.max + delta > 60) return null;
      return ".st " + resourceFields[id].max + (delta > 0 ? "+" : "-") + "1";
    }, expectedBinding);
  }
  stop() { this.stopped = true; this.epoch++; this.cleanups.splice(0).forEach(off => off()); this.client.close(); }
}
