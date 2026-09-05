# PbDH 当前交接

更新时间：2026-09-05

## 接手入口

当前用户请求已实现：Player 会把没有专用入口的非空资源库统一归入“其他资源库”，`自由@1.0.1` 支持任意普通字符串字段和自由特性。下一步通常是继续按实际使用反馈调整资源浏览与编辑体验。

开始新工作前：

1. 阅读根目录 `AGENTS.md` 与目标目录下的局部 `AGENTS.md`。
2. 运行 `git status --short`。工作树包含大量未提交和未跟踪改动，其中既有本轮改动，也有此前工作；全部按用户资产处理，不清理、不还原。
3. 涉及 Daggerheart Core 资源时，额外阅读 `apps/player/system-package-sources/daggerheart-core/AGENTS.md`。

完成条件：修改后先跑相关定向测试，最后跑 `npm run verify`；资源源文件发生变化时，运行 `npm run build:daggerheart-core` 重新生成内置玩家 PBRES 与 `docs/third` 下的 GM PBRES。

## 本轮完成内容

### 野兽形态资源

- 玩家资源包新增 SRD 2.0 `SRD2_SECTION_73–100` 中的 24 个野兽形态选项，每个位阶 6 个。
- 每个形态是独立的 `自由@1.0.1` 资源，统一位于 `野兽形态/`；`类型` 固定为 `野兽形态`，动物示例去掉包裹括号后放在简介，`位阶`、`属性`、`闪避`、`武器`、`优势` 使用自由字段，各项特性按原顺序放入 `内容`。
- 数据直接从仓库内 ParaTranz 快照提取，没有新增副本或 override；英文形态名与特性名仅保存在自由模板允许的 `原文` 字段中。

### Player 其他资源与自由模板

- Player 不再只识别 ID 为“其他”或扩展资源库：凡是非空且没有被系统专用入口引用的资源库，都会自动出现在“其他资源库”中。匕首心玩家包的野兽形态、敌人和环境因此均可从该入口使用。
- `自由@1.0.1` 的固定字段为 `名称`、`原文`、`类型`、`简介`、`内容`；除此以外允许任意顶层字符串字段。`内容` 仍是严格的自由特性数组，每项只含 `名称`、`原文`、`描述`。
- Creator 编辑器新增“自由字段”和“自由特性”两个区域，均支持新增、清空和删除；卡面会在特性前以紧凑标签显示非空自由字段，全文搜索也会索引自由字段名和值。
- Player 的“其他资源库”表格只展示资源 JSON 顶层的标量字段，不再把 `内容`、`特性`及其兼容投影展开为大量表格列。

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

- 除 Daggerheart Core 外，内置系统包的 `resources/*.pbres` 已成为资源内容唯一权威源；旧资源 JSON 与 JSON→PBRES 生成脚本已移除。卡片工坊负责小规模编辑和重新导出。
- 替换非 Daggerheart PBRES 后运行 `npm run sync:builtin-system-packages`。该命令只读取 PBRES 并同步 preset、System Package 副本和运行时文件清单，不会写入 PBRES；`npm run check:builtin-system-packages` 是只读一致性检查并已接入统一验证。
- TTTRI 暂时保留 `apps/player/src/tttri-legacy-resources.generated.json`，只补充当前 PBRES 缺失但人物卡仍依赖的系统专属字段（默认种族经历、武器原型等）；PBRES 字段优先。彻底移除它需要先把这些字段迁入 TTTRI PBRES。

- Daggerheart Core 玩家资源包版本：`1.0.24`；GM 资源包版本：`1.0.5`。
- 玩家资源：980；GM 资源：311。
- 玩家包当前摘要：`sha256:8a6827ea5865018fe873d53fb7a8a042b6406ad1b082a9be0571a3f25e19ebb3`。
- GM 包当前摘要：`sha256:477b58e17cf1a3fe673356b91e1a43fff73e4390aed1f24f240612293b555dcb`。
- 匕首心系统包只原生安装玩家包 `resources/daggerheart-core.pbres`；GM 包不再出现在系统包目录、`embeddedResources` 或内置资源索引中，独立存放于 `docs/third/daggerheart-core-gm.pbres`。
- 玩家包目录已扁平化：每个领域的 21 张领域卡直接位于 `领域卡/{领域}/`，武器使用 `武器/{主武器|副武器}/位阶N/`。
- GM 包的 21 个集群敌人统一位于各位阶下的 `集群/` 文件夹，`种类` 统一为无空格、半角括号的 `集群(N/生命点)`。
- Creator 与 GM 共用的资源搜索支持 `[模板:敌人] [位阶:4] [种类:独狼]` 标签语法；除保留键 `模板` 外，筛选键和值直接来自资源 `data` 顶层字段，不要求模板声明。标签值使用包含匹配，例如 `[种类:集群]` 可命中 `集群(3/生命点)`。搜索框聚焦后会从当前模板编辑器的 `input` 自动识别字段并显示字段/值提示，`textarea` 不进入候选；原独立模板筛选器已移除。
- Creator 的导入、导出按钮均提供 PBRES、ZZZ、Rink、dhsheet 与不咕鸟格式菜单；PBRES 作为原生格式使用强调态，第三方格式保持普通菜单项。第三方导出经过共享 Adapter，无法完整表达时只显示转换报告，不下载部分产物。
- 唯一人工维护的资源内容源是 `docs/sources/daggerheart-srd2/DH_SRD_2_2026_08_25.paratranz.json`。
- 运行时只提交 `apps/player/public/system-packages/daggerheart-core/resources/daggerheart-core.pbres`；临时提取 JSON、PBRES 审阅 JSON、`extraction-overrides.json` 和 `source-provenance.json` 已移除。

资源文本变化后的单一生成入口：

```powershell
npm run build:daggerheart-core
npm run verify
```

## 验证状态

最终 `npm run verify` 已通过：

- TypeScript：102 个测试文件，832 项测试。
- Python：141 项测试。
- 依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量和 Platform 生产构建全部通过。
- Python 仍有既有 FastAPI/Pydantic deprecation warnings；Vite 仍有入口 chunk 大于 500 KiB 的提示，本轮未处理。

已在真实本地页面完成资源选择器验收。当前匕首心系统包不再内置 GM 资源，因此 Player 的“其他资源库”默认只包含没有专用入口的玩家资源；子职特性显示在“描述”列；野兽形态表格显示顶层自由字段，并将结构化自由特性合并到一个可读的“特性”列；武器与护甲的空特性不再残留冒号，既有存档中的孤立冒号也会在载入时清理。

职业资源选择器会把结构化职业特性投影为可读的“特性”列。Resource Composer 生成的纯血种族直接继承来源种族的精确模板、卡面与媒体；混血种族生成同一精确种族模板的结构化资源副本，因此两者在玩家桌面都由种族规范渲染器呈现，而不是退回 Player 通用文本卡。

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
