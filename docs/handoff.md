# PbDH 当前交接

更新时间：2026-09-04

## 接手入口

当前用户请求已经完成，没有遗留的必做编码项。下一步通常是让用户在 Creator 中实际试用护甲、武器和敌人特性下拉菜单，再按反馈调整预设文本或交互。

开始新工作前：

1. 阅读根目录 `AGENTS.md` 与目标目录下的局部 `AGENTS.md`。
2. 运行 `git status --short`。工作树包含大量未提交和未跟踪改动，其中既有本轮改动，也有此前工作；全部按用户资产处理，不清理、不还原。
3. 涉及 Daggerheart Core 资源时，额外阅读 `apps/player/system-package-sources/daggerheart-core/AGENTS.md`。

完成条件：修改后先跑相关定向测试，最后跑 `npm run verify`；资源源文件发生变化时，JSON 审阅副本与 PBRES 必须重新生成并保持一致。

## 本轮完成内容

### 重复特性预设

- 将出现至少 4 次且内容相同或近似的特性做成 Creator 下拉预设：护甲 7 项（6 个英文原名，其中 Heavy 分成两种效果）、武器 22 项、敌人 10 项；环境按用户要求不处理。
- 下拉菜单只显示中文，不显示英文原名。选择后会一次性填写特性中文名、英文原名和描述；敌人还会填写特性类型。
- 护甲与武器只在特性描述中列出完整参数选择，例如 `<+1/2/3/4>`。敌人不枚举位阶值，使用 `<X>`、`<范围>`、`<该敌人>` 等通用占位符。
- 敌人参数化名称使用 `无情(X)`、`杂兵(X)`、`集群(X)`；英文原名保持官方格式 `Relentless (X)`、`Minion (X)`、`Horde (X)`。
- 预设权威位于 `packages/templates/src/frontend/feature-presets.ts`。`1.0.0` 与 `1.0.1` 的护甲、武器、敌人编辑器共用该目录。
- `TemplateAuthoringSurface` 新增可选的整份数据回写入口 `onData`，Creator 和 GM 桌面都已接入。这样选中预设时多个字段是一次原子更新，不会被连续的单字段更新互相覆盖。

### 特性翻译与资源数据

- 同英文名且效果相同或近似的特性译名、描述通过 `extraction-overrides.json` 统一；括号内参数属于正确数据，不能删除。
- 同英文名但效果明显不同且形成规模时允许不同译名。护甲的 Heavy 当前明确分为：
  - 链甲系，`闪避值 −1。`：`沉重`
  - 全板甲系，`闪避值 −2；敏捷 −1。`：`极重`
- 资源中的敌人特性描述继续保留具体敌人名称；只有下拉预设使用 `<该敌人>`。
- 英文官方原文不修改。所有人工翻译修订都放在 `apps/player/system-package-sources/daggerheart-core/extraction-overrides.json`，同时记录提取器旧输出 `expected`，保持上游变化时 fail-closed。

### 武器位阶提取修复

- 原问题：位阶 1 主武器显示 178 个。
- 根因：ParaTranz 源把部分位阶标题和武器表拆到相邻记录。旧提取器只搜索当前记录，找不到标题时默认位阶 1，导致位阶 2–4 的表被归入位阶 1。
- `scripts/extract-daggerheart-srd2-resources.ts` 现在跨记录继承最近的位阶标题，同时仍允许同一记录内的新标题覆盖继承值。
- 当前武器数量为：

| 位阶 | 主武器 | 副武器 |
| --- | ---: | ---: |
| 1 | 38 | 13 |
| 2 | 68 | 20 |
| 3 | 60 | 20 |
| 4 | 68 | 20 |

- 总武器数仍为 307。回归测试锁定上述完整分布，防止再次把跨记录表格归入位阶 1。

## 资源生成状态

- Daggerheart Core 玩家资源包版本：`1.0.19`。
- 玩家资源：956；GM 资源：311。
- 玩家包当前摘要：`sha256:d089eb844f556c8a489c624c1d13b0d22112fd728e1b9dfad0aa85af38bc22e1`。
- GM 包当前摘要：`sha256:cfff683dedab685991322866ac2f99c36a9e3d47a2d001b918cf587d05d47a55`。
- 已更新：
  - `apps/player/system-package-sources/daggerheart-core/resources/*.json`
  - `daggerheart-core-player.resource-package.json`
  - `daggerheart-core-gm.resource-package.json`
  - `apps/player/public/system-packages/daggerheart-core/resources/*.pbres`
  - `apps/player/src/daggerheart-core-preset.generated.json`

资源文本或提取覆盖变化后的执行顺序：

```powershell
npx tsx scripts/extract-daggerheart-srd2-resources.ts
npx tsx scripts/generate-daggerheart-core-system-package.ts
npm run verify
```

## 验证状态

最终 `npm run verify` 已通过：

- TypeScript：99 个测试文件，806 项测试。
- Python：141 项测试。
- 依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量和 Platform 生产构建全部通过。
- Python 仍有既有 FastAPI/Pydantic deprecation warnings；Vite 仍有入口 chunk 大于 500 KiB 的提示，本轮未处理。

Creator 页面可以正常加载，但浏览器本地当时没有打开的资源，因此本轮没有在真实资源编辑器里点击下拉菜单；预设内容、编辑器接线和原子更新由自动化测试覆盖。

## 关键文件

- `packages/templates/src/frontend/feature-presets.ts`：三类特性预设的单一来源。
- `packages/templates/src/frontend/authoring-primitives.tsx`：支持预设选择的共享输入控件。
- `packages/templates/src/frontend/types.ts`、`authoring-surface.tsx`：整份数据原子回写接口。
- `scripts/extract-daggerheart-srd2-resources.ts`：SRD 提取及跨记录位阶继承。
- `apps/player/system-package-sources/daggerheart-core/extraction-overrides.json`：人工审阅的翻译修订。
- `scripts/generate-daggerheart-core-system-package.ts`：JSON 审阅副本与 PBRES 生成入口。
- `tests/templates/template-authoring-surface.test.tsx`：预设数量、中文标签与参数规则。
- `tests/player/daggerheart-core-system-package.test.ts`：武器位阶分布、Heavy 译名及生成包一致性。
- `tests/tabletop/tabletop-core.test.ts`：GM 桌面整份实例数据替换。
