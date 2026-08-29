# Heart of Hopefind Author Rules

## 当前目录边界

- 本目录现在只保留可编辑的资源 JSON、迁移清单和来源说明。
- Player 正式运行目录是 `apps/player/public/system-packages/heart-of-hopefind/`；页面、皮肤和运行时资产只在那里维护。
- 修改资源文本后运行 `scripts/generate-heart-of-hopefind-system-package.ts`。

## Authority and provenance

- 本目录是“寻望之心”迁移后的 System Package 作者源，不是 Player 运行时发布目录。
- 初始来源固定为 `PbDH_sheet@0e44fa69b12209c172e4189e273615ba3a4d07a6` 的 `public/system-packages/heart-of-hopefind/`。
- 运行时制品生成到 `apps/player/public/system-packages/heart-of-hopefind/`；不得手工只修改生成目录。
- 不修改规则文本、平衡或视觉设计；迁移差异必须记录并通过测试证明。

## Resource migration

- 旧 `resources/survivor-styles.json` 只作为迁移源，由生成脚本转换为标准内嵌 `.pbres`。
- Player 运行时不得继续读取旧 Resource Library 文件；资源通过“自由”Template 和 `survivor-styles` 原生入口注入。
- System Package 不得引入旧 Resource Format Adapter。

## Verification

- 先运行与寻望之心 Runtime、预置切换和 Character Save 隔离相关的定向 Vitest。
- 实质性修改后运行根目录 `npm run verify`。
- 视觉修改必须使用真实 Player Runtime 验收桌面、移动端和打印预检。
