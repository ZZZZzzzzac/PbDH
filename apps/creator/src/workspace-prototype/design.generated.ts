// 此文件由 scripts/generate-adversary-card-design.mjs 从 docs/design/creator-app.op 生成，禁止手改.

export const creatorWorkspaceDesign = {
  "document": "docs/design/creator-app.op",
  "page": "10 Creator Workspace Rough",
  "frame": "#30 / Creator Workspace / 敌人编辑",
  "canonicalSurface": "enemy-card-r1 / Canonical",
  "canvas": {
    "width": 1440,
    "height": 1024,
    "background": "#EAE4DA"
  },
  "appBar": {
    "height": 56,
    "background": "#1B1714",
    "border": "#302925"
  },
  "tabs": {
    "height": 36,
    "background": "#E9E4DC",
    "border": "#C9C1B6"
  },
  "columns": {
    "gap": 0,
    "padding": 0,
    "resourceNavigationWidth": 250,
    "bodyGap": 12,
    "bodyPadding": 12
  },
  "panel": {
    "background": "#F3F0EA",
    "border": "#D2CBC1",
    "radius": 0
  },
  "editor": {
    "background": "#F5F0E8",
    "gap": 10,
    "padding": [
      12,
      14
    ]
  },
  "preview": {
    "background": "#292622",
    "border": "#3A3530",
    "radius": 10
  },
  "field": {
    "height": 32,
    "fontSize": 12,
    "background": "#FFFDF8",
    "border": "#CFC3B2",
    "radius": 5,
    "groupBackground": "#FAF7F1",
    "groupBorder": "#DED4C6",
    "groupRadius": 6
  },
  "feature": {
    "background": "#F0EAE1",
    "border": "#D4C8B5",
    "descriptionHeight": 48
  },
  "previewControls": {
    "height": 32,
    "background": "#433E38",
    "border": "#5B534A",
    "activeBackground": "#6F2024",
    "fixedRatioBackground": "#433E38",
    "switchBackground": "#A43A3E"
  },
  "accent": "#D65458",
  "weapon": {
    "page": "12 Creator Weapon Editing",
    "frame": "#37 / Creator Workspace / 主武器编辑",
    "canonicalSurface": "weapon-card-r1 / Canonical",
    "nameInputWidth": "fill_container",
    "descriptionInputHeight": 174
  }
} as const;
