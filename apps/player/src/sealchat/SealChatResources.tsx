import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { daggerheartSystemId, emptyResources, readEmbedConfig, resourceId, adjustableMaximum, SealChatSync,
  type EmbedClient, type ResourceId, type SyncState, type PlayerSource, type Resources } from "./adapter.ts";
import "./sealchat.css";
import { emptyRollData, traitModules, type Trait } from "./roll.ts";
import { readPlayerSnapshot } from "./source.ts";
import { SealChatRollDialog } from "./SealChatRollDialog.tsx";
import { SealChatDamageDialog } from "./SealChatDamageDialog.tsx";
import { damageCommand, weaponIds, type WeaponId, type WeaponSnapshot } from "./damage.ts";
import { useRuntimeStore } from "../sheet-runtime/store/runtimeStore.ts";
import { readCountableState } from "../sheet-runtime/rendering/moduleState.ts";
export function readWeapon(id: WeaponId): WeaponSnapshot {
  const values = useRuntimeStore.getState().characterData?.character.values;
  return { id, text: typeof values?.[id] === "string" ? values[id] : "",
    proficiency: readCountableState(values?.proficiency, { current: 1, max: 6 }).current };
}
type RollSelection = { kind: "trait"; trait: Trait } | { kind: "weapon"; weapon: WeaponSnapshot };

interface EmbedSDK { connect(options: { targetOrigin: string; timeoutMs: number }): Promise<EmbedClient> }
type SDKWindow = Window & { SealChatEmbed?: EmbedSDK };

async function loadSDK(url: string): Promise<EmbedSDK> {
  const sdkWindow = window as SDKWindow;
  if (sdkWindow.SealChatEmbed) return sdkWindow.SealChatEmbed;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => { script.remove(); reject(new Error("SealChat SDK 加载超时。")); }, 10_000);
    script.src = url;
    script.onload = () => { window.clearTimeout(timer); resolve(); };
    script.onerror = () => { window.clearTimeout(timer); script.remove(); reject(new Error("SealChat SDK 加载失败。")); };
    document.head.append(script);
  });
  if (!sdkWindow.SealChatEmbed) throw new Error("SealChat SDK 不可用。");
  return sdkWindow.SealChatEmbed;
}

interface ResourceControl {
  state: SyncState;
  change(id: ResourceId, delta: number): void;
  changeMax?(id: ResourceId, delta: number): void;
  openRoll?(selection: RollSelection): void;
}
export const SealChatResourceContext = createContext<ResourceControl | null>(null);
export function useSealChatResource(moduleId: string) {
  const control = useContext(SealChatResourceContext);
  const id = resourceId(moduleId);
  if (!control || !id || !["bound", "binding"].includes(control.state.phase)) return null;
  return { value: control.state.resources[id], disabled: control.state.phase !== "bound" || control.state.busy,
    change: (delta: number) => control.change(id, delta),
    editableMax: adjustableMaximum(id), changeMax: (delta: number) => control.changeMax?.(id, delta) };
}

export function SealChatResources({ systemPackageId, characterId, characterName, visible, connectionRequest = 0, children }: {
  systemPackageId?: string; characterId?: string; characterName: string; visible: boolean; connectionRequest?: number; children: ReactNode;
}) {
  const [config] = useState(() => {
    try { return { value: readEmbedConfig(window.location.href, window.parent !== window), error: "" }; }
    catch (error) { return { value: null, error: error instanceof Error ? error.message : "接入配置无效。" }; }
  });
  const requested = !!config.value || !!config.error;
  const [panelVisible, setPanelVisible] = useState(requested);
  const handledConnectionRequest = useRef(0);
  const supported = systemPackageId === daggerheartSystemId;
  const localKey = JSON.stringify([systemPackageId, characterId]);
  const localKeyRef = useRef(localKey);
  localKeyRef.current = localKey;
  const syncRef = useRef<SealChatSync | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reconnectAfterStart = useRef(false);
  const [selection, setSelection] = useState<RollSelection | null>(null);
  const [state, setState] = useState<SyncState>({ phase: "connecting", cardName: "", resources: emptyResources(), bindingToken: "", rolls: emptyRollData(), busy: false, canBind: false, message: config.error || "正在连接 SealChat…" });

  useEffect(() => {
    if (!config.value || !visible || !supported || !characterId) return;
    const activeConfig = config.value;
    let stopped = false;
    let sync: SealChatSync | null = null;
    let timer: number | undefined;
    let unsubscribe: (() => void) | undefined;
    setState({ phase: "connecting", cardName: "", resources: emptyResources(), bindingToken: "", rolls: emptyRollData(), busy: false, canBind: false, message: "正在连接 SealChat…" });
    void (async () => {
      const sdk = await loadSDK(activeConfig.sdkUrl);
      if (stopped) return;
      const client = await sdk.connect({ targetOrigin: activeConfig.hostOrigin, timeoutMs: 10_000 });
      if (stopped) { client.close(); return; }
      const source: PlayerSource = {
        read: () => { const s = useRuntimeStore.getState(); return readPlayerSnapshot(s.characterData, s.currentPackage); },
        applyResources: (resources, key) => applyPlayerResources(resources, key),
      };
      sync = new SealChatSync(client, localKeyRef.current, next => { if (!stopped) setState(next); }, source);
      syncRef.current = sync;
      await sync.start();
      if (!stopped && reconnectAfterStart.current) { reconnectAfterStart.current = false; await sync.reconnect(); }
      if (!stopped) unsubscribe = useRuntimeStore.subscribe((next, previous) => {
        if (next.characterData === previous.characterData) return;
        const snapshot = readPlayerSnapshot(next.characterData, next.currentPackage);
        if (snapshot) sync?.setLocalKey(snapshot.key);
        void sync?.refresh();
      });
      if (!stopped) timer = window.setInterval(() => { void sync?.refresh(); }, 10_000);
    })().catch(error => {
      if (!stopped) setState({ phase: "error", cardName: "", resources: emptyResources(), bindingToken: "", rolls: emptyRollData(), busy: false, canBind: false,
        message: error instanceof Error ? error.message : "SealChat 连接失败。" });
    });
    return () => { stopped = true; window.clearInterval(timer); unsubscribe?.(); sync?.stop(); syncRef.current = null; };
  }, [attempt, config, supported, visible, !!characterId]);

  const requestConnection = useCallback(() => {
    setPanelVisible(true);
    if (!config.value || !supported) return;
    if (state.phase === "closed" || state.phase === "error" || !syncRef.current) {
      reconnectAfterStart.current = true; setAttempt(value => value + 1);
    } else if (state.phase === "bound") void syncRef.current.refresh();
    else void syncRef.current.reconnect();
  }, [config.value, supported, state.phase]);
  useEffect(() => {
    if (connectionRequest <= handledConnectionRequest.current) return;
    handledConnectionRequest.current = connectionRequest;
    requestConnection();
  }, [connectionRequest, requestConnection]);

  useEffect(() => { syncRef.current?.setLocalKey(localKey); }, [localKey]);
  useEffect(() => { setSelection(null); }, [localKey, visible]);
  useEffect(() => { if (state.phase !== "bound") setSelection(null); }, [state.phase]);
  const control = useMemo<ResourceControl | null>(() => requested && supported ? {
    state, change: (id, delta) => { void syncRef.current?.change(id, delta, state.bindingToken); },
    changeMax: (id, delta) => { void syncRef.current?.changeMax(id, delta, state.bindingToken); },
    openRoll: next => { if (visible && state.phase === "bound") { setSelection(next); void syncRef.current?.refresh(); } },
  } : null, [requested, supported, state, visible]);

  return <SealChatResourceContext.Provider value={control}>
    {panelVisible && visible ? <section className="sealchat-sync" aria-label="SealChat 资源同步">
      <strong>SealChat 同步（实验）</strong>
      <p role="status">{!requested ? "请从海豹聊天的 PbDH 嵌入人物卡打开此页面，再连接聊天。独立网页不能直接连接。" : !supported ? "此实验仅支持匕首之心核心系统包。" : config.error || state.message}</p>
      {supported && state.cardName ? <p>PbDH：{characterName || "未命名人物"} · Dice：{state.cardName}</p> : null}
      <div>
        {requested ? <>
        <button type="button" disabled={!supported || !state.canBind || state.busy || ["bound", "binding"].includes(state.phase)}
          onClick={() => { void syncRef.current?.bind(); }}>关联并使用 PbDH 资源</button>
        <button type="button" disabled={state.phase !== "bound" || state.busy} onClick={() => syncRef.current?.pause()}>暂停同步</button>
        <button type="button" disabled={!config.value || state.busy} onClick={requestConnection}>刷新 / 重连</button>
        </> : null}
        <button type="button" onClick={() => setPanelVisible(false)}>收起连接面板</button>
      </div>
    </section> : null}
    {children}
    {selection && state.phase === "bound" && visible ? selection.kind === "trait" ? <SealChatRollDialog trait={selection.trait} state={state}
      roll={request => syncRef.current?.roll(request, state.bindingToken) ?? Promise.resolve(false)} close={() => setSelection(null)} />
      : <SealChatDamageDialog weapon={selection.weapon} state={state}
        roll={request => syncRef.current?.sendBound(() => damageCommand(request, readWeapon(request.weapon.id)), state.bindingToken) ?? Promise.resolve(false)}
        close={() => setSelection(null)} /> : null}
  </SealChatResourceContext.Provider>;
}

export function sealChatWeaponHeadingId(element: Element): WeaponId | undefined {
  if (element.tagName !== "H3" || !element.classList.contains("equipment-slot-title")) return undefined;
  const modules = [...element.parentElement?.querySelectorAll("pb-module[id]") ?? []].map(module => module.getAttribute("id"));
  const weapons = weaponIds.filter(id => modules.includes(id));
  return weapons.length === 1 ? weapons[0] : undefined;
}
export function SealChatRollButton({ moduleId, placement = "trait" }: { moduleId: string; placement?: "trait" | "heading" }) {
  const control = useContext(SealChatResourceContext);
  const trait = traitModules[moduleId];
  const weapon = weaponIds.find(id => id === moduleId);
  if (!control || (!trait && !weapon)) return null;
  const label = trait ? trait + "掷骰" : (weapon === "primary-weapon-name" ? "主武器" : "副武器") + "伤害掷骰";
  return <button type="button" className={"sealchat-dice-button sealchat-dice-" + placement} aria-label={label} title={label}
    disabled={control.state.phase !== "bound"}
    onClick={() => control.openRoll?.(trait ? { kind: "trait", trait } : { kind: "weapon", weapon: readWeapon(weapon!) })}>
    <span aria-hidden="true">🎲</span>
  </button>;
}

// 复用正常字段更新入口：依赖计算、250ms 保存和云 outbox 都由原有 Runtime 负责。
export function applyPlayerResources(resources: Partial<Resources>, key: string): void {
  const store = useRuntimeStore.getState();
  const snapshot = readPlayerSnapshot(store.characterData, store.currentPackage);
  if (!snapshot || snapshot.key !== key) return;
  for (const [id, value] of Object.entries(resources)) {
    if (!value) continue;
    const now = readPlayerSnapshot(useRuntimeStore.getState().characterData, useRuntimeStore.getState().currentPackage);
    if (!now || now.key !== key) return;
    const previous = now.resources[id as keyof Resources];
    if (previous?.current !== value.current || previous?.max !== value.max) store.updateModuleValue(id, { ...value });
    if (id === "armor-slots" && value.max !== null && useRuntimeStore.getState().characterData?.character.values["armor-value"] !== String(value.max)) {
      store.updateModuleValue("armor-value", String(value.max));
      store.commitFreeTextChange("armor-value", String(value.max));
    }
  }
}
