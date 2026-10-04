import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { daggerheartSystemId, emptyResources, readEmbedConfig, resourceId, adjustableMaximum, SealChatSync,
  type EmbedClient, type ResourceId, type SyncState } from "./adapter.ts";
import "./sealchat.css";
import { readDiceData, type Trait } from "./roll.ts";
import { SealChatRollDialog } from "./SealChatRollDialog.tsx";
import { SealChatDamageDialog } from "./SealChatDamageDialog.tsx";
import { numberId, readNumbers, traitModules, type NumberId } from "./numbers.ts";
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
  setNumber?(id: NumberId, value: string, binding: string): Promise<boolean>;
  openRoll?(selection: RollSelection): void;
}
export const SealChatResourceContext = createContext<ResourceControl | null>(null);
export function useSealChatResource(moduleId: string) {
  const control = useContext(SealChatResourceContext);
  const id = resourceId(moduleId);
  if (!control || !id) return null;
  return { value: control.state.resources[id], disabled: control.state.phase !== "bound" || control.state.busy,
    change: (delta: number) => control.change(id, delta),
    editableMax: adjustableMaximum(id), changeMax: (delta: number) => control.changeMax?.(id, delta) };
}

export function SealChatResources({ systemPackageId, characterId, characterName, visible, children }: {
  systemPackageId?: string; characterId?: string; characterName: string; visible: boolean; children: ReactNode;
}) {
  const [config] = useState(() => {
    try { return { value: readEmbedConfig(window.location.href, window.parent !== window), error: "" }; }
    catch (error) { return { value: null, error: error instanceof Error ? error.message : "接入配置无效。" }; }
  });
  const requested = !!config.value || !!config.error;
  const supported = systemPackageId === daggerheartSystemId;
  const localKey = JSON.stringify([systemPackageId, characterId]);
  const localKeyRef = useRef(localKey);
  localKeyRef.current = localKey;
  const syncRef = useRef<SealChatSync | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<RollSelection | null>(null);
  const [state, setState] = useState<SyncState>({ phase: "connecting", cardName: "", resources: emptyResources(), numbers: readNumbers({}), bindingToken: "", dice: readDiceData({}), busy: false, canBind: false, message: config.error || "正在连接 SealChat…" });

  useEffect(() => {
    if (!config.value || !visible || !supported || !characterId) return;
    const activeConfig = config.value;
    let stopped = false;
    let sync: SealChatSync | null = null;
    let timer: number | undefined;
    setState({ phase: "connecting", cardName: "", resources: emptyResources(), numbers: readNumbers({}), bindingToken: "", dice: readDiceData({}), busy: false, canBind: false, message: "正在连接 SealChat…" });
    void (async () => {
      const sdk = await loadSDK(activeConfig.sdkUrl);
      if (stopped) return;
      const client = await sdk.connect({ targetOrigin: activeConfig.hostOrigin, timeoutMs: 10_000 });
      if (stopped) { client.close(); return; }
      sync = new SealChatSync(client, localKeyRef.current, next => { if (!stopped) setState(next); });
      syncRef.current = sync;
      await sync.start();
      if (!stopped) timer = window.setInterval(() => { void sync?.refresh(); }, 10_000);
    })().catch(error => {
      if (!stopped) setState({ phase: "error", cardName: "", resources: emptyResources(), numbers: readNumbers({}), bindingToken: "", dice: readDiceData({}), busy: false, canBind: false,
        message: error instanceof Error ? error.message : "SealChat 连接失败。" });
    });
    return () => { stopped = true; window.clearInterval(timer); sync?.stop(); syncRef.current = null; };
  }, [attempt, config, supported, visible, !!characterId]);

  useEffect(() => { syncRef.current?.setLocalKey(localKey); }, [localKey]);
  useEffect(() => { setSelection(null); }, [localKey, visible]);
  useEffect(() => { if (state.phase !== "bound") setSelection(null); }, [state.phase]);
  const control = useMemo<ResourceControl | null>(() => requested && supported ? {
    state, change: (id, delta) => { void syncRef.current?.change(id, delta, state.bindingToken); },
    changeMax: (id, delta) => { void syncRef.current?.changeMax(id, delta, state.bindingToken); },
    setNumber: (id, value, binding) => syncRef.current?.setNumber(id, value, binding) ?? Promise.resolve(false),
    openRoll: next => { if (visible && state.phase === "bound") { setSelection(next); void syncRef.current?.refresh(); } },
  } : null, [requested, supported, state, visible]);

  return <SealChatResourceContext.Provider value={control}>
    {requested && visible ? <section className="sealchat-sync" aria-label="SealChat 资源同步">
      <strong>SealChat 同步（实验）</strong>
      <p role="status">{!supported ? "此实验仅支持匕首之心核心系统包。" : config.error || state.message}</p>
      {supported && state.cardName ? <p>PbDH：{characterName || "未命名人物"} · Dice：{state.cardName}</p> : null}
      <div>
        <button type="button" disabled={!supported || !state.canBind || state.busy || state.phase === "bound"}
          onClick={() => { void syncRef.current?.bind(); }}>确认关联当前人物卡</button>
        <button type="button" disabled={state.phase !== "bound" || state.busy} onClick={() => syncRef.current?.pause()}>暂停同步</button>
        <button type="button" disabled={!config.value || state.busy} onClick={() => {
          if (state.phase === "closed" || state.phase === "error") setAttempt(value => value + 1);
          else void syncRef.current?.refresh();
        }}>刷新 / 重连</button>
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

export function useSealChatNumber(moduleId: string) {
  const control = useContext(SealChatResourceContext);
  const id = numberId(moduleId);
  if (!control || !id) return null;
  return { value: control.state.numbers[id], binding: control.state.bindingToken,
    disabled: control.state.phase !== "bound" || control.state.busy,
    set: (value: string, binding: string) => control.setNumber?.(id, value, binding) ?? Promise.resolve(false) };
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
