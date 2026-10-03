import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { rollCommand, type RollOptions, type RollRequest, type Trait } from "./roll.ts";
import type { SyncState } from "./adapter.ts";

export const traitModules: Record<string, Trait> = {
  agility: "敏捷", strength: "力量", finesse: "灵巧", instinct: "本能", presence: "风度", knowledge: "知识",
};

export function SealChatRollDialog({ trait, state, roll, close }: {
  trait: Trait; state: SyncState; roll(request: RollRequest): Promise<boolean>; close(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<RollOptions>({ mode: "action", edge: "normal", modifier: "", difficulty: "", reason: "",
    experienceIndices: [], experienceRevision: state.dice.experienceRevision });
  const [manual, setManual] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const ready = state.phase === "bound" && !state.busy;
  let generated = "";
  let error = "";
  try { generated = rollCommand({ trait, options }, state.dice, state.resources.hope?.current ?? null); }
  catch (failure) { error = failure instanceof Error ? failure.message : "掷骰选项无效。"; }
  if (!error && manual !== null) {
    try { rollCommand({ trait, options, expression: manual }, state.dice, state.resources.hope?.current ?? null); }
    catch (failure) { error = failure instanceof Error ? failure.message : "公式无效。"; }
  }
  const update = (patch: Partial<RollOptions>) => { setOptions(value => ({ ...value, ...patch })); setManual(null); setFeedback(""); };
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (state.phase !== "bound") close(); }, [state.phase, close]);
  const bonus = options.experienceIndices.reduce((sum, n) => sum + (state.dice.experiences[n - 1]?.modifier ?? 0), 0);

  return createPortal(<dialog ref={dialog} className="sealchat-roll-dialog" aria-labelledby="sealchat-roll-title" onCancel={close}>
    <form onSubmit={event => {
      event.preventDefault();
      if (!ready || error) return;
      void roll({ trait, options, ...(manual === null ? {} : { expression: manual }) }).then(sent => {
        if (sent) close(); else setFeedback("未发送，请核对同步状态与 Dice 最新数值。");
      });
    }}>
      <h2 id="sealchat-roll-title">{trait} · 掷骰助手</h2>
      <p>Dice 特质修正：{state.dice.traits[trait] ?? "未录入"}</p>
      <fieldset disabled={!ready}>
        <legend>掷骰模式</legend>
        <div className="sealchat-roll-buttons">
          {(["normal", "adv", "dis"] as const).map((edge, i) => <button type="button" key={edge} aria-pressed={options.edge === edge}
            onClick={() => update({ edge })}>{["普通", "优势", "劣势"][i]}</button>)}
          <button type="button" aria-pressed={options.mode === "reaction"} onClick={() => update({ mode: options.mode === "reaction" ? "action" : "reaction" })}>反应掷骰</button>
        </div>
      </fieldset>
      <fieldset disabled={!ready}>
        <legend>经历</legend>
        {state.dice.experiences.map((item, i) => <label className="sealchat-roll-experience" key={`${i}:${item.name}`}>
          <input type="checkbox" checked={options.experienceIndices.includes(i + 1)} onChange={event => update({
            experienceIndices: event.target.checked ? [...options.experienceIndices, i + 1] : options.experienceIndices.filter(n => n !== i + 1),
            experienceRevision: state.dice.experienceRevision,
          })} />{item.name} ({item.modifier >= 0 ? "+" : ""}{item.modifier})
        </label>)}
        <p>{state.dice.experienceError || (state.dice.experiences.length ? `经历修正 ${bonus >= 0 ? "+" : ""}${bonus} · 消耗 ${options.experienceIndices.length} 希望（当前 ${state.resources.hope?.current ?? "未知"}）` : "Dice 尚未导入经历。")}</p>
      </fieldset>
      <label>额外调整值<div className="sealchat-roll-modifier">
        <button type="button" disabled={!ready || !Number.isFinite(Number(options.modifier))} aria-label="额外调整值减少" onClick={() => update({ modifier: String(Number(options.modifier) - 1) })}>−</button>
        <input value={options.modifier} inputMode="decimal" maxLength={16} placeholder="0" disabled={!ready} onChange={event => update({ modifier: event.target.value })} />
        <button type="button" disabled={!ready || !Number.isFinite(Number(options.modifier))} aria-label="额外调整值增加" onClick={() => update({ modifier: String(Number(options.modifier) + 1) })}>+</button>
      </div></label>
      <label>难度<input value={options.difficulty} inputMode="numeric" maxLength={12} placeholder="可不填" disabled={!ready} onChange={event => update({ difficulty: event.target.value })} /></label>
      <label>原因<input value={options.reason} maxLength={200} placeholder="可不填" disabled={!ready} onChange={event => update({ reason: event.target.value })} /></label>
      <label>掷骰公式（可手动修正）<input className="sealchat-roll-expression" value={manual ?? generated} maxLength={1000} disabled={!ready} onChange={event => { setManual(event.target.value); setFeedback(""); }} /></label>
      <p className="sealchat-roll-note">选项变化会重新生成公式。手动公式使用 .dd / .ddr；使用经历时由选项生成，Dice 校验并扣费。</p>
      <p role="alert">{error || feedback}</p>
      <div className="sealchat-roll-buttons">
        <button type="button" onClick={close}>取消</button><button type="submit" disabled={!ready || !!error}>掷骰</button>
      </div>
    </form>
  </dialog>, document.body);
}
