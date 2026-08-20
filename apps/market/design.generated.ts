// 此文件由 scripts/generate-market-design.mjs 从 docs/design/market.op 生成，禁止手改。

export const marketDesignSource = {
  "document": "docs/design/market.op",
  "issue": 33,
  "pages": [
    "00 PRD Coverage",
    "01 User Flows",
    "10 Market Discovery & Publication",
    "11 States & Handoffs",
    "20 Dialogs & Menus",
    "30 Components"
  ],
  "desktop": {
    "width": 1440,
    "height": 1024,
    "discovery": "#33-US / Market / Discovery / Desktop",
    "detail": "#33-US / Market / Publication Detail / Enemy / Available",
    "creatorPublish": "#33-US / Creator / Publish Package / Ready"
  },
  "mobile": {
    "width": 390,
    "height": 844,
    "frames": [
      "#33-US / Market / Discovery / Mobile",
      "#33-US / Market / Publication Detail / Mobile",
      "#33-US / Market / Acquisition Actions / Mobile"
    ]
  },
  "states": "#33 / Market / Lifecycle & Handoff States",
  "responsive": "#33 / Market / Responsive",
  "dialogs": "#33 / Market / Dialogs & Menus",
  "components": "#33 / Market / Components",
  "appBar": {
    "height": 56,
    "background": "#1B1714"
  },
  "acquisitionActions": [
    "Publication 详情 / 下载完整包",
    "Publication 详情 / 安装到玩家",
    "Publication 详情 / 导入卡片工坊",
    "Publication 详情 / 发送到桌面"
  ],
  "publicationCoverSource": "Resource Package Asset / 63:88 crop",
  "canonicalSurfaceSource": "docs/design/creator-app.op / #28 Canonical Card Surface / single resource preview only"
} as const;
