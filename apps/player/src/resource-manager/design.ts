export const playerResourceManagerDesign = {
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

export const playerCharacterSaveDesign = {
  "canvas": {
    "background": "#EEEAE4"
  },
  "appBar": {
    "height": 56,
    "background": "#1B1714"
  },
  "saveList": {
    "width": 286,
    "background": "#F3F0EA",
    "border": "#C9C1B6"
  },
  "localSyncAction": {
    "background": "#FAF7F1",
    "text": "#21150F"
  },
  "conflict": {
    "width": 700,
    "height": 486,
    "actions": [
      "人物存档冲突 / 另存副本",
      "人物存档冲突 / 使用云端",
      "人物存档冲突 / 使用本机"
    ]
  },
  "missingSystem": {
    "width": 620,
    "background": "#FFFDF8"
  },
  "account": {
    "popupWidth": 360,
    "recycleBinEntry": "平台账号弹窗 / 云端回收站入口",
    "emptyState": "云端回收站 / 空状态"
  }
} as const;
