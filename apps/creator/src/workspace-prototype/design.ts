export const creatorWorkspaceDesign = {
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
    "background": "#D8D1C7",
    "border": "#C9C1B6",
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
    "background": "#FFFDF8",
    "border": "#C9C1B6",
    "activeBackground": "#641F1D",
    "fixedRatioBackground": "#FFFDF8",
    "switchBackground": "#641F1D"
  },
  "accent": "#D65458",
  "weapon": {
    "nameInputWidth": "fill_container",
    "descriptionInputHeight": 174
  },
  "gmTabletop": {
    "resourceNavigationWidth": 250,
    "tabs": {
      "height": 36,
      "background": "#E9E4DC",
      "border": "#C9C1B6"
    },
    "zoomStatus": {
      "width": 72,
      "height": 28,
      "background": "#F7F4EFE8",
      "border": "#C9C1B6"
    },
    "canvas": {
      "background": "#D8D1C7",
      "selectedBorder": "#A8403D"
    },
    "menus": {
      "canvasWidth": 230,
      "instanceWidth": 180
    },
    "instanceEditor": {
      "toolbarHeight": 42,
      "bodyGap": 12,
      "bodyPadding": 12,
      "editorWidth": 560,
      "previewBackground": "#D8D1C7",
      "previewBorder": "#C9C1B6"
    }
  },
  "cloudDocuments": {
    "status": {
      "localBackground": "#E9E4DC",
      "localForeground": "#62574E",
      "pendingBackground": "#F4E5C3",
      "pendingForeground": "#8A5A16",
      "cleanBackground": "#DDE7DD",
      "cleanForeground": "#365D4C",
      "conflictBackground": "#EEDAD7",
      "conflictForeground": "#8A2525"
    },
    "menus": {
      "workspaceWidth": 220,
      "tabletopWidth": 248,
      "accountDialogWidth": 360
    },
    "dialogs": {
      "syncWidth": 430,
      "conflictWidth": 650,
      "trashWidth": 720,
      "trashEmptyBackground": "#E9E4DC",
      "trashEmptyForeground": "#3C332D"
    }
  }
} as const;
