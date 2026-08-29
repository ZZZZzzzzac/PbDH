# daggerheart-core Author Rules

## 当前目录边界（优先于下方迁移期规则）

- 本目录现在只保留可编辑的资源 JSON、迁移清单和来源说明。
- Player 正式运行目录是 `apps/player/public/system-packages/daggerheart-core/`；页面、布局、皮肤、检查和运行时界面资产只在那里维护。
- 卡图与卡背已经装入正式 `.pbres`，不再保留散装 `assets/cards/**` 副本。
- 修改资源文本后运行 `scripts/generate-daggerheart-core-system-package.ts`；生成器从现有 `.pbres` 复用媒体。
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
