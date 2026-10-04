import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { rollCommand, type RollOptions, type RollRequest, type Trait } from "./roll.ts";
import type { SyncState } from "./adapter.ts";

export function SealChatRollDialog({ trait, state, roll, close }: {
  trait: Trait; state: SyncState; roll(request: RollRequest): Promise<boolean>; close(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<RollOptions>({ mode: "action", edge: "normal", modifier: "", difficulty: "", reason: "",
    experienceIndices: [], experienceRevision: state.dice.experienceRevision });
  const [manual, setManual] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const ready = state.phase === "bound" && !state.busy;
  let generated = "", error = "";
  try {
    generated = rollCommand({ trait, options }, state.dice, state.resources.hope?.current ?? null);
    if (manual !== null) rollCommand({ trait, options, expression: manual }, state.dice, state.resources.hope?.current ?? null);
  } catch (failure) { error = failure instanceof Error ? failure.message : "掷骰选项无效。"; }
  const update = (patch: Partial<RollOptions>) => { setOptions(value => ({ ...value, ...patch })); setManual(null); setFeedback(""); };
  useEffect(() => { dialog.current?.showModal(); }, []);
  const bonus = options.experienceIndices.reduce((sum, n) => sum + (state.dice.experiences[n - 1]?.modifier ?? 0), 0);
  return createPortal(<dialog ref={dialog} className="sealchat-roll-dialog" aria-labelledby="sealchat-roll-title" onCancel={close}>
    <form onSubmit={event => {
      event.preventDefault();
      if (!ready || error) return;
      void roll({ trait, options, ...(manual === null ? {} : { expression: manual }) }).then(sent => {
        if (sent) close(); else setFeedback("未发送，请核对同步状态与最新数值。");
      });
    }}>
      <header className="sealchat-roll-header"><div><span className="sealchat-roll-eyebrow">掷骰助手</span><h2 id="sealchat-roll-title">{trait}检定 <small>{state.dice.traits[trait] === null ? "—" : (state.dice.traits[trait]! >= 0 ? "+" : "") + state.dice.traits[trait]}</small></h2></div>
        <button type="button" className="sealchat-roll-close" aria-label="关闭掷骰助手" onClick={close}>×</button></header>
      <div className="sealchat-roll-mode" role="group" aria-label="掷骰模式">
        {(["normal", "adv", "dis"] as const).map((edge, i) => <button type="button" disabled={!ready} key={edge} aria-pressed={options.edge === edge}
          onClick={() => update({ edge })}>{["普通", "优势", "劣势"][i]}</button>)}
        <button type="button" disabled={!ready} aria-pressed={options.mode === "reaction"} onClick={() => update({ mode: options.mode === "reaction" ? "action" : "reaction" })}>反应掷骰</button>
      </div>
      <div className="sealchat-roll-grid">
        <label>修正<div className="sealchat-roll-modifier">
          <button type="button" disabled={!ready || !Number.isFinite(Number(options.modifier))} aria-label="额外调整值减少" onClick={() => update({ modifier: String(Number(options.modifier) - 1) })}>−</button>
          <input aria-label="额外调整值" value={options.modifier} inputMode="decimal" maxLength={16} placeholder="0" disabled={!ready} onChange={event => update({ modifier: event.target.value })} />
          <button type="button" disabled={!ready || !Number.isFinite(Number(options.modifier))} aria-label="额外调整值增加" onClick={() => update({ modifier: String(Number(options.modifier) + 1) })}>+</button>
        </div></label>
        <label>难度<input value={options.difficulty} inputMode="numeric" maxLength={12} placeholder="—" disabled={!ready} onChange={event => update({ difficulty: event.target.value })} /></label>
      </div>
      {state.dice.experiences.length ? <section className="sealchat-roll-experiences" aria-label="经历">
        <div className="sealchat-roll-section-label">经历 <small title="每项经历消耗 1 希望">消耗 {options.experienceIndices.length} 希望 / {state.resources.hope?.current ?? "—"} · 修正 {bonus >= 0 ? "+" : ""}{bonus}</small></div>
        <div className="sealchat-roll-chips">{state.dice.experiences.map((item, i) => <label key={i} className="sealchat-roll-experience">
          <input type="checkbox" disabled={!ready} checked={options.experienceIndices.includes(i + 1)} onChange={event => update({
            experienceIndices: event.target.checked ? [...options.experienceIndices, i + 1] : options.experienceIndices.filter(n => n !== i + 1), experienceRevision: state.dice.experienceRevision,
          })} />{item.name} <b>{item.modifier >= 0 ? "+" : ""}{item.modifier}</b>
        </label>)}</div>
      </section> : null}
      <details className="sealchat-roll-more"><summary>原因与公式</summary>
        <label>原因<input value={options.reason} maxLength={200} placeholder="可选" disabled={!ready} onChange={event => update({ reason: event.target.value })} /></label>
        <label title="使用经历时由选项生成；取消勾选后可手动编辑 .dd / .ddr">公式<input className="sealchat-roll-expression" value={manual ?? generated} maxLength={1000} disabled={!ready} onChange={event => { setManual(event.target.value); setFeedback(""); }} /></label>
      </details>
      {error || feedback || state.dice.experienceError ? <p role="alert">{error || feedback || state.dice.experienceError}</p> : null}
      <footer className="sealchat-roll-footer"><code title={manual ?? generated}>{manual ?? generated}</code><button type="submit" disabled={!ready || !!error}>{state.busy ? "发送中…" : "掷骰"}</button></footer>
    </form>
  </dialog>, document.body);
}
