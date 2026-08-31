// 此文件由 scripts/generate-weapon-card-design.mjs 从 docs/design/creator-app.op 生成，禁止手改。

export const weaponCardDesignSource = {
  "document": "docs/design/creator-app.op",
  "page": "30 Components",
  "surface": "#28 / Canonical Card Surface",
  "component": "weapon-card-r1 / Canonical",
  "presentation": {
    "width": "90px",
    "height": "142px"
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

export const weaponRendererStyles = ".weapon-card {\n  --weapon-ink: #21150F;\n  --weapon-bone: #EEE4D0;\n  --weapon-oxblood: #641F1D;\n  box-sizing: border-box;\n  width: 90px;\n  height: 142px;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  background: var(--weapon-bone);\n  color: var(--weapon-ink);\n  font-family: \"Noto Sans SC\", sans-serif;\n  border: 0.75px solid #21150F;\n}\n.weapon-card.is-fluid { height: auto; min-height: 142px; overflow: visible; }\n.weapon-art { box-sizing: border-box; width: 100%; height: 42px; flex: none; overflow: hidden; display: grid; place-items: center; background: #321B18; }\n.weapon-art img { width: 100%; height: 100%; object-fit: cover; }\n.weapon-art.is-image-only { height: 100%; }\n.weapon-image-missing { color: #E7C79A; font: 550 3px/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-card.is-split .weapon-body { height: 67px; }\n.weapon-header { box-sizing: border-box; height: 33px; display: flex; flex-direction: column; gap: 1.75px; padding: 4.5px 4.5px 3.5px 4.5px; background: #321B18; }\n.weapon-meta { height: 6px; display: flex; align-items: center; justify-content: space-between; }\n.weapon-type { width: 35px; color: #E7C79A; font: 700 3px/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-tier { width: 25px; color: #E7C79A; font: 700 3px/1.25 \"Noto Sans SC\", sans-serif; text-align: right; }\n.weapon-title { width: 100%; margin: 0; color: #FFF4DF; font: 800 8px/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-summary { width: 100%; margin: 0; color: #D8BA91; font: 550 3px/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-body { box-sizing: border-box; height: 109px; display: flex; flex-direction: column; gap: 3px; padding: 3.5px 3.5px 4px 3.5px; }\n.weapon-stats { height: 16.5px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; }\n.weapon-stat { box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.5px; padding: 2px 1.5px; background: #F7F0E2; border: 0.25px solid #C8B89F; }\n.weapon-stat b { width: 100%; color: #641F1D; font: 800 5px/1.25 \"Noto Sans SC\", sans-serif; text-align: center; }\n.weapon-stat span { width: 100%; color: #725443; font: 600 2.5px/1.25 \"Noto Sans SC\", sans-serif; text-align: center; }\n.weapon-details { height: 10.5px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px; }\n.weapon-detail { box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; padding: 0px 2.5px; background: #641F1D; }\n.weapon-detail span { color: #E7C79A; font: 600 2.5px/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-detail b { color: #FFF4DF; font: 800 3.5px/1.25 \"Noto Sans SC\", sans-serif; text-align: right; }\n.weapon-description { box-sizing: border-box; min-height: 0; flex: 1; display: flex; flex-direction: column; gap: 2.5px; padding: 4px 4px; overflow: hidden; background: #F7F0E2; border: 0.25px solid #C8B89F; }\n.weapon-description h2 { margin: 0; color: #641F1D; font: 800 4.5px/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-description hr { width: 100%; height: 0.25px; margin: 0; border: 0; background: #C8B89F; }\n.weapon-description p { margin: 0; color: #21150F; font: 500 3.75px/1.25 \"Noto Sans SC\", sans-serif; }\n.weapon-footer { margin: 0; color: #725443; font: 650 2.25px/1.25 \"Noto Sans SC\", sans-serif; text-align: center; }\n.weapon-card.is-fluid .weapon-body { height: auto; }\n.weapon-card.is-fluid .weapon-description { min-height: 62.5px; overflow: visible; }";
