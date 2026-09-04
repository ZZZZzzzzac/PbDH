# PbDH 当前交接

更新时间：2026-09-05

## 接手入口

当前用户请求已经完成，没有遗留的必做编码项。下一步通常是让用户在 Creator 中实际试用护甲、武器和敌人特性下拉菜单，再按反馈调整预设文本或交互。

开始新工作前：

1. 阅读根目录 `AGENTS.md` 与目标目录下的局部 `AGENTS.md`。
2. 运行 `git status --short`。工作树包含大量未提交和未跟踪改动，其中既有本轮改动，也有此前工作；全部按用户资产处理，不清理、不还原。
3. 涉及 Daggerheart Core 资源时，额外阅读 `apps/player/system-package-sources/daggerheart-core/AGENTS.md`。

完成条件：修改后先跑相关定向测试，最后跑 `npm run verify`；资源源文件发生变化时，运行 `npm run build:daggerheart-core` 重新生成两个 PBRES。

## 本轮完成内容

### 重复特性预设

- 将出现至少 4 次且内容相同或近似的特性做成 Creator 下拉预设：护甲 7 项（6 个英文原名，其中 Heavy 分成两种效果）、武器 22 项、敌人 10 项；环境按用户要求不处理。
- 下拉菜单只显示中文，不显示英文原名。选择后会一次性填写特性中文名、英文原名和描述；敌人还会填写特性类型。
- 护甲与武器只在特性描述中列出完整参数选择，例如 `<+1/2/3/4>`。敌人不枚举位阶值，使用 `<X>`、`<范围>`、`<该敌人>` 等通用占位符。
- 敌人参数化名称使用 `无情(X)`、`杂兵(X)`、`集群(X)`；英文原名保持官方格式 `Relentless (X)`、`Minion (X)`、`Horde (X)`。
- 预设权威位于 `packages/templates/src/frontend/feature-presets.ts`。`1.0.0` 与 `1.0.1` 的护甲、武器、敌人编辑器共用该目录。
- `TemplateAuthoringSurface` 新增可选的整份数据回写入口 `onData`，Creator 和 GM 桌面都已接入。这样选中预设时多个字段是一次原子更新，不会被连续的单字段更新互相覆盖。

### 特性翻译与资源数据

- 同英文名且效果相同或近似的特性译名、描述已回写 ParaTranz 权威译文；括号内参数属于正确数据，不能删除。
- 同英文名但效果明显不同且形成规模时允许不同译名。护甲的 Heavy 当前明确分为：
  - 链甲系，`闪避值 −1。`：`沉重`
  - 全板甲系，`闪避值 −2；敏捷 −1。`：`极重`
- 资源中的敌人特性描述继续保留具体敌人名称；只有下拉预设使用 `<该敌人>`。
- 英文官方原文不修改。所有人工翻译修订先回写 ParaTranz，仓库不再保留独立 override。

### 本地化字段英文残留清理

- 已遍历玩家与 GM 两个资源包的全部 `resources[].data`，修正 222 个包含非预期拉丁字母的本地化字符串；`原文`、`特性原文`、骰子记法（如 `2d8+3`）和独立变量 `X` 保留。
- 玩家包修正 41 项，GM 包修正 181 项。包括资源名称、特性名称与描述、经历、潜在敌人、动机与战术、引导问题、攻击武器及简介。
- 对照 `DaggerHeart_CN` 翻译工程确认 `Cryptimoths`/`Yufos` 使用“秘蛾/幽浮”；补译 `Dragon Bond` 为“龙之羁绊”、`Ruins` 为“遗迹”，并修复游唱乐手描述中的残损 `|item (` 标记。
- 提取器会结构化剔除 ParaTranz 译文中用于对照的英文，并在打包前对非原文字段执行拉丁字母 fail-closed 扫描。
- 定向测试会扫描两个生成包，阻止非预期拉丁字母再次进入本地化字段。

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
- 玩家包当前摘要：`sha256:1b99a2afa3fa6e7c36831bd6e3b4c1c6e24cd596b365751cc72dc17f1c6710ea`。
- GM 包当前摘要：`sha256:68ecefc68a5771bfd703952ed269499afae4dcd998aada14c793c513c6aa12c4`。
- 唯一人工维护的资源内容源是 `docs/sources/daggerheart-srd2/DH_SRD_2_2026_08_25.paratranz.json`。
- 运行时只提交 `apps/player/public/system-packages/daggerheart-core/resources/*.pbres`；临时提取 JSON、PBRES 审阅 JSON、`extraction-overrides.json` 和 `source-provenance.json` 已移除。

资源文本变化后的单一生成入口：

```powershell
npm run build:daggerheart-core
npm run verify
```

## 验证状态

最终 `npm run verify` 已通过：

- TypeScript：99 个测试文件，807 项测试。
- Python：141 项测试。
- 依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量和 Platform 生产构建全部通过。
- Python 仍有既有 FastAPI/Pydantic deprecation warnings；Vite 仍有入口 chunk 大于 500 KiB 的提示，本轮未处理。

Creator 页面可以正常加载，但浏览器本地当时没有打开的资源，因此本轮没有在真实资源编辑器里点击下拉菜单；预设内容、编辑器接线和原子更新由自动化测试覆盖。

## 关键文件

- `packages/templates/src/frontend/feature-presets.ts`：三类特性预设的单一来源。
- `packages/templates/src/frontend/authoring-primitives.tsx`：支持预设选择的共享输入控件。
- `packages/templates/src/frontend/types.ts`、`authoring-surface.tsx`：整份数据原子回写接口。
- `scripts/extract-daggerheart-srd2-resources.ts`：SRD 提取及跨记录位阶继承。
- `docs/sources/daggerheart-srd2/DH_SRD_2_2026_08_25.paratranz.json`：唯一资源内容源。
- `scripts/build-daggerheart-core-system-package.ts`：临时提取与 PBRES 构建的单一入口。
- `scripts/generate-daggerheart-core-system-package.ts`：PBRES 打包实现，不直接作为日常入口。
- `tests/templates/template-authoring-surface.test.tsx`：预设数量、中文标签与参数规则。
- `tests/player/daggerheart-core-system-package.test.ts`：武器位阶分布、Heavy 译名及生成包一致性。
- `tests/tabletop/tabletop-core.test.ts`：GM 桌面整份实例数据替换。
