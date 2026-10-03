import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { daggerheartSystemId, emptyResources, readEmbedConfig, resourceId, SealChatSync,
  type EmbedClient, type ResourceId, type SyncState } from "./adapter.ts";
import "./sealchat.css";

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
}
export const SealChatResourceContext = createContext<ResourceControl | null>(null);
export function useSealChatResource(moduleId: string) {
  const control = useContext(SealChatResourceContext);
  const id = resourceId(moduleId);
  if (!control || !id) return null;
  return { value: control.state.resources[id], disabled: control.state.phase !== "bound" || control.state.busy,
    change: (delta: number) => control.change(id, delta) };
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
  const [state, setState] = useState<SyncState>({ phase: "connecting", cardName: "", resources: emptyResources(), busy: false, canBind: false, message: config.error || "正在连接 SealChat…" });

  useEffect(() => {
    if (!config.value || !visible || !supported || !characterId) return;
    const activeConfig = config.value;
    let stopped = false;
    let sync: SealChatSync | null = null;
    let timer: number | undefined;
    setState({ phase: "connecting", cardName: "", resources: emptyResources(), busy: false, canBind: false, message: "正在连接 SealChat…" });
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
      if (!stopped) setState({ phase: "error", cardName: "", resources: emptyResources(), busy: false, canBind: false,
        message: error instanceof Error ? error.message : "SealChat 连接失败。" });
    });
    return () => { stopped = true; window.clearInterval(timer); sync?.stop(); syncRef.current = null; };
  }, [attempt, config, supported, visible, !!characterId]);

  useEffect(() => { syncRef.current?.setLocalKey(localKey); }, [localKey]);
  const control = useMemo<ResourceControl | null>(() => requested && supported ? {
    state, change: (id, delta) => { void syncRef.current?.change(id, delta); },
  } : null, [requested, supported, state]);

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
  </SealChatResourceContext.Provider>;
}
