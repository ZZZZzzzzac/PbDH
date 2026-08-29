import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import type { ReactNode } from "react";

import type { WeaponData } from "../../../core/index.ts";
import {
  weaponRendererRevision as legacyWeaponRendererRevision,
  type WeaponRuntimeState,
} from "../1.0.0-alpha.1/renderer.tsx";

export type { WeaponRuntimeState } from "../1.0.0-alpha.1/renderer.tsx";
export const weaponCardDesignSource = {
  document: "docs/design/creator-app.op",
  page: "30 Components",
  surface: "#28 / Canonical Card Surface",
  component: "weapon-card-r1 / Canonical",
  presentation: { ratio: "63:88", variableHeight: false },
  statNames: ["核心数据 / 属性", "核心数据 / 距离", "核心数据 / 伤害"],
  detailNames: ["规则 / 伤害类型", "规则 / 负荷"],
};

export const weaponRendererStyles = `
.weapon-card{--ink:#21150f;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;width:63mm;height:88mm;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);font-family:"Noto Sans SC",sans-serif;border:.5mm solid #21150f}.weapon-card *{box-sizing:border-box}.weapon-card.is-fluid{height:auto;min-height:88mm;overflow:visible}.weapon-header{height:21mm;flex:none;display:flex;flex-direction:column;gap:1mm;padding:3mm;background:#321b18}.weapon-meta{height:3mm;display:flex;align-items:center;justify-content:space-between;color:#e7c79a;font:700 1.8mm/1.2 "Noto Sans SC",sans-serif}.weapon-title{width:100%;margin:0;color:#fff4df;font:800 5.6mm/1.05 "Noto Sans SC",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.weapon-summary{margin:0;color:#d8ba91;font:550 1.8mm/1.2 "Noto Sans SC",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.weapon-art{height:20mm;flex:none;overflow:hidden;display:grid;place-items:center;background:#321b18}.weapon-art img{width:100%;height:100%;object-fit:cover}.weapon-art.is-image-only{height:100%}.weapon-image-missing{color:#e7c79a;font:550 2.2mm/1.25 "Noto Sans SC",sans-serif}.weapon-body{height:67mm;min-height:0;display:flex;flex-direction:column;gap:1.5mm;padding:2mm}.weapon-card.is-split .weapon-body{height:47mm}.weapon-stats{height:11mm;flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1mm}.weapon-stat{display:flex;flex-direction:column;justify-content:center;align-items:center;background:#f7f0e2;border:.2mm solid #c8b89f}.weapon-stat b{color:var(--oxblood);font:800 3.2mm/1.05 "Noto Sans SC",sans-serif}.weapon-stat span{color:#725443;font:600 1.5mm/1.1 "Noto Sans SC",sans-serif}.weapon-details{height:7mm;flex:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1mm}.weapon-detail{display:flex;align-items:center;justify-content:space-between;padding:0 1.5mm;background:var(--oxblood)}.weapon-detail span{color:#e7c79a;font:600 1.45mm/1.1 "Noto Sans SC",sans-serif}.weapon-detail b{color:#fff4df;font:800 1.8mm/1.1 "Noto Sans SC",sans-serif}.weapon-description{min-height:0;flex:1;display:flex;flex-direction:column;gap:1mm;padding:2mm;overflow:hidden;background:#f7f0e2;border:.2mm solid #c8b89f}.weapon-description h2{margin:0;color:var(--oxblood);font:800 2.7mm/1.15 "Noto Sans SC",sans-serif}.weapon-description hr{width:100%;height:.2mm;margin:0;border:0;background:#c8b89f}.weapon-description p{margin:0;overflow:hidden;color:var(--ink);font:500 2.1mm/1.3 "Noto Sans SC",sans-serif}.weapon-footer{margin:0;color:#725443;font:650 1.25mm/1.2 "Noto Sans SC",sans-serif;text-align:center}.weapon-card.is-fluid .weapon-body{height:auto;min-height:67mm}.weapon-card.is-fluid .weapon-description{min-height:38mm;overflow:visible}
`;

export const weaponRendererRevision: RendererRevisionCapability<
  WeaponData,
  WeaponRuntimeState,
  ReactNode
> = {
  ...legacyWeaponRendererRevision,
  templateVersion: "1.0.0",
  styles: weaponRendererStyles,
  render(input) {
    return legacyWeaponRendererRevision.render(input);
  },
};
