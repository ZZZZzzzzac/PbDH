# daggerheart-core Author Rules

## 当前目录边界（优先于下方迁移期规则）

- 本目录只保留 Daggerheart Core 运行时清单；不保留可编辑的资源 JSON、审阅副本或提取 override。
- Player 正式运行目录是 `apps/player/public/system-packages/daggerheart-core/`；页面、布局、皮肤、检查和运行时界面资产只在那里维护。
- 卡图与卡背已经装入正式 `.pbres`，不再保留散装 `assets/cards/**` 副本。
- ParaTranz 导出快照 `docs/sources/daggerheart-srd2/DH_SRD_2_2026_08_25.paratranz.json` 是唯一人工维护的资源内容源。译文修订先回写 ParaTranz，再接受新导出。
- 正常生成只运行 `npm run build:daggerheart-core`。该入口在临时目录完成提取和 Schema 校验，然后生成两个 PBRES，并从现有 PBRES 复用媒体。
- 上游更新必须先按 `docs/sources/daggerheart-srd2/AGENTS.md` 逐 `key` 比较，再接受为仓库快照。
- 英文 `original` 是章节、表格和英文名的结构权威；中文 `translation` 是中文正文权威。解析器按 ParaTranz `key` 配对两者，不从中英混排字符串猜测英文名。
- 提取必须 fail-closed：未解析记录、英中表格行数不一致、缺少必填字段、重复资源 ID 或 Template Schema 失败时不得覆盖现有资源 JSON。
- 玩家资源写入既有 `daggerheart-core.pbres`；敌人与环境写入独立的 `daggerheart-core-gm.pbres`。两个包都由同一生成入口构建并独立计算版本与快照摘要。
- 不得把临时提取 JSON 或 PBRES 逻辑文档副本提交回本目录。审阅生成结果时直接解包 PBRES 或运行定向测试。
- 生成资源的文件名默认只使用 `名称.json`，分类字段放入上级目录。子职业例外：路径固定为 `子职业/{主职}/{名称}-{等级}.json`，ID 固定为 `子职业:{主职}:{名称}:{等级}`，避免为每个等级创建只有一个文件的目录。
- 下方关于本目录 Skin 文件的规则仅为迁移历史，不再表示现行写入位置。

## Skin task default scope

When the task is to create or beautify a Skin, read `SKINNING.md` and `docs/system-package/contract/pages-layout-skins.md` first.

Allowed writes by default:

- `skins/<skin-id>/**`
- `assets/skins/<skin-id>/**`
- only that Skin's registration in `system.json`

Do not modify Base files under `layouts/`, `modules.json`, `pages.json`, `dependencies.json`, `guides/`, `checks/`, or `resources/` for a Skin task.

A Skin may carry its own optional HTML overrides under its Skin directory. Overrides must be registered through `layoutOverrides`, preserve the exact Sheet Module set of the Base Page/Shell, and never move a module across Page/Shell boundaries.

Do not add scripts, event attributes, custom form controls, external resources, `@import`, `@font-face`, font files, or base64 assets. Images belong under `assets/skins/<skin-id>/`.

`plain` is a compatibility and troubleshooting Skin. Create a new Skin instead of redesigning `plain`.

## Verification

Run `npm test -- src/test/daggerheartCorePackage.test.ts src/domain/systemPackage.test.ts src/rendering/moduleRegistry.test.tsx` and `npm run build`. Use Author Preview for visual, responsive, overflow and print QA.
