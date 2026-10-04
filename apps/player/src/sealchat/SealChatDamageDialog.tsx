import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { damageFormula, parseWeapon, type DamageRequest, type WeaponSnapshot } from "./damage.ts";
import type { SyncState } from "./adapter.ts";
export function SealChatDamageDialog({ weapon, state, roll, close }: {
  weapon: WeaponSnapshot; state: SyncState; roll(request: DamageRequest): Promise<boolean>; close(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [diceDelta, setDiceDelta] = useState("0"), [flat, setFlat] = useState("0"), [extraDice, setExtraDice] = useState("");
  const [reason, setReason] = useState(""), [feedback, setFeedback] = useState("");
  const ready = state.phase === "bound" && !state.busy;
  let formula = "", error = "", name = weapon.id === "primary-weapon-name" ? "主武器" : "副武器", base = "";
  const request: DamageRequest = { weapon, adjustments: [{ diceCountDelta: /^[+-]?\d+$/.test(diceDelta) ? Number(diceDelta) : NaN,
    flat: /^[+-]?\d+$/.test(flat) ? Number(flat) : NaN, extraDice }], reason };
  try { const parsed = parseWeapon(weapon.text); name = parsed.name || name; base = weapon.proficiency + "d" + parsed.sides + (parsed.fixed ? (parsed.fixed > 0 ? "+" : "") + parsed.fixed : ""); formula = damageFormula(request); }
  catch (failure) { error = failure instanceof Error ? failure.message : "伤害公式无效。"; }
  useEffect(() => { dialog.current?.showModal(); }, []);
  return createPortal(<dialog ref={dialog} className="sealchat-roll-dialog" aria-labelledby="sealchat-damage-title" onCancel={close}>
    <form onSubmit={event => { event.preventDefault(); if (!ready || error) return;
      void roll(request).then(sent => { if (sent) close(); else setFeedback("未发送，请核对同步状态、武器与熟练度。"); }); }}>
      <header className="sealchat-roll-header"><div><span className="sealchat-roll-eyebrow">伤害助手 · {weapon.id === "primary-weapon-name" ? "主武器" : "副武器"}</span><h2 id="sealchat-damage-title">{name}</h2></div>
        <button type="button" className="sealchat-roll-close" aria-label="关闭伤害助手" onClick={close}>×</button></header>
      <div className="sealchat-damage-base"><span>熟练 {weapon.proficiency}</span><code>{base || "—"}</code></div>
      <div className="sealchat-roll-grid">
        <label title="加减同类伤害骰的数量">额外同类骰<input value={diceDelta} inputMode="numeric" maxLength={5} disabled={!ready} onChange={event => { setDiceDelta(event.target.value); setFeedback(""); }} /></label>
        <label>固定修正<input value={flat} inputMode="numeric" maxLength={9} disabled={!ready} onChange={event => { setFlat(event.target.value); setFeedback(""); }} /></label>
      </div>
      <label>额外伤害骰<input value={extraDice} maxLength={200} placeholder="如 1d6+1d4" disabled={!ready} onChange={event => { setExtraDice(event.target.value); setFeedback(""); }} /></label>
      <details className="sealchat-roll-more"><summary>伤害原因</summary><label>原因<input value={reason} maxLength={200} placeholder="可选" disabled={!ready} onChange={event => setReason(event.target.value)} /></label></details>
      {error || feedback ? <p role="alert">{error || feedback}</p> : null}
      <footer className="sealchat-roll-footer"><code>{formula || "—"}</code><button type="submit" disabled={!ready || !!error}>{state.busy ? "发送中…" : "掷骰"}</button></footer>
    </form>
  </dialog>, document.body);
}
