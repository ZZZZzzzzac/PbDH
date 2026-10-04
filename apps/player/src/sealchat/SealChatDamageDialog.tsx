import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { damageCommand, weaponDamageDefaults, weaponLabel, weaponName, type DamageRequest, type WeaponSnapshot } from "./damage.ts";
import type { SyncState } from "./adapter.ts";
export function SealChatDamageDialog({ weapon, state, roll, close }: {
  weapon: WeaponSnapshot; state: SyncState; roll(request: DamageRequest): Promise<boolean>; close(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [defaults] = useState(() => weaponDamageDefaults(weapon));
  const [proficiency, setProficiency] = useState(defaults.proficiency), [die, setDie] = useState(defaults.die), [fixed, setFixed] = useState(defaults.fixed);
  const [feedback, setFeedback] = useState("");
  const ready = state.phase === "bound" && !state.busy;
  const integer = (value: string) => /^[+-]?\d+$/.test(value.trim()) ? Number(value) : NaN;
  const request: DamageRequest = { weapon, values: { proficiency: integer(proficiency), die, fixed: integer(fixed) } };
  let command = "", error = "";
  try { command = damageCommand(request, weapon); }
  catch (failure) { error = failure instanceof Error ? failure.message : "伤害公式无效。"; }
  useEffect(() => { dialog.current?.showModal(); }, []);
  return createPortal(<dialog ref={dialog} className="sealchat-roll-dialog" aria-labelledby="sealchat-damage-title" onCancel={close}>
    <form onSubmit={event => { event.preventDefault(); if (!ready || error) return;
      void roll(request).then(sent => { if (sent) close(); else setFeedback("未发送，请核对同步状态、武器与熟练度。"); }); }}>
      <header className="sealchat-roll-header"><div><span className="sealchat-roll-eyebrow">伤害助手 · {weaponLabel(weapon.id)}</span><h2 id="sealchat-damage-title">{weaponName(weapon.text) || weaponLabel(weapon.id)}</h2></div>
        <button type="button" className="sealchat-roll-close" aria-label="关闭伤害助手" onClick={close}>×</button></header>
      <div className="sealchat-roll-grid sealchat-damage-inputs">
        <label>熟练值<input value={proficiency} inputMode="numeric" maxLength={5} placeholder="3" disabled={!ready} onChange={event => { setProficiency(event.target.value); setFeedback(""); }} /></label>
        <label>伤害骰大小<input value={die} maxLength={8} placeholder="d6" disabled={!ready} onChange={event => { setDie(event.target.value); setFeedback(""); }} /></label>
        <label>固定调整值<input value={fixed} inputMode="text" maxLength={9} placeholder="+3" disabled={!ready} onChange={event => { setFixed(event.target.value); setFeedback(""); }} /></label>
      </div>
      {error || feedback ? <p role="alert">{error || feedback}</p> : null}
      <footer className="sealchat-roll-footer"><code>{command || "—"}</code><button type="submit" disabled={!ready || !!error}>{state.busy ? "发送中…" : "掷骰"}</button></footer>
    </form>
  </dialog>, document.body);
}
