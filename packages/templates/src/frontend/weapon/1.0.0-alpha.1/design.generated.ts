// 此文件由 scripts/generate-weapon-card-design.mjs 从 docs/design/creator-app.op 生成，禁止手改。

export const weaponCardDesignSource = {
  "document": "docs/design/creator-app.op",
  "page": "30 Components",
  "surface": "#28 / Canonical Card Surface",
  "component": "weapon-card-r1 / Canonical",
  "presentation": {
    "width": "90mm",
    "height": "142mm"
  },
  "statNames": [
    "核心数据 / 属性",
    "核心数据 / 距离",
    "核心数据 / 伤害"
  ],
  "detailNames": [
    "规则 / 伤害类型",
    "规则 / 负荷"
  ]
} as const;

export const weaponRendererStyles = ".weapon-card {\n  --weapon-ink: #21150F;\n  --weapon-bone: #EEE4D0;\n  --weapon-oxblood: #641F1D;\n  box-sizing: border-box;\n  width: 90mm;\n  height: 142mm;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  background: var(--weapon-bone);\n  color: var(--weapon-ink);\n  font-family: \"Noto Sans SC\", sans-serif;\n  border: 0.75mm solid #21150F;\n}\n.weapon-card.is-fluid { height: auto; min-height: 142mm; overflow: visible; }\n.weapon-header { box-sizing: border-box; height: 33mm; display: flex; flex-direction: column; gap: 1.75mm; padding: 4.5mm 4.5mm 3.5mm 4.5mm; background: #321B18; }\n.weapon-meta { height: 6mm; display: flex; align-items: center; justify-content: space-between; }\n.weapon-type { width: 35mm; color: #E7C79A; font: 700 3mm/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-tier { width: 25mm; color: #E7C79A; font: 700 3mm/1.25 \"Noto Sans SC\", sans-serif; text-align: right; }\n.weapon-title { width: 100%; margin: 0; color: #FFF4DF; font: 800 8mm/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-summary { width: 100%; margin: 0; color: #D8BA91; font: 550 3mm/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-body { box-sizing: border-box; height: 109mm; display: flex; flex-direction: column; gap: 3mm; padding: 3.5mm 3.5mm 4mm 3.5mm; }\n.weapon-stats { height: 16.5mm; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2mm; }\n.weapon-stat { box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.5mm; padding: 2mm 1.5mm; background: #F7F0E2; border: 0.25mm solid #C8B89F; }\n.weapon-stat b { width: 100%; color: #641F1D; font: 800 5mm/1.25 \"Noto Sans SC\", sans-serif; text-align: center; }\n.weapon-stat span { width: 100%; color: #725443; font: 600 2.5mm/1.25 \"Noto Sans SC\", sans-serif; text-align: center; }\n.weapon-details { height: 10.5mm; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2mm; }\n.weapon-detail { box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; padding: 0mm 2.5mm; background: #641F1D; }\n.weapon-detail span { color: #E7C79A; font: 600 2.5mm/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-detail b { color: #FFF4DF; font: 800 3.5mm/1.25 \"Noto Sans SC\", sans-serif; text-align: right; }\n.weapon-description { box-sizing: border-box; min-height: 0; flex: 1; display: flex; flex-direction: column; gap: 2.5mm; padding: 4mm 4mm; overflow: hidden; background: #F7F0E2; border: 0.25mm solid #C8B89F; }\n.weapon-description h2 { margin: 0; color: #641F1D; font: 800 4.5mm/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-description hr { width: 100%; height: 0.25mm; margin: 0; border: 0; background: #C8B89F; }\n.weapon-description p { margin: 0; color: #21150F; font: 500 3.75mm/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-footer { margin: 0; color: #725443; font: 650 2.25mm/1.25 \"Noto Sans SC\", sans-serif; text-align: center; }\n.weapon-card.is-fluid .weapon-body { height: auto; }\n.weapon-card.is-fluid .weapon-description { min-height: 62.5mm; overflow: visible; }";
