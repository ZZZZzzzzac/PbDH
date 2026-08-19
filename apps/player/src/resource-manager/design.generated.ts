// 此文件由 scripts/generate-player-design.mjs 从 docs/design/player-app.op 生成，禁止手改。

export const playerResourceManagerDesign = {
  "document": "docs/design/player-app.op",
  "page": "10 Resource Manager",
  "frame": "Player / Resource Manager / Creator 风格 / 大型多类型资源包",
  "canvas": {
    "background": "#F3EFE7"
  },
  "manager": {
    "width": 1160,
    "height": 850,
    "radius": 8,
    "background": "#FFFDF8",
    "border": "#D4C8B5"
  },
  "bar": {
    "height": 64,
    "background": "#21150F"
  },
  "columns": {
    "packageListWidth": 330,
    "detailWidth": "fill_container"
  },
  "panel": {
    "background": "#FAF7F1",
    "border": "#D4C8B5"
  },
  "selected": {
    "background": "#F4E5C3",
    "accent": "#641F1D"
  },
  "primary": {
    "background": "#641F1D",
    "text": "#FFFDF8"
  },
  "success": {
    "background": "#DDE7DD",
    "text": "#2F6F4E"
  },
  "dialog": {
    "width": 660,
    "radius": 8,
    "background": "#FFFDF8",
    "barBackground": "#21150F",
    "primaryBackground": "#641F1D",
    "errorBackground": "#EEDAD7",
    "errorText": "#9F2E28"
  }
} as const;
