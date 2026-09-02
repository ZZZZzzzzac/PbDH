# PbDH 开发交接

更新时间：2026-09-02

## 明日续接入口

- 已将种族卡确认的字体、可选英文、footer、内容自然增长与固定比例文字拟合能力同步到其余 10 个模板，并完成用户提出的四项修正：纯图无 footer、全模板署名编辑、图文标题压在图片下缘、短效果不误缩。
- 全模板标题区留白已按种族/社群统一：360px 原生画布使用上下 `10px`、左右 `14px`；武器按 `.175` 比例换算，敌人标题定位使用等价边距。
- 用户截图确认武器与其他模板的差异来自整套微型画布视觉，而非仅是图片区；武器已迁移到与护甲相同的 `360×502.857 → 63×88` 大画布 Frame，并统一标题、数据行、特性卡与 footer 尺度。完整自动验证已通过，真实 Creator 复验因 Browser 控制进程失效而待 Codex 重启后完成。
- Resource Package `1.1.0` 当前处于 `development`，Creator、Player、PBRES 适配器已支持 1.0/1.1 双读。不要修改已发布的 `1.0.0` Schema 或 conformance 权威。
- GM 桌面使用独立的 Tabletop Document `1.0.0`，其 `resourceCopy` 尚无 `attribution`。若下一轮要求桌面副本也永久保留 footer，需显式设计 Tabletop Document 的兼容升级；不要把字段偷偷塞进 1.0.0。
- 当前工作树含本轮武器整体视觉迁移、对应回归测试与交接更新，未提交且不可清理。开始前先读 `AGENTS.md`、本文件和 `git status --short`。

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

- 分支为 `main`；当前未提交改动包括武器 Renderer/Markdown、对应武器与共享预览回归测试、本交接文件，不要清理、还原或覆盖。
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
- 种族卡已加入卡片级 footer。左侧为“图片作者或来源”，右侧为“卡牌来源或所属”；作者默认空，来源默认取创建该卡时的当前资源包名。两项均可逐卡编辑，纯文字/图+文位于正文下缘；纯图片不额外渲染 footer，因为完整卡图通常已经自带署名。
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
- 护甲、环境、自由、武器的独立 Renderer 已调整为同一暖色语言；图+文模式不再使用“独立标题栏—图片—正文”的割裂结构，标题与类型位于图片下缘渐变区。
- 固定比例、非固定比例、文字、图+文、纯图片模式均保留；所有模板纯图片模式都不额外渲染 footer。

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
  - TypeScript：98 个测试文件、729 项测试。
  - Python：141 项测试。
  - 依赖边界、Contract release、唯一视觉源检查、类型检查、Renderer 性能测量与 Platform 构建均通过。
- `git diff --check` 通过；输出只有现有 CRLF/LF 提示。
- Python 仍输出既有 Pydantic/FastAPI deprecation 警告；Platform 构建仍有入口 chunk 大于 500 KiB 的提示，本轮未处理。
- 已重新运行 `node scripts/restart-dev.mjs`，Backend `8001` 与 Platform `5173` 均为 `OK`。真实 Creator 页面当前短内容的种族特性拟合状态为 `natural`，两段描述均保持 `15px`，容器 `clientHeight` 与 `scrollHeight` 均为 `368px`，控制台无错误；未为验收改动现有资源内容。
- footer 真实页面验收通过：新建种族卡时“图片作者或来源”为空、“卡牌来源或所属”为“新资源包”；临时填写 `Anthony Jones` / `DH Core 061/270` 后卡面左右两端即时更新，随后已恢复空作者与默认来源。footer 两列实测左侧 `text-align:start`、右侧 `text-align:right`，控制台无错误。验收新增了一个“未命名种族”本地测试资源，没有删除现有资源。

## 下一步建议

1. 等用户逐个审阅其余模板的实际视觉；有反馈时只调整共享基线或对应模板适配层中实际相关的部分。
2. footer 已覆盖 11 个模板；署名继续属于 Resource，不得复制进每个 Template 的 `data`。
3. 若用户要求 GM 桌面副本持久化署名，先升级 Tabletop Document Contract 并补导入、导出、Repository 与桌面 Renderer 回归测试。
4. 每个模板完成后运行对应定向测试与真实 Creator 页面验收；整轮结束执行 `npm run verify` 和 `git diff --check`。

## 其余 10 个模板同步种族共性能力

- 已将种族卡确认的共性能力同步到敌人、护甲、社群、领域卡、环境、自由、物品、职业、子职业、武器：更大的标题/效果文字层级、可选顶层英文、共享 `CardFooter`、非固定比例自然增高、固定比例容器实测与自动缩字。
- 社群的单个特性与自由模板的具名内容块新增可选 `原名`；护甲、武器已改为独立的 `特性名`、可选 `特性原名`、`特性描述`，Template、Renderer 与转换映射不再解析旧 `描述` 字符串。
- 领域卡、物品、子职业等整卡本身就是具名能力的模板，顶层 `原文` 同时承担卡名/能力名英文，不另造重复的特性名称字段。职业的“希望特性”“职业特性”等固定栏目不增加不可编辑的英文标题字段。
- 英文空值规则保持不变：空字符串、纯空白、字段缺失均不渲染、不占位；旧格式导入缺少英文时保持字段缺失，不为兼容数据强行注入空键。Creator 新建资源的默认数据仍提供空英文输入栏。
- `packages/templates/src/frontend/reference-card/renderer-factory.tsx` 统一承载社群、领域卡、物品、职业、子职业的英文、footer、自然内容流与固定比例拟合；敌人、护甲、环境、自由、武器各自在模板自有 Renderer 中接入相同行为。
- 新增共享 `TextFitContainer`，复用 `useContainerTextFit` 的四分之一像素测量逻辑；非固定比例关闭拟合并恢复自然字号。敌人和环境通常使用非固定比例，固定比例只保留极限兜底。
- Browser 验收发现并修复跨资源包同 ID 切换时的运行状态串用：`TemplateRuntimePreview` 现在用 `package.id + resource.id + template.id + version` 作为组件身份，环境卡不再继承敌人的 HP/压力状态并报 `renderer.state.invalid`。
- 真实 Creator 页面验收：环境卡非固定比例正文保持 `15px`，卡片、正文 `clientHeight === scrollHeight`，footer 正常；护甲固定比例短内容保持自然 `15px`，顶层英文、特性英文与 footer 均渲染，无横纵溢出；控制台无错误。
- 为浏览器验收在本地“环境 Template 验收包”新增了“铁木甲”测试资源，未删除。
- 新增 `tests/renderer/shared-template-capabilities.test.tsx`，覆盖其余 10 个模板的顶层英文与 footer，并覆盖社群/自由的具名效果英文和拟合样式声明。
- Creator 的 `ResourceAttributionEditor` 已从种族专属条件中移出，所有模板编辑区都显示“卡面署名”；署名仍保存在 Resource `attribution`，没有复制进模板数据。
- 11 个 Renderer 的纯图片分支均不生成 `CardFooter`；回归测试覆盖种族及其余 10 个模板。真实 Creator 页面中护甲纯图片 Shadow DOM 的 footer 数量为 `0`。
- 社群、领域卡、物品、职业、子职业共用的 `reference-card` 已改为种族式画布：图文标题位于图片下缘的渐变信息区。护甲、环境、自由与武器也使用相同结构，不再把图片夹在独立标题栏和正文之间。
- 自动缩字只测量真实效果容器：参考卡测 `.reference-card-sections`，护甲测 `.armor-effects`，环境测 `.environment-features`，武器测 `.weapon-description`；统计块、简介和弹性空白不参与判定。非固定比例继续关闭拟合并自然增长。
- 真实 Creator 页面新增本地回归资源“领域短效果验收”：固定比例短描述实测为 `15px`、`data-text-fit="natural"`，效果容器 `clientHeight === scrollHeight === 376`；图文标题位于图片区下缘。护甲短特性同样保持 `15px` 和 `natural`。
- 社群编辑器基础信息卡已改为三行：名称/英文/类型同处第一行，性格独占第二行，简介独占第三行。共享 `EditorTextarea` 现已统一为单行 `34px` 起步并随内容自增高，因此全部 11 个模板的多行编辑框都采用相同行为；社群真实页面输入两行内容后，性格、简介、特性描述均自然增至 `51px` 且无内部滚动条。
- 社群卡不再把性格作为标题区标签；性格现在是正文区第一个标准特性块，标题固定为“性格”，其后才是原社群特性。真实页面确认标题区不存在 `.reference-card-meta`，正文特性顺序为“性格”→“高人一等”。浏览器验收新增本地资源“高城之民”，未删除现有数据。
- 11 个第一方模板的特性标题现已统一带 `#b88a57` 装饰横线：参考卡族、护甲、环境、自由原本已有；本轮补齐种族、敌人和武器。种族横线在中文/英文特性名后弹性延伸；武器用标题尾部横线替换旧 `<hr>`；敌人保持紧凑双栏，横线从标题列右侧延伸到卡片右缘并给正文留出 `10px` 顶部空间。真实页面无裁切，错误/警告日志为空；浏览器验收新增本地“未命名种族”和“未命名武器”资源，未删除现有数据。

## Suggested skills

- `$ui-ux-pro-max`：实现或审查每个模板的布局、控件尺寸与视觉细节。
- `$browser:control-in-app-browser`：必须用于真实 Creator 页面截图、DOM 和像素尺寸验收。
- `$diagnosing-bugs`：仅在出现裁切、错误高度、状态不同步或测试失败时进入诊断循环。
- `$code-review`：整轮模板迁移完成后审查边界、测试与无关改动。
- `$handoff`：下一轮结束时更新本文件。

## 护甲标题、图文结构与卡图删除

- 护甲标题已改为单行“名称 / 位阶 + 类型”，英文名继续位于下一行；武器卡存在相同的位阶独占一行问题，也同步改为“名称 / 位阶 + 类型”。
- 重新核对了 11 个模板的图文结构：统一规则是卡图从卡牌上边沿延伸到标题/正文分界，标题位于图片下缘并使用深色透明渐变；纯文字不保留图片区。种族、敌人和共享参考卡用标题嵌套图片区实现，护甲、环境、自由用绝对定位标题覆盖图片区，武器在图片区内嵌标题，行为一致。
- 没有采用“纯文字与图文共用同高标题背景”的错误方案；图文模式仍会在标题上方增加真实图片区。
- 浏览器审计发现武器卡的 63×88 原生小画布错误继承了按大画布容器宽度计算的共享 footer 尺寸，footer 挤压正文并让图文特性文字从自然 `2.1px` 降到 `1.5px` 下限。武器 Renderer 已覆盖为原生尺寸 footer；真实页面中纯文字与图文现均为 `natural / 2.1px`。护甲“铁木甲”两种模式均保持 `natural / 15px`。
- Creator 预览底栏在已有卡图时显示“替换”和“删除卡图”；删除命令复用现有 `removePortrait`，清空当前资源引用，并只在媒体不再被其他资源使用时移除包内资产。无卡图时仍只显示“添加”。
- 定向验证通过：TypeScript 类型检查，以及护甲、武器、共享模板能力、Creator Workspace 共 4 个测试文件、94 项测试。完整 `npm run verify` 通过：TypeScript 98 个文件、730 项测试，Python 141 项测试，依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量与 Platform 构建均通过。

### 大画布 Renderer 缺少规范缩放框架

- 用户带实际卡图复验后发现：护甲图文模式虽然外框仍是 63:88，但标题、数值和正文整体比纯文字小，视觉上像图片把卡牌撑宽。随后将 Creator `.card-scale` 直接锁为 `63px` 的修法又让 360px 原生护甲画布未经缩放塞进 63px 外层，产生巨大文字和横向裁切；该方案已撤回。
- 规范 `63×88` 的尺寸现在由各 Renderer 自己承担，不由 Creator 的 AutoFit 外层承担。Creator `.card-scale` 恢复为 `width:max-content; height:max-content`；护甲、环境、自由三个仍使用 360px 大画布的 Renderer 已补上 `63×88` Frame，内层固定 `360×502.857px` 并以 `.175` 等比缩放。
- 护甲、环境、自由的非固定比例模式使用 `ResizeObserver` 测量内层自然高度；Frame 宽度仍为 `63px`，高度按 `nativeHeight × .175` 增长。种族、敌人、共享参考卡原本已有同类 Frame，武器原生就是 `63×88` 小画布，不需要重复套缩放层。
- `tests/renderer/shared-card-preview-regressions.test.ts` 新增失败后转绿的回归测试，同时约束 Creator 外层与三个大画布 Renderer 的缩放责任。定向验证通过：4 个测试文件、91 项测试，TypeScript 类型检查通过。
- 真实 Creator 页面中护甲纯文字/图文均测得：Frame `63×88px`、内层 `360×503px`、transform `.175`、标题 `36px`、数值 `28px`；两种模式都没有横向溢出，控制台无警告或错误，模式已恢复为纯文字。
- 修正后的完整 `npm run verify` 通过：TypeScript 98 个文件、731 项测试，Python 141 项测试，依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量与 Platform 构建均通过。`git diff --check` 通过，仅输出既有换行符提示。

### Creator 预览统一宽度与长卡滚动

- `AutoFitPreview` 不再用卡牌实际高度参与缩放，否则非固定比例卡会随着内容增长不断缩小。所有固定/非固定比例与纯文字/图文/纯图模式现在使用同一参考宽度。
- 预览宽度同时受预览区宽度与标准 `63:88` 卡牌完整可见高度约束：固定比例卡保证在一个预览窗口内完整显示；非固定比例卡沿用相同宽度，超出窗口的部分通过预览区纵向滚动查看。
- 新增按缩放后宽高占位的 `card-scale-slot`，解决 CSS transform 不参与文档流尺寸的问题；预览舞台改为纵向滚动并保留稳定滚动条槽，短卡继续居中，长卡顶部和底部均可到达。
- 回归测试覆盖不再存在实际高度缩放、标准比例高度约束、缩放占位层和纵向滚动样式。真实 Creator 页面中固定比例“伤痕牛头人”为 `244×340px`、无需滚动；非固定比例保持 `244px` 宽、增至 `464px` 高，预览区产生 `26px` 可滚动范围并已滚动到底，控制台无警告或错误，验收后恢复图文与固定比例状态。
- 完整 `npm run verify` 通过：TypeScript 98 个文件、732 项测试，Python 141 项测试，依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量与 Platform 构建均通过。

### 全模板标题拟合、装备结构化特性与系统包重建

- 11 个第一方 Renderer 的主标题已统一接入单行实测拟合。`text-fit.ts` 新增 `axis: "inline"`，标题只检查横向宽度，不再因中文字形的 `scrollHeight` 多出数像素而把短标题误降到最小字号；正文容器仍继续检查宽高双轴。
- 各模板保留自己的自然字号，并降低长标题的最小字号下限。真实 Creator 页面中“铁木甲”为 `36px / natural`；“埃伦德里昂的远古守护者重型魔法防护链甲”为 `10.75px / fitted`，`scrollWidth=204`、`clientWidth=203`，满足 1px 测量容差且不再截断。
- 护甲、武器 `1.0.0` Development Schema 已删除旧 `描述`，改为必填 `特性名`、`特性描述` 与可选 `特性原名`；顶层可选英文继续使用 `原文`。编辑器直接显示“特性名 / 英文 / 特性描述”，Renderer 直接读取这些字段，没有运行时正则或旧字段拆分兼容。
- Daggerheart Core 与 TTTRI 的作者源 JSON 已改为结构化装备字段；生成器只逐字段复制。Player 的武器/护甲依赖规则改为组合 `{{特性名}}：{{特性描述}}`，避免选择装备后读取已删除的 `描述`。
- 已重新运行全部系统包生成器：Daggerheart Core、Heart of Hopefind、How's My Driving、TTTRI、Witchy。后三者内容未受模板字段影响，因此重建后字节未变化；Daggerheart Core 和 TTTRI 的 `.pbres` 已更新。
- PBRES 自动检查结果：Daggerheart Core 共 625 个资源、226 个护甲/武器；TTTRI 共 682 个资源、34 个护甲；两包全部装备均包含 `特性名`、`特性描述`，旧 `描述` 数量为 0。其余三包没有护甲/武器资源。
- 更新了 Resource Package conformance JSON/PBRES、Market/Player 物化、发布校验和系统包加载测试，防止旧字段重新进入生成物。
- 真实页面新建了本地验收资源“埃伦德里昂的远古守护者重型魔法防护链甲”，字段为“防护 / 空英文 / 受魔法伤害时，在计算伤害阈值前按护甲值减免伤害。”；该资源只存在浏览器 IndexedDB，未删除。
- 最新 `npm run verify` 通过：TypeScript 98 个文件、735 项测试；Python 141 项测试；依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量和 Platform 构建均通过。`git diff --check` 通过，仅有既有换行符提示。
- 已运行 `node scripts/restart-dev.mjs`，Backend `8001` 与 Platform `5173` 均为 `OK`。

### Player 装备选择器白屏修复

- 白屏直接原因不是卡面副本丢字段，而是 Daggerheart `modules.json` 的五个武器/护甲 Picker 仍声明旧列 `描述`。资源表把不存在的字段值 `undefined` 传给 Restricted Markdown，随后在下划线强调规范化时调用 `.replace()` 崩溃。
- 主武器、副武器、两处备用武器和护甲 Picker 已统一改为显示 `特性名`、`特性描述`；Dependencies 原有的 `{{特性名}}：{{特性描述}}` 保持不变。
- 共享 Restricted Markdown 增加运行时空值保护：缺失字段按空文本渲染，避免单条不完整资源使整个 Player 或卡面白屏。回归测试直接复现了 `Cannot read properties of undefined (reading 'replace')` 后转绿。
- Daggerheart 内置 Resource Package 已从 `1.0.7` 升至 `1.0.8` 并重新生成 PBRES 与 Preset Index。必须升版本：浏览器会按内置资源接纳规则保留同版本本地快照，仅替换仓库中的 `1.0.7` PBRES 不能更新已经安装的旧字段资源。
- 真实 Player 页面验收：刷新后无 `System Package 错误`；主武器选择器显示 157 条结果和新特性列；护甲选择器显示 34 条结果和新特性列；全新页面控制台错误为 0。
- 最新 `npm run verify` 通过：TypeScript 98 个文件、736 项测试；Python 141 项测试；依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量和 Platform 构建均通过。

### 卡牌标题只缩字、不省略

- 护甲标题此前同时使用 `SingleLineTextFit` 与 CSS `text-overflow: ellipsis`。单行拟合沿用了正文容器的 1px 溢出容差，导致标题可能被判定为已适配，却又被 CSS 在临界宽度替换为省略号。
- 单行标题拟合现严格要求 `scrollWidth <= clientWidth`；正文容器继续保留 1px 容差。所有第一方标题样式均已移除 `text-overflow: ellipsis`，标题只有四分之一像素步进缩字这一套行为。
- 真实 Player 规范卡面复验：“贝拉莫伊精致护甲”为 `25.25px`、`clientWidth=scrollWidth=203px`；“诚实蛋白石护甲”为 `29px`、`clientWidth=scrollWidth=203px`。两者均为 `fitted`，无省略号、无截断，控制台错误为 0。
- 最新 `npm run verify` 通过：TypeScript 98 个文件、738 项测试；Python 141 项测试；其余完整验证入口全部通过。

### 全模板标题区 padding 统一

- 种族和社群的标题区基线为 360px 原生画布上的 `padding: 10px 14px`。护甲、环境、自由已从原来的 `7% 8% 6%` 改为同一固定值，避免标题距离卡边约 25–29px。
- 武器是原生 `63×88` 小画布，使用视觉等价的 `1.75px 2.45px`；敌人没有独立标题容器，标题左右定位保持 `14px`，图片区下方顶部定位由 `12px` 调整为 `10px`。
- 真实 Creator 页面确认种族、社群、护甲、环境的计算 padding 均为上下 `10px`、左右 `14px`；护甲纯文字与图文模式标题均完整拟合，字号一致，武器与敌人标题也无横向溢出。
- 新增共享标题留白回归测试并更新敌人、武器的已审阅视觉签名。最新 `npm run verify` 通过：TypeScript 98 个文件、739 项测试；Python 141 项测试；依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量和 Platform 构建均通过。

### 已完成背景：武器卡图与其他模板不一致

- 用户在标题 padding 统一后继续审阅，确认武器的卡图表现仍明显不同于其他模板，并要求统一；随后决定下班，本轮没有继续诊断、改代码或更新视觉基线。
- 当前武器 Renderer 位于 `packages/templates/src/frontend/weapon/1.0.0/renderer.tsx`，它是唯一直接使用原生 `63×88` 小画布的模板；图文模式的图片区固定为 `34px` 高，标题作为绝对定位元素覆盖整个 `.weapon-art`。种族、社群/参考卡、护甲等则使用 360px 原生画布再缩放，图片区和标题渐变的组织方式不同。下一轮应先用真实 Creator 页面并排比较，不要只凭 CSS 数值机械换算。
- 目标逻辑仍以已确认规则为准：图文模式只是在纯文字卡标题上方加入卡图；卡图上边沿贴卡牌上边沿，下边沿位于标题与正文分界；标题位于图片下缘渐变区；卡图不得改变卡牌宽度、正文宽度或文字字号。
- 建议验收顺序：同一武器资源依次检查纯文字与图文模式的卡牌宽度、正文宽度、标题字号、卡图上下边界和渐变范围，再与种族/护甲图文卡并排截图；修复后补武器 Renderer 回归测试、更新视觉签名，最后运行 `npm run verify` 与 `git diff --check`。

### 第一轮武器卡图局部修正（已被整体迁移取代）

- 真实 Creator 页面用同一张实际卡图并排检查武器与护甲后确认了两个根因：武器固定比例图片区原为 `34px`，约占卡高 `38.6%`，高于护甲等模板的 `34%`；同时 `.weapon-art` 的 Grid 固有最小尺寸会把图片元素撑得高于裁剪框，使 `object-fit: cover` 没有在确定尺寸的图片框内工作。
- 武器固定比例图文卡现使用 `.weapon-card.is-split .weapon-art{height:34%}`；非固定比例单独保留 `34px`，避免百分比高度在自然增长卡面中失去稳定参照。
- 武器图片新增 `min-width:0; min-height:0; display:block`，图片元素现在与图片区严格同宽同高，仍使用 `object-fit:cover`。修改只涉及武器 Renderer，没有改平台预览、Template 字段或其他模板。
- 真实 Creator 页面中，修复后的固定图文武器卡图片框与图片元素均为原生 `29.4583px` 高，横纵溢出均为 `0`；纯文字与图文卡宽均为 `244.05px`，标题字号均为 `5.6px`，正文宽均为 `238.89px`。非固定比例图文卡图片区保持原生 `34px`，卡面自然增高且无溢出。
- 浏览器验收创建了本地资源“长柄巨斧”，并为它和既有“铁木甲”设置同一张测试卡图，未删除现有资源；Creator 控制台没有错误或警告。
- 新增武器混合媒体裁剪回归断言并更新已审阅视觉签名。最新 `npm run verify` 通过：TypeScript 98 个文件、740 项测试；Python 141 项测试；依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量与 Platform 构建均通过。

### 武器卡整体视觉迁移到大画布

- 用户随后提供武器与护甲的实际截图，确认主要差异不是卡图裁剪，而是武器仍独立使用 `63×88` 原生微型画布：标题自然字号仅 `5.6px`、正文 `2.1px`，数据块使用厚重独立方框，规则详情使用深红色条块，特性容器被拉伸为大面积空框；护甲、社群与种族均使用 `360×502.857` 原生画布再以 `.175` 缩放。
- 武器现新增与护甲一致的 `WeaponCardFrame` 与 `ResizeObserver` 高度协调：固定比例 Frame 为 `63×88px`，内层卡面为 `360×502.857px` 并 `scale(.175)`；非固定比例由内层自然高度决定 Frame 高度。
- 标题区改为大画布 `padding:10px 14px`，主标题自然 `36px`、最低 `10px`，位阶/类型、可选英文和摘要使用与护甲/参考卡相同的层级；图文模式仍让标题覆盖在 `34%` 图片区下缘的渐变层上。
- 三项核心数据改为护甲式单一细边表格；伤害类型与负荷改为浅色细边详情行，不再使用两块深红色面板。特性区改为内容高度的浅色圆角卡片与装饰横线，不再把边框拉伸占满剩余卡面；风味描述移到正文效果区末尾。
- 纯文字、图文、纯图片与固定/非固定比例模式继续使用同一 Renderer Revision，Template 字段与 Contract 未修改。武器标题与正文拟合范围提升到大画布 `36px / 15px` 基线。
- 回归测试新增武器大画布 Frame、统一标题留白、内容高度特性卡与共享缩放责任检查。最新 `npm run verify` 通过：TypeScript 98 个文件、741 项测试；Python 141 项测试；依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量与 Platform 构建均通过。
- 真实 Creator 复验尚未完成：Browser 控制调用持续报 `failed to write kernel assets`。已确认 Browser 插件目录、`browser-client.mjs` 与系统临时目录存在；未找到独立 `cua_node` 可执行文件。按根目录说明，需要重启 Codex 恢复常驻浏览器控制进程后，再用现有“长柄巨斧”资源检查纯文字/图文截图、DOM 尺寸、长标题拟合、正文裁切与控制台错误，不能在此之前宣称视觉验收完成。

### 武器摘要移除与装备正文重新构图

- 用户用“匕首”和“埃伦德里安链甲”的实际截图继续审阅：武器标题区的 `weapon-summary` 与正文核心数据重复；武器、护甲的正文信息量较少，但数据块和特性卡都挤在上方，留下大片没有构图作用的空白。
- 武器标题区已完全移除 `weapon-summary` DOM 与样式，属性、距离、负荷只在正文数据区出现。护甲和武器都会先判断是否存在特性或风味内容；没有正文时不再生成空的拟合容器，并让数据组在可用正文区垂直居中。
- 两类装备的数据块高度、标签字号和段落间距均适度放大。武器伤害类型/负荷行同步增加内边距与字号；武器、护甲特性卡使用 `130px` 最小高度、`20px` 内边距和最高 `17px` 正文字号，仍保持内容高度而不拉伸到底部。
- 新增回归测试，约束 `weapon-summary` 不得回归、无正文时不输出空容器、数据组使用居中分支，并锁定两类装备放大后的特性卡结构。已审阅武器视觉签名同步更新。
- 最新 `npm run verify` 通过：TypeScript 98 个文件、743 项测试；Python 141 项测试；依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量与 Platform 构建均通过。`node scripts/restart-dev.mjs` 报告 Backend `8001` 与 Platform `5173` 均为 `OK`。
- 真实 Creator 像素验收仍未完成：本轮重新初始化 Browser 控制时依然立即报 `failed to write kernel assets: 系统找不到指定的路径`。这是 Codex 常驻浏览器控制进程问题，不是本地服务或页面构建失败；按项目约束未改用临时 Playwright。恢复后应优先复验“匕首”纯文字卡与“埃伦德里安链甲”，确认 `.weapon-summary` 数量为 0、无横纵溢出、纯数据武器数据组居中、护甲特性卡的空白分布自然，并检查控制台错误。

### 武器与护甲非特性区域从零重画

- 用户确认上一版仍只是放大旧布局，要求保留特性卡之外的区域全部重新设计。本轮已删除武器的 `.weapon-stats`、`.weapon-details` 与护甲的 `.armor-stats`，不是用新样式覆盖或隐藏旧表格。
- 两类装备的标题统一改为“类型 / 位阶”小号眉题加下一行全宽主标题，可选英文位于主标题下方；仍保留 `10px 14px` 标题留白、深褐标题带、金色分界与图文模式下缘渐变，避免破坏此前已确认的模板家族语言。
- 武器正文改为一块非对称规则档案牌：左侧以伤害骰为唯一主值，右上并列属性与距离，右下用紧凑定义列表放置伤害类型与负荷。护甲正文改为护甲值主块加右侧两级递进阈值，直接表达“护甲值 / 重度 / 严重”的信息层级，不再平均切成三个无差别格子。
- 新档案牌继续使用骨纸底、酒红主值、深褐正文与细金分隔；特性区 DOM、边框、标题横线、字号拟合和内容高度规则保持上一版不变。无特性时整块档案牌仍在正文区垂直居中。
- 回归测试明确禁止旧统计表和详情条类名重新出现，并覆盖新的眉题、武器主值/事实栏、护甲阈值组和纯数据分支。武器已审阅视觉签名已更新。
- 最新 `npm run verify` 通过：TypeScript 98 个文件、743 项测试；Python 141 项测试；依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量与 Platform 构建均通过。
- Browser 控制仍在运行任何页面脚本前报 `failed to write kernel assets`，因此本轮无法进行真实 Creator 截图与像素检查，且按项目约束未改用临时自动化。恢复后需用“匕首”和“埃伦德里安链甲”重点检查档案牌比例、长属性/距离值换行、固定比例裁切和控制台错误。
- 用户随后明确否定本节所述“规则档案牌”视觉方案，不应继续微调或视为已接受设计。面向下一位实现者的自包含重绘说明已写入 `docs/card-face-redesign-guide.md`；其中列出了可删除的失败结构、必须保留的 Frame/展示模式/特性区、字段语义、代码入口、测试与真实页面验收矩阵。后续应以该文档为任务入口。

### 武器与护甲非特性区域第二轮重画（按重绘说明交付）

- 以 `docs/card-face-redesign-guide.md` 为入口重画。删除已被否定的 `.weapon-spec/.weapon-primary/.weapon-metrics/.weapon-metric/.weapon-facts` 与 `.armor-spec/.armor-rating/.armor-thresholds/.armor-threshold`，也删除第一版遗留的 `.weapon-summary/.weapon-stats/.weapon-details` 与 `.armor-stats`，不使用新类名复刻同样摘要或等权表格。
- 武器正文改为无框“伤害主值 + 属性/距离 + 负荷”的编辑式层级：首页以酒杯色大号伤害骰为主值，右侧以“伤害类型”小标签说明；其下用细金分隔线，再并列“属性 / 距离”两栏，末尾一行弱化“负荷”。护甲正文改为“护甲值”主值加“伤害阈值”组，组内重度与严重分两行递进，严重行更大更强调。两类装备都直接表达字段主次，不再平均分栏。
- 保留大画布 Frame（`63×88`，内层 `360×502.857`，`scale(.175)`）、三种展示模式、图文图片裁剪、特性卡 DOM/边框/标题横线/拟合、footer、Contract 与 Renderer Revision（武器 `weapon-card-r2`、护甲 `armor-card-r1`）。无特性时不输出空拟合容器，数据组在正文区垂直居中。
- 修复固定比例溢出：上一版数据块约 `204px` 原始高、特性卡最小 `130px`，在图文模式只剩约 `280px` 正文空间时会把特性卡挤出卡面。现在数据区改为更紧凑的无框排版（约 `133px`，护甲约 `148px`），特性卡最小高降到 `96px`，纯文字与图文模式均放入 `502.857px` 固定预算（图文模式正文可用约 `280px`）。武器标题自然字号 `34px`、正文拟合 `16px`。
- 结构回归测试同步改为新类名与最小高度断言；已审阅武器视觉签名更新为 `cddf472ac308b15770b9d1802c9ab2ba6cecbe147b6090aa0a7c177804e00e68`。
- 最新 `npm run verify` 通过：TypeScript 98 个文件、743 项测试；Python 141 项测试；依赖边界、Contract release、唯一视觉源、类型检查、Renderer 性能测量与 Platform 构建均通过。
- 真实 Creator 像素验收仍未完成：用户确认当前没有可用的 Browser 插件，本轮未做任何截图、DOM 尺寸或控制台检查，也未改用临时自动化。恢复浏览器后应复验：纯文字“匕首/无特性”与“一条短特性”、长标题特性、图文/纯图片模式，确认 `63×88` Frame、内层约 `360×503`、transform `.175`、`scrollWidth/clientWidth、scrollHeight/clientHeight` 仅差允许的 1px、纯图文正文同宽、图片未撑高裁剪框、无特性时无空容器、纯图片时 footer 为 0，以及 Shadow DOM 控制台无 `renderer.render.failed`/错误/警告。

### 回退到最初版本

- 用户对第二轮重画仍不满意（“你改过的同样不好看”），明确要求回退到最开始的版本。
- 已将卡面相关文件恢复到最近一次提交基线（HEAD），包括：`packages/templates/src/frontend/weapon/1.0.0/renderer.tsx`、`packages/templates/src/frontend/armor/1.0.0/renderer.tsx`、`packages/templates/src/frontend/weapon/markdown.ts`、四个相关测试文件。未触碰 `docs/handoff.md` 与 `docs/card-face-redesign-guide.md`。
- 恢复后卡面即 HEAD 基线版本（武器/护甲为 `63×88` 原生小画布 + `.weapon-summary` 摘要 + 平均三栏统计块）。其对应测试与 `npm run verify` 应回到 HEAD 一致状态。
- 本次回退不代表此前两版重画方案被接受；`docs/card-face-redesign-guide.md` 仍是后续重画的入口，但若再次实施须在真实 Creator 像素验收通过后再定稿，且需重新给出用户可接受的方向。

## 操作提醒

- 遵守根目录 `AGENTS.md`；默认中文沟通。
- 完整验证入口是 `npm run verify`。
- 不得直接删除文件；需要清理时移入回收站。
- 不修改 `.env`、密钥、CI/CD、数据库 schema，不执行 push/rebase/reset。
- 本地开发服务当前可用；Browser 插件当前受 `failed to write kernel assets` 阻塞，恢复前不要改用临时 Playwright 服务。
- 武器/护甲卡面已按要求回退到最近一次提交基线（HEAD），`npm run verify` 保持通过。`docs/card-face-redesign-guide.md` 保留为后续可能的再次重画入口，但只有真实 Creator 像素验收通过后才可交付；用户已否定两版重画方案。
