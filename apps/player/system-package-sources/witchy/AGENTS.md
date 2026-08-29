# Witchy Author Rules

## 当前目录边界

- 本目录现在只保留可编辑的资源 JSON、迁移清单和来源说明。
- Player 正式运行目录是 `apps/player/public/system-packages/witchy/`；页面、皮肤和运行时资产只在那里维护。
- 修改资源文本后运行 `scripts/generate-migrated-system-packages.ts`。

## Authority and provenance

- 本目录是“巫趣 Witchy”迁移后的 System Package 作者源。
- 初始来源固定为 `PbDH_sheet@0e44fa69b12209c172e4189e273615ba3a4d07a6` 的 `public/system-packages/witchy/`。
- 运行时制品生成到 `apps/player/public/system-packages/witchy/`，不得只修改生成目录。
- 不修改规则文本、平衡或视觉设计。

## Verification

- 迁移后验证角色页、皮肤、资源选择和车卡审核。
- 实质性修改后运行根目录 `npm run verify`。
