import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import type { ReactNode } from "react";

import type { AdversaryData } from "../../../core/index.ts";
import {
  adversaryRendererRevision as legacyAdversaryRendererRevision,
  type AdversaryRuntimeState,
} from "../1.0.0-alpha.1/renderer.tsx";

export type { AdversaryRuntimeState } from "../1.0.0-alpha.1/renderer.tsx";
export const adversaryCardDesignSource = {
  document: "docs/design/creator-app.op",
  page: "30 Components",
  surface: "#28 / Canonical Card Surface",
  component: "enemy-card-r1 / Canonical",
  presentation: { ratio: "63:88", variableHeight: false },
  featureNames: ["特性 / 蓄力", "特性 / 蛮牛冲撞", "特性 / 角撞"],
};

export const adversaryRendererStyles = `
.enemy-card{--ink:#1d1713;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;position:relative;width:63mm;height:88mm;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);font-family:"Noto Sans SC",sans-serif;border:.5mm solid #21150f}.enemy-card *{box-sizing:border-box}.enemy-card.is-fluid{height:auto;min-height:88mm;overflow:visible}.enemy-art{position:relative;height:25mm;flex:none;overflow:hidden;background:#251a14}.enemy-art img{width:100%;height:100%;display:block;object-fit:cover}.enemy-art:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 48%,#1d1310e6 100%)}.enemy-art.is-image-only,.enemy-card.is-image .enemy-art{height:100%}.enemy-card.is-image .enemy-art:after{display:none}.enemy-image-missing{width:100%;height:100%;display:grid;place-items:center;color:#f8f3ea;font:700 2.5mm/1.3 "Noto Sans SC",sans-serif}.enemy-kicker{position:absolute;z-index:2;right:2.5mm;top:3mm;color:#f4dfbc;font:700 2.2mm/1.2 "Noto Sans SC",sans-serif}.enemy-heading{position:absolute;z-index:2;left:3mm;right:3mm;bottom:2.5mm;color:#fff4df;pointer-events:none}.enemy-heading h1{margin:0;font:800 4.8mm/1.05 "Noto Sans SC",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.enemy-original-title,.enemy-summary{margin:.8mm 0 0;color:#d8ba91;font:600 1.7mm/1.2 "Noto Sans SC",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.enemy-summary{color:#dcb299;font-style:italic}.enemy-card.is-text .enemy-art{height:20mm}.enemy-card.is-text .enemy-body{height:68mm}.enemy-body{height:63mm;min-height:0;padding:2mm;display:flex;flex-direction:column;gap:1.2mm}.enemy-brief{height:9mm;flex:none;display:flex;gap:1mm}.enemy-motives{min-width:0;flex:1;padding:1mm 1.2mm;overflow:hidden;background:#f7ebd6;border:.2mm solid #d4b78d;border-radius:.7mm;font:650 1.65mm/1.25 "Noto Sans SC",sans-serif}.enemy-motives p{margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.enemy-motives p+p{color:var(--oxblood)}.enemy-stats{width:20mm;display:grid;grid-template-columns:8mm 1fr}.enemy-stat{display:grid;place-content:center;text-align:center;border:.2mm solid #ad8b68}.enemy-stat b{color:var(--oxblood);font:800 2.6mm/1.1 "Noto Sans SC",sans-serif}.enemy-stat span{font:650 1.35mm/1.1 "Noto Sans SC",sans-serif}.enemy-attack{height:5mm;flex:none;display:flex;align-items:center;padding:0 1.2mm;overflow:hidden;background:var(--oxblood)}.enemy-attack strong{color:#fff0d5;font:750 1.8mm/1.2 "Noto Sans SC",sans-serif;white-space:nowrap}.enemy-state{height:9mm;flex:none;display:grid;grid-template-rows:1fr 1fr;gap:.5mm}.enemy-state-row{display:flex;align-items:center;gap:.6mm;min-height:0}.enemy-state-label{width:13mm;align-self:stretch;display:grid;place-items:center;background:#21150f;color:#f8ddba;font:700 1.35mm/1 "Noto Sans SC",sans-serif}.enemy-state-markers{display:flex;min-width:0;gap:.3mm;color:#111827;overflow:hidden}.enemy-state-marker{width:3.2mm;height:3.2mm;display:grid;place-items:center;padding:0;border:0;background:transparent;color:inherit;font:2.8mm/1 sans-serif}.enemy-state-marker:not(:disabled){cursor:pointer}.enemy-state-row.is-stress .enemy-state-markers{color:#424039}.enemy-feature-heading{height:3mm;flex:none;display:flex;align-items:center;gap:1mm;color:var(--oxblood);font:800 2mm/1 "Noto Sans SC",sans-serif}.enemy-feature-heading:after{content:"";flex:1;height:.3mm;background:#b88a57}.enemy-features{min-height:0;flex:1;display:flex;flex-direction:column;gap:.7mm;overflow:hidden}.enemy-feature{min-height:0;flex:1;display:grid;grid-template-columns:14mm 1fr;gap:1mm;padding:.8mm 1mm;overflow:hidden;background:#f7ebd6;border:.2mm solid #d4b78d;border-radius:.7mm}.enemy-feature h2{margin:0;color:var(--oxblood);font:800 2mm/1.15 "Noto Sans SC",sans-serif}.enemy-feature h2 small{display:block;color:#5e4637;font:650 1.2mm/1.15 "Noto Sans SC",sans-serif}.enemy-feature h2 small span{display:block}.enemy-feature p{margin:0;overflow:hidden;color:var(--ink);font:450 1.55mm/1.25 "Noto Sans SC",sans-serif}.enemy-card.is-fluid .enemy-body{height:auto;min-height:68mm}.enemy-card.is-fluid .enemy-features{overflow:visible}.enemy-card.is-fluid .enemy-feature{min-height:10mm}
`;

export const adversaryRendererRevision: RendererRevisionCapability<
  AdversaryData,
  AdversaryRuntimeState,
  ReactNode
> = {
  ...legacyAdversaryRendererRevision,
  templateVersion: "1.0.0",
  styles: adversaryRendererStyles,
  render(input) {
    return legacyAdversaryRendererRevision.render(input);
  },
};
