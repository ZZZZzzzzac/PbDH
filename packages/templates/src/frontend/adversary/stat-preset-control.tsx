import type { TemplateAuthoringEditorProps } from "../types.ts";
import { findAdversaryStatPreset } from "./stat-presets.ts";

/** 敌人专用的创作快捷操作，通过宿主既有接口一次提交完整数据。 */
export function AdversaryStatPresetControl({ data, onData }: Pick<TemplateAuthoringEditorProps, "data" | "onData">) {
  const kind = typeof data.种类 === "string" ? data.种类.trim() : "";
  const tier = typeof data.位阶 === "string" ? data.位阶.trim() : "";
  const preset = findAdversaryStatPreset(kind, tier);
  if (!onData) return null;

  return <div className="adversary-stat-preset">
    <style>{`.adversary-stat-preset{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:8px}.adversary-stat-preset p{flex:1;min-width:160px;margin:0;color:#6b5c50;font:500 12px/1.5 system-ui,sans-serif}.adversary-stat-preset button:disabled{opacity:.5;cursor:not-allowed}`}</style>
    <button type="button" disabled={!preset} onClick={() => {
      if (!preset) return;
      onData({ ...data, ...preset });
    }}>使用模板</button>
    <p>{preset
      ? `覆盖难度、命中、生命、压力、双阈值和伤害。${kind === "社交" ? "社交采用自拟弱战斗预设。" : ""}`
      : "请选择位阶 1–4 和预设种类后使用模板。"}</p>
  </div>;
}
