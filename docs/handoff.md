# PbDH 开发交接

更新时间：2026-09-02

## 明日续接入口

- 今天最后完成的是“种族卡 footer”：每张资源拥有独立的图片作者/来源与卡牌来源/所属；作者默认空，来源默认取创建或升级当时的资源包名。实现与验证细节见下文“种族模板已完成首轮”和当前 diff。
- 下一轮优先由用户继续审阅种族 footer 的视觉尺寸与位置；确认后，再把共享 `CardFooter`、署名编辑区和空值不占位规则逐个接入其余模板，不要一次性猜测所有模板的排版。
- Resource Package `1.1.0` 当前处于 `development`，Creator、Player、PBRES 适配器已支持 1.0/1.1 双读。不要修改已发布的 `1.0.0` Schema 或 conformance 权威。
- GM 桌面使用独立的 Tabletop Document `1.0.0`，其 `resourceCopy` 尚无 `attribution`。若下一轮要求桌面副本也永久保留 footer，需显式设计 Tabletop Document 的兼容升级；不要把字段偷偷塞进 1.0.0。
- 当前工作树含整轮模板迁移及用户已有改动，未提交且不可清理。开始前先读 `AGENTS.md`、本文件和 `git status --short`。

## 本轮目标

把 11 个第一方 Resource Template 的 Creator 编辑区与卡面视觉从平台声明式通用控件迁移为模板自有的 React/HTML/CSS；“敌人”模板已经完成首轮人工审阅，其余模板已统一到敌人模板确立的首轮视觉语言。用户明确不考虑第三方模板。

## 当前结论与不可回退的边界

- 模板自己拥有编辑区结构、字段布局、控件选择和卡面 DOM/CSS；平台只挂载模板能力，不理解字段语义，也不硬编码模板 UI。
- 不再使用 OpenPencil。前端 JSX/HTML/CSS 是唯一视觉源，相关 `.op`、生成物与同步脚本已从工作树移除；`scripts/check-visual-sources.mjs` 会阻止重新引入双视觉源。
- 模板 JSON 字段结构或可输入字段集合发生兼容性变化时才需要新版本；字体、间距、颜色、布局等视觉修改不因此发布新版本。
- 11 个模板的 `1.0.0` 发布过早，当前已全部从 `published` 切回 `development`。参见：
  - `docs/adr/0066-let-trusted-templates-own-authoring-editors.md`
  - `docs/adr/0067-return-first-party-resource-templates-to-development.md`
  - `docs/adr/0068-use-frontend-code-as-the-only-visual-source.md`
- 后续视觉修改默认只能改模板。若需求只能通过平台实现，先说明原因和最小改动范围，等待用户授权。本轮用户仅额外授权了卡面模式工具栏“图+文”按钮去除定宽。

## 当前工作树

- 分支为 `main`，存在大量未提交改动；不要清理、还原或覆盖这些改动。
- `git status --short` 是当前修改清单的权威，不在本文件复制完整列表。
- 核心迁移文件位于：
  - `packages/templates/src/frontend/*/1.0.0/authoring-editor.tsx`
  - `packages/templates/src/frontend/authoring-primitives.tsx`
  - `packages/templates/src/frontend/authoring-surface.tsx`
  - `packages/templates/src/frontend/template-frontend-registry.ts`
  - `packages/templates/src/frontend/types.ts`
- 平台不再持有模板字段布局；ADR、README、roadmap 与测试已有配套修改，具体内容直接看 diff。

## 敌人模板已完成

编辑区：`packages/templates/src/frontend/adversary/1.0.0/authoring-editor.tsx`

- 位阶：`1 / 2 / 3 / 4` 下拉建议。
- 种类：`斗士 / 集群 / 头目 / 杂兵 / 远程 / 潜伏 / 社交 / 独狼 / 标准 / 辅助`。
- 范围：`近战 / 邻近 / 近距离 / 远距离 / 极远`。
- 攻击类型：`物理 / 魔法`。
- 特性类型：`动作 / 被动 / 反应`。
- 下拉入口使用 CSS 三角形，无外框；浏览器实测已经垂直居中。
- 编辑区字体与控件已放大，布局使用响应式 grid/flex，不给输入框固定宽度。
- 特性“清空”“删除”按钮与输入框均为 `34px` 高，浏览器实测上下边缘一致。
- “换卡”整栏已移除。

卡面：`packages/templates/src/frontend/adversary/1.0.0/renderer.tsx`

- 生命点、压力点的 GM 操作在卡面图标上完成；点击空心/实心图标切换状态，不再有预览工具栏。
- 生命与压力图标分别使用两套 SVG 填充状态，间距一致。
- 特性类型与名称处于同一信息组，但类型字号和颜色稍弱；英文名独立置于下方。
- 修复了标题、正文和控件文字裁切。
- “纯文字”与“图+文”共用同一 DOM；纯文字通过 `--enemy-media-height: 0px` 去掉图片区并把标题上移到卡片顶部。
- 非固定比例下：
  - 图+文保留 `568px` 原生最小高度，内容超过时增长。
  - 纯文字按实际正文内容收缩。当前浏览器样例原生高度为 `474px`，图+文为 `570px`。
  - 纯图片通过 `height: auto` 按图片自身比例撑开，不继承图文卡最小高度。
- 当前 Browser 验收资源没有设置卡图，因此纯图片“真实图片比例”只由 CSS 与测试确认，尚未在本地页面用实际图片复验。

平台工具栏的已授权例外：

- `apps/creator/src/workspace-prototype/workspace.css` 已删除第二个卡面模式按钮的 `width: 82px`。
- 浏览器实测按钮宽度：纯文字 `49px`、图+文 `44.5px`、纯图片 `49px`；均由文字宽度加左右各 `8px` 内边距决定。
- 文案“半图半文字”已改为“图+文”。

## 种族模板已完成首轮

编辑区：`packages/templates/src/frontend/ancestry/1.0.0/authoring-editor.tsx`

- 采用与敌人模板一致的暖灰底、分组容器、赭红标题、控件字号与按钮样式。
- 身份、简介、种族特性按种族字段重新布局，没有复制敌人的字段语义。
- 名称、英文、类型与简介现已合并在同一个基础信息分组卡片内；简介独占第二行，原独立简介分组已移除。
- 种族固定显示 2 个特性槽，不提供“新增”或“删除”；旧数据即使特性数组为空，编辑区也会显示两个空槽。槽内不再另设标题，名称输入标签直接为“特性1”“特性2”。
- 种族名称后新增“英文”栏，数据字段沿用敌人模板的 `原文`；每个种族特性名称后也新增“英文”栏，数据字段为 `原名`。
- 每项特性保留“清空”；操作按钮和输入框均为 `34px` 高。
- 使用响应式 grid；窄屏下字段与操作按钮改为单列。

卡面：`packages/templates/src/frontend/ancestry/1.0.0/renderer.tsx`

- 已从共享 `reference-card` 工厂迁移为种族模板自有 React/HTML/CSS，Renderer Revision 保持 `ancestry-card-r1`。
- 色调、字体层级、深褐标题区、骨色正文、赭红标题与特性分隔线沿用敌人卡的视觉语言。
- 卡面标题按“中文种族名 + 英文副标题”渲染；特性标题按“中文特性名 + 英文副名”渲染，英文使用与敌人卡一致的弱化字号和颜色层级。
- 纯文字与图+文共用同一 DOM；纯文字通过 `--ancestry-media-height: 0px` 去掉图片区。
- 图+文保留图片区；未设置卡图时显示深褐底，标题仍位于图片区下缘的信息带。
- 纯图片只渲染主图；非固定比例时按图片自身比例撑开。
- 固定比例下两项特性与简介均已在真实 Creator 页面确认无裁切。
- 已修复固定比例切换状态残留：非固定模式的 ResizeObserver 测量值不再决定固定 Frame 高度，切回固定时 Frame 强制恢复 `88px` 并复位内部原生高度。
- 纯文字 `ancestry-heading` 已改为 `74px` 高的底部对齐纵向内容流；标题自身下对齐，标题、可选英文、简介自然堆叠，标题与简介的空白状态实际间距为 `7px`。
- 右侧类型标签（如“种族”）已移入与名称相同的 `ancestry-title-row`，通过 Grid `align-items: end` 共用底边；真实 Creator 页面测得名称与类型标签底边差约 `0.00002px`，仅为浮点误差。
- 标题区与正文区交界处已加入其他卡片同款 `#b88a57` 分割线；纯图片模式不显示。真实 Creator 页面测得标题区底边与正文区顶边误差约 `0.000008px`，控制台无错误。
- 卡面正文顶部的 `ancestry-feature-heading`（“种族特性”标题及横线）已删除；编辑区的“种族特性”分组标题保留。
- 卡面字体已整体放大：主标题 `28px → 32px`、类型 `15px → 17px`、简介与顶层英文 `10px → 11.5px`、特性名 `15px → 17px`、特性英文 `9px → 10.5px`、特性正文 `11px → 12.5px`。同时微调标题区高度、特性名称列宽与内边距；真实固定比例 Creator 卡面中两项特性及正文均无横纵裁切，控制台无错误。
- 标题区已从绝对定位的固定 `80px` 高度改为正常文档流：简介不再设置 `max-height` 或隐藏溢出，内容增加时标题区自然增高。固定比例下卡片总高保持 `503px`，浏览器长简介样例中标题由 `74px` 增至 `118px`、正文由 `420px` 压缩至 `377px`；非固定比例下正文不压缩，整卡由 `333px` 增至 `377px`。媒体高度仍由 `--ancestry-media-height` 独立控制。
- 特性文字再次放大：特性名 `17px → 19px`、特性英文 `10.5px → 12px`、特性正文 `12.5px → 15px`；固定比例短简介样例中两个特性卡各占 `193px`，长简介样例中各占 `171px`，均无裁切。非固定模式已显式取消正文与特性卡的零基准 Flex 收缩，避免内容区域折叠。
- `ancestry-feature` 已从左右两列改为上下信息流：第一行是特性名与可选英文（Flex 基线对齐），描述在下一行占满宽度；英文为空时仍不生成节点。
- `ancestry-feature` 不再设置固定或最小高度，也不再伸展填满正文余量，使用 `flex: none` 按内容自然增高。真实固定比例 Creator 页面中，两个短描述特性卡各为 `106px`；临时加长第一项描述后仅该卡增至 `171px`，第二项仍为 `106px`，两者均无裁切，测试内容已恢复。
- 种族卡标题背景按模式分离：纯文字继续使用 `#251a14` 纯色并关闭遮罩；图+文让图片铺满整个图片区与自适应标题区，叠加从透明到约 `96%` 不透明的深褐渐变（比敌人卡更早、更强地变暗）并增加轻微文字阴影，避免浅色图片降低可读性。真实 Creator 页面确认纯文字遮罩 `display:none`，图+文遮罩覆盖完整 `174px` 标题图片区，模式已恢复为纯文字。
- 种族简介字号已从 `11.5px/1.3` 放大到 `14px/1.4`。真实固定比例 Creator 页面中当前两行简介高度为 `39px`、无裁切，动态标题区增至 `99px`，正文区自然调整为 `396px`。
- 固定比例种族卡已接入容器级文字拟合：两个 `ancestry-feature` 仍按各自内容自然增高，只有外层 `.ancestry-features` 的完整 `scrollHeight` 超过可用 `clientHeight` 时，才统一把两段特性描述从 `15px` 向下拟合，当前下限为 `11px`。非固定比例关闭拟合，内容或模式变化时会先恢复自然字号再重新测量。
- 拟合逻辑已下沉到 `packages/resource-renderer/src/text-fit.ts`：提供四分之一像素精度的字号搜索、容器实测、ResizeObserver/字体加载重测、自然字号恢复，以及 `natural` / `fitted` / `overflow` 状态。模板只声明受约束容器、字号范围和 CSS 变量。
- 种族卡已加入卡片级 footer。左侧为“图片作者或来源”，右侧为“卡牌来源或所属”；作者默认空，来源默认取创建该卡时的当前资源包名。两项均可逐卡编辑，纯文字/图+文位于正文下缘，纯图片使用底部渐变叠层。
- footer 的持久化不放进种族 Template 数据，而是进入 Resource Package `1.1.0` 的通用 `attribution`：`artworkCredit` 与 `sourceLabel`。这样署名会随单卡复制、PBRES 导出/导入保留，后续其他模板可直接复用共享 `CardFooter`，无需污染各模板字段。
- 旧 `1.0.0` 资源包继续可读；首次新增资源、编辑署名或导出时升级到 `1.1.0`，并为旧卡补 `{ artworkCredit: "", sourceLabel: 当前资源包名 }`。Player、Creator 与 PBRES 转换链路均支持 1.0/1.1 双读。

## 其余模板已完成视觉统一

编辑区：

- `packages/templates/src/frontend/standard-editor-styles.ts` 已统一到敌人编辑区的暖灰底、分组边框、赭红标题、控件间距、按钮尺寸与交互反馈。
- 护甲、社群、领域卡、物品、职业、子职业、武器继续各自拥有字段结构，只消费统一的视觉基线。
- 环境与自由是本轮剩余模板中仅有的可变数量内容结构；两者均提供新增、清空、删除与删除确认。
- 已审阅的敌人模板保持原状，不在本轮回退其可变特性行为。

卡面：

- 11 个第一方 Renderer 均使用敌人卡确立的骨色 `#eee4d0`、赭红 `#641f1d`、深褐标题区与 `Noto Sans SC` 字体语言。
- 通用参考卡视觉基线已覆盖社群、领域卡、物品、职业、子职业；各模板仍按自己的数据模型组合标题、属性、效果与风味描述。
- 护甲、环境、自由的独立 Renderer 已从原灰绿/浅色方案调整为同一暖色语言；武器原本已接近敌人方案，本轮保持其既有结构。
- 固定比例、非固定比例、文字、图+文、纯图片模式的既有功能保持不变。

## 英文字段的全模板规则

- 英文字段统一作为可选信息：当前敌人、种族、环境的顶层 `原文` 与特性 `原名` 已从 Schema 必填项中移除；默认数据仍提供空字符串，编辑器可直接填写。
- 空字符串、纯空白和字段完全缺失均视为“无英文”；Renderer 不生成对应英文 DOM，因此不会留下空行或占位高度。
- 敌人与种族的绝对定位标题区只有在英文存在时才启用 `has-original-title` 间距；无英文时简介从原英文位置自动上移。敌人特性的空英文 `<small>` 也不再生成。
- 环境卡原本使用文档流和条件渲染，本轮补强为纯空白同样不渲染。
- 后续为其他模板增加英文字段时必须沿用此规则，不得为可选英文预留固定空位。

## 验证状态

- 本轮新增种族与种族特性英文栏后的定向验证通过：`tests/templates/ancestry-template.test.ts` 与 `tests/resource-conversion/resource-conversion.test.ts`，共 59 项测试。
- 英文字段可选与空值收缩的定向验证通过：敌人、种族、环境共 5 个测试文件、36 项测试；TypeScript 类型检查通过。
- 种族 Frame 高度回归测试覆盖残留 `568px` 非固定测量值下固定模式仍输出 `88px`；真实 Creator 页面复验固定 `88px` → 非固定 `99.4px` → 固定 `88px`，卡面本体同步从 `498px` → `563px` → `498px`。
- Kid、DHSHEET 与 ZZZ 不提供对应英文栏，导入时统一补为空字符串；PBRES 仍可原样保存新增字段，模板映射不丢失字段。
- 已重启本地服务并在真实 Creator 页面完成有/无英文对照：敌人与种族有英文时标题区带 `has-original-title`，简介位置为 153px；英文清空或只含空白后英文节点消失、简介上移至 138px，特性英文节点数量归零，控制台无错误。
- 先前英文栏 Browser 验收使用的测试资源均保持英文字段为空；本地 IndexedDB 内容仅作手工验收状态，不作为实现权威。
- 最新 `npm run verify` 通过：
  - TypeScript：97 个测试文件、702 项测试。
  - Python：141 项测试。
  - 依赖边界、Contract release、唯一视觉源检查、类型检查、Renderer 性能测量与 Platform 构建均通过。
- `git diff --check` 通过；输出只有现有 CRLF/LF 提示。
- Python 仍输出既有 Pydantic/FastAPI deprecation 警告；Platform 构建仍有入口 chunk 大于 500 KiB 的提示，本轮未处理。
- 已重新运行 `node scripts/restart-dev.mjs`，Backend `8001` 与 Platform `5173` 均为 `OK`。真实 Creator 页面当前短内容的种族特性拟合状态为 `natural`，两段描述均保持 `15px`，容器 `clientHeight` 与 `scrollHeight` 均为 `368px`，控制台无错误；未为验收改动现有资源内容。
- footer 真实页面验收通过：新建种族卡时“图片作者或来源”为空、“卡牌来源或所属”为“新资源包”；临时填写 `Anthony Jones` / `DH Core 061/270` 后卡面左右两端即时更新，随后已恢复空作者与默认来源。footer 两列实测左侧 `text-align:start`、右侧 `text-align:right`，控制台无错误。验收新增了一个“未命名种族”本地测试资源，没有删除现有资源。

## 下一步建议

1. 等用户审阅种族 footer；有视觉反馈时只调整共享 footer 或种族适配层中实际相关的部分。
2. 用户确认后，将 footer 逐个应用到敌人和其余模板；署名仍属于 Resource，不得复制进每个 Template 的 `data`。
3. 若用户要求 GM 桌面副本持久化署名，先升级 Tabletop Document Contract 并补导入、导出、Repository 与桌面 Renderer 回归测试。
4. 每个模板完成后运行对应定向测试与真实 Creator 页面验收；整轮结束执行 `npm run verify` 和 `git diff --check`。

## Suggested skills

- `$ui-ux-pro-max`：实现或审查每个模板的布局、控件尺寸与视觉细节。
- `$browser:control-in-app-browser`：必须用于真实 Creator 页面截图、DOM 和像素尺寸验收。
- `$diagnosing-bugs`：仅在出现裁切、错误高度、状态不同步或测试失败时进入诊断循环。
- `$code-review`：整轮模板迁移完成后审查边界、测试与无关改动。
- `$handoff`：下一轮结束时更新本文件。

## 操作提醒

- 遵守根目录 `AGENTS.md`；默认中文沟通。
- 完整验证入口是 `npm run verify`。
- 不得直接删除文件；需要清理时移入回收站。
- 不修改 `.env`、密钥、CI/CD、数据库 schema，不执行 push/rebase/reset。
- Browser 插件与本地开发服务当前可用；不要改用临时 Playwright 服务。
