# PbDH 开发交接

更新时间：2026-09-01

## 当前状态

- 当前分支：`main`。
- 当前工作树包含本轮 Template 发布、Backend fail-closed、依赖边界守卫、重生成资源包及外部架构审阅后的五组 seam 收敛；未跟踪的 `start-dev.cmd` 是本轮开始前已有的用户文件，未修改。
- L0 #1 与六个 L1 #2—#7 均已完成验收并关闭。
- #8“平台合约生命周期治理”已关闭；五个 Platform Contract 与 11 个 Resource Template 的 `1.0.0` 均已人工审阅、冻结并转为 `published`。
- #34“快速即兴敌人卡”按用户决定延后到 PbDH 主体完成后。
- #52“高保真人物存档格式转换”仍为 `needs-triage`，应先设计损失模型，不直接实现。
- 用户已授权：确认功能完成且测试通过的 Issue 可以直接关闭，无须逐项申请。

## 已落地的产品边界

### Player

- 五个预置系统包及其资源库按 System Package ID 隔离；刷新、切换、安装和移除不会串包。
- 官方资源属于“原生资源包”，不可删除；额外资源包可移入回收站。
- 人物存档、Creator 工作区、GM 桌面统一采用本机优先、显式首次上传、可靠重试、冲突处理、本机/云端 30 天回收站的策略。
- 所有卡面由共享 Canonical Renderer 呈现。固定卡比例只能是 `63:88`；可变高度卡同宽，只允许高度变化；宿主只负责等比缩放或裁剪。
- Player 与 GM 共用 Tabletop Surface、拖动核心、卡牌详情窗口和右键菜单机制。

### Creator / GM

- Creator 与 GM 共用左侧 Workspace Tree，包括文件夹、搜索、多模板筛选、多选、右键菜单和排序。
- 当前排序为名称升序/降序，入口在“多选”右侧；footer 只显示资源总数。
- 模板筛选支持多选；不选择等于显示全部。
- 工作区不设最小宽度；Creator 三栏可拖动调整，GM 同一工作区也可拉伸。
- Creator 字段编辑失焦后才进入延时保存，不再每输入一个字就同步。
- Schema 的 `enum` 只作为可选建议：编辑器可下拉自动填写，也允许任意手输值。
- 模板不声明“可编辑字段”；资源实例的所有数据字段默认都能在 Creator/GM 编辑。
- GM 已移除左下角选择工具条；卡牌右键菜单保留“编辑卡牌”，拖动时自动置顶。
- OpenPencil 一比一视觉还原已按用户要求暂缓，等待在设计环境齐全的电脑上继续。

### Market

- Market 是爱好者分享资源的空间，不是商业出版物平台；不建设审核、举报、版权处理、后台治理、人工精选或相关数据表。
- 发布、更新、取消发布、永久删除、下载、安装到 Player、导入 Creator、Fork 草稿均已完成。
- 长操作统一使用可定制文案的公共忙碌遮罩；取消发布不再重复写入大型归档。
- `.pbres` 自包含资源、媒体以及市场展示信息、语言、许可和封面；开放阶段不兼容旧市场资源，可直接更新或删除旧数据。
- “编辑资源包信息”由 Creator 新建/右键编辑/发布和 Market 作者编辑共用同一表单。
- 应用级消息统一进入右上角通知中心；切换 App/系统包等普通导航不产生通知。

### Contracts / Templates / Renderer

- JSON Schema 2020-12 是文件与持久化 Contract 的唯一权威；TypeScript 和 Python 消费同一组版本化样例。
- Resource Package `1.0.0` 已正式发布；`presentation` 只保存卡牌形式与是否固定比例，实际显示尺寸由各 App 决定。
- System Package `1.0.0` 已正式发布；网站预制包由管理员登记并信任，第三方脚本在用户确认后受限运行，正式 Player 入口拒绝 development Contract。
- Character Save `1.0.0` 已正式发布；System Package 引用与独立 Character Data 版本保留，真实 UTC 时间和修改时间顺序受到检查，正式 Player 入口拒绝 development Contract。
- 已发布 Contract 必须在 `contracts/releases/` 保存人工审阅日期、冻结 Schema SHA-256、conformance 及真实生产者/消费者证据；`npm run verify` 会拒绝缺证据或原地修改 Schema 的版本。
- 当前 11 个可信资源模板统一为已发布且不可原地修改的 `1.0.0`；未发布的 alpha/dev 模板和兼容代码已移除。
- 平台与模板不得用正则理解游戏字段语义；例如“等级”和“姓名”对平台都是普通作者数据。
- `additionalProperties: false` 仍用于封闭 Template Data；除所有模板统一拥有的 `类型` 外，不得借此给自由模板预设“简介”等额外游戏字段。
- Tabletop Document `1.0.0` 已正式发布：实例保存桌面实际宽度，状态与替换动作按精确版本模板校验，`presentation` 不再保存尺寸，正式 Creator 入口拒绝 development Contract。
- 四类正式 Contract 均以 `1.0.0` 为最低基线；所有 prerelease Schema、fixtures、catalog 项、兼容类型、迁移分支和临时 `.pbcha` Profile 已移除，旧开发文件明确不再支持导入。
- 浏览器图片统一先规范化为 WebP；资源图片宽 `630px`，所有规范化图片上限 `2 MiB`，原图不进入 Workspace、归档或服务器。服务端流式截断超限上传并校验 WebP 结构。
- Backend API `1.0.0` 已完成人工确认并正式发布：27 个操作以确定性生成的 OpenAPI 为权威，稳定 operation ID、认证矩阵、统一错误和二进制媒体边界由跨语言 conformance 与生成一致性检查守住。五个 Contract Family 现均有正式 `1.0.0`。
- 受限 Markdown 支持 `_斜体_`、`__粗体__` 和 `:red[染色]`，并由共享渲染链消费。
- Workspace 文件图标采用 Lucide，不再使用自绘图标。
- 11 个 Resource Template 的 `data.类型` 是可编辑的游戏语义字段：新建时默认等于 Template 名称，但可由系统规则使用“主武器”“副武器”等值；Platform 只保存并按精确 Template Schema 校验，不解释、路由或判断兼容性。

## 本轮最后完成

- 11 个 Resource Template 已完成正式发布前的数据结构统一：全部要求顶层 `类型`；职业的 `推荐初始属性` 改为单键对象数组，`推荐初始武器` 改为字符串数组；Creator 提供逐行编辑并由精确 Renderer 展示。
- Daggerheart 种族与社群特性迁移会把标题从描述中拆出，不再同时保留“名称”和带标题前缀的“描述”；真实资源“械灵”“高城之民”和职业“吟游诗人”均有生成产物回归测试。
- Daggerheart、寻望之心和三个迁移系统包已按新 Template Data 重生成；Resource Package conformance 样例与 digest known answer 已同步。
- Backend 缺省发布模式已从 `development` 改为 fail-closed 的 `production`；只有本地显式配置才进入开发发布语义。
- 依赖边界扫描改为从根 workspace 清单派生，现覆盖全部 15 个 workspace；同时禁止 Resource Conversion 通过全局 Registry 反向定位 Template，改为显式注入 Template capability。
- 11 个 Resource Template `1.0.0` 经用户人工批准后正式发布：catalog、core capability 与 production Market 门禁已统一，ADR-0065 记录冻结范围；Backend production 回归实际覆盖全部 11 类模板。
- 修复 Backend 武器 Template 发布测试的假通过：原测试主体误落在辅助函数 `return` 之后，现已恢复实际 production 发布请求。
- Player Resource Application 的旧 apply、picker 与不可达 Dialog 孪生已删除，相关测试全部迁到当前 Sheet Runtime 的 `buildSheetResourceLibraries`、`queryResourceLibraryEntries` 与 `applyResourceSelectionToDraft` 真实接口。
- Player/Creator 的第三方资源转换物化已合并到 `packages/resource-conversion`；组合根显式传入目标系统、诊断命名空间和当前 Template capability，不读取全局 Template Registry。
- GM Tabletop 保存只消费 Tabletop Repository 自有媒体，不再因任意 Workspace 媒体变化触发保存；卡牌宽度、设计坐标比例和 containment 集中到独立 GM geometry 模块。
- Player RuntimeState 已移除不可达的旧 Resource Extension 上传、转换确认、替换和卸载状态机；兼容读取、有效资源目录、卡牌 provenance 与现行 Resource Package 能力保留。
- Template frontend 的 authoring、eager renderer、lazy loader 和 reference-card 标记统一由 `resolveTemplateFrontend(id, version)` facade 暴露；App 不再直连模板专用 Renderer resolver，lazy 子入口仍通过无 eager 依赖的 manifest 保持真实按需加载。
- 浏览器验收发现旧 Creator 草稿缺少新 `data.类型` 时 Template 投影会白屏；11 个 capability 的只读投影现对缺失非字符串字段降级为空文本，严格 Schema 与持久数据不变，并有旧草稿回归测试。

- Tabletop Document `1.0.0` 按人工审阅意见完成候选修改：`geometry.scale` 改为实际 `width`，桌面资源副本移除 `width/height/unit`，`state` 的具体结构交给模板 Schema，`replacementId` 必须匹配模板声明。
- GM 保存层会在内部缩放值与 Contract 实际宽度之间换算；Tabletop Document `1.0.0` 经人工确认后冻结并正式发布。
- Resource Package、System Package、Character Save 与 Tabletop Document 的 alpha/dev 目录及兼容代码已完整清理；正式 conformance 和应用测试全部改用 `1.0.0`。
- 统一图片流程保持资源图宽 `630px`，输出上限从 `5 MiB` 收紧为 `2 MiB`；云媒体与市场封面入口补充流式大小限制及 WebP 结构/尺寸检查。
- Character Save `1.0.0` 经人工确认后冻结并正式发布；示例移除卡牌显示尺寸，Schema conformance 扩展到 8 项，并补充真实日期、时间顺序和正式入口测试。
- System Package `1.0.0` 经人工确认后冻结并正式发布；发布证据包含共享 conformance、System Package CLI 生产者和 Player/Python 消费者测试。
- System Package 已锁定预制包可信、第三方脚本受限运行的边界；缺失运行文件、无效默认 Skin、无效 Page override 和空/反向资源版本范围都会返回错误并拒绝导入。
- System Package `1.0.0` 的共享 Schema conformance 从 3 项补充到 8 项，TypeScript 与 Python 使用同一组样例；另有 Player 导入测试覆盖文件和交叉引用错误不会造成未捕获异常。
- Resource Package `1.0.0` 经人工审阅后正式发布；Creator、Player、Market 与 Backend 的正式入口拒绝开发期 prerelease。
- Resource Package 和共享 Renderer 不再保存或读取卡牌宽度、高度与毫米单位；固定卡只声明 `63:88` 设计比例，实际显示尺寸由宿主 App 选择。
- Daggerheart、寻望之心及三个迁移系统包的正式 `.pbres` 已按定版 Contract 重新生成。
- #5 Creator App 已完成 L1 总验收并关闭；OpenPencil 一比一视觉还原按用户决定继续暂缓，不作为本轮关闭门槛。
- 修复 Windows CRLF 检出导致四个设计生成器把未变化的生成物误报为过期的问题；比较前统一换行，不修改设计内容或生成物。
- Creator/GM Workspace 排序入口移到“多选”右侧，名称升序/降序实际生效。
- 模板筛选改为可同时勾选多个类型，搜索、筛选、排序可以组合使用。
- Workspace 宽度下限移除，Creator 和 GM 均可继续缩窄或拉宽。
- GM 桌面移除多余的左下角选择工具条，恢复卡牌右键“编辑卡牌”。
- Template 的 `editableDataFields` 声明及相关限制代码全部删除，默认允许编辑全部实例数据字段。
- 清理演示残留、旧 alpha/dev 模板、错误的游戏语义正则与相应兼容分支。
- 完成一轮全库代码与架构审阅，并按“收益足够才拆”的原则重构 Creator/GM：`CreatorWorkspacePrototype.tsx` 从约 3600 行降至约 1725 行，Workspace 模型、持久化、回收站、发布、资源编辑、GM 视口/会话/工作台、文件事务等已形成独立模块；Creator `.pbres` 与 GM `.pbtab` 文件事务分别集中在 `creator-package-file-workflow.ts`、`gm-tabletop-file-workflow.ts`。
- 修复 GM 恢复时按硬编码官方包 ID 静默改写历史实例的问题；桌面实例继续拥有独立 Resource Copy，只有显式 Replacement 才查询当前 Workspace。
- 修复 Player Resource Package 按错误维度存储的问题，IndexedDB 现按 `systemPackageId + packageId` 隔离并带迁移。
- Creator 媒体与发布封面的 Blob URL 由 `use-managed-object-urls.ts` 统一管理，覆盖、释放和卸载时都会回收。
- 删除 Creator Renderer Lab；开发期 Contract prerelease 和旧兼容 Reader 已按 ADR-0063 删除；卡面设计坐标按 ADR-0064 统一为无单位设计空间，不再混用 CSS 毫米。
- 新增 Creator 发布、资源包文件事务、GM 文件事务、GM 会话/视口和 Object URL 生命周期测试；最新一轮增加的 7 项文件事务测试覆盖归档往返、转换失败、导入冲突、复制同步状态、云/本地回收站分流及只读门禁。

## 2026-09-01 代码库审阅遗留

以下不是当前测试失败，而是正式发布语义、架构一致性和维护成本仍未收尾。明天优先处理前两组；不要因为文件超过 500 行就机械拆分。

### 优先级 1：正式发布语义与自动守卫

1. **Resource Template 正式发布已完成。** 11 个 `1.0.0` 的 catalog、capability 与 production publication 状态一致为 `published`，并由一致性测试与 Backend production 发布测试守住。
2. **Backend fail-closed 已完成。** 缺少 `PBDH_PUBLICATION_MODE` 时默认 `production`，并有 Settings 回归测试。
3. **依赖边界守卫已完成。** 扫描覆盖根清单中的全部 15 个 workspace，并禁止 Resource Conversion 反向读取全局 Template Registry。

### 优先级 2：明确可删除或可低成本修正的遗留

1. `apps/market/src/catalog.ts` 仅被测试消费，却从 conformance fixtures 构造假 Publication 并位于生产 `src`。把测试数据移到 `tests/fixtures` 后删除该文件。
2. `.scratch/` 未被 Git 跟踪，但现有约 78 个文件、57 MiB，包括日志、pytest 数据库、旧 PRD、验收包和 50 MiB 历史 bundle。确认不再需要恢复证据后按项目规则移到回收站，不直接永久删除。
3. `apps/creator/src/styles.css` 仍包含旧壳选择器，并与 `workspace-prototype/workspace.css` 的 `.preview-panel` 等规则重叠。删除不可达规则，保留正式壳实际使用的最小样式。
4. `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` 当前报告 21 个产品代码未使用项，主要来自 Creator 拆分后的 import/变量，也包括 Market、Platform 和 Player。先清理，再决定是否把这两个开关接入正式 `typecheck`。
5. `docs/roadmap.md` 仍称多个 L1 为开放或等待验收，而本文件记录 L0 与六个 L1 均已关闭；先以 GitHub Issue 实际状态核对，再统一两份文档。路线图还不得把 development Template 描述成已正式发布。
6. Python 测试仍产生 30 条 Pydantic alias 警告。现有 camelCase 行为有测试覆盖，但应确认警告来源并消除，避免真正的模型字段问题被噪声掩盖。

### 优先级 3：需要先做取舍的结构工作

1. **Resource Conversion 与 ADR-0027 漂移。** 当前是 Adapter → `TemporaryResource` 通用中间模型 → 中央 Template 映射，并由组合根显式注入当前 Template capability；ADR-0027 要求每个 Adapter 直接产生 Game Resource Candidate 和精确版本报告。这是剩余项目中改动最大的一项：要么重构五个 Adapter，要么新 ADR 明确接受中央模型，不能继续让实现与权威设计相反。
2. **巨型 Surface 仍有两个明显候选。** `PlayerSheetSurface.tsx` 约 1244 行，优先考虑提炼人物存档/云同步/文件事务；`MarketApp.tsx` 约 847 行，可提炼 Publication 管理事务。Creator 根组件约 1725 行，当前只建议继续抽取 Market handoff 等完整事务。Backend Repository、Portable Archive、单格式 Adapter 和纯命令核心虽然超过 500 行，但职责较集中，暂不因行数拆分。
3. **UI 测试仍大量锁定源码字符串。** `workspace-prototype.test.ts`、`gm-tabletop-l1-regressions.test.ts`、`player-layout-regressions.test.ts`、`player-toolbar.test.ts` 和 `market-detail.test.tsx` 是主要热点；三个主 Surface 尚无真实挂载后的点击、异步状态和 Effect 生命周期测试。逐步替换最高风险断言，不一次重写全部测试。
4. Creator 仍把登录、网络与发布操作错误伪装成 `ContractDiagnostic`，使用不存在的 `creator-prototype@1` family/version。应建立独立 UI 操作诊断类型，ContractDiagnostic 只描述真实 Contract。
5. Platform 生产构建仍提示入口 chunk 约 1.54 MiB、gzip 约 393 KiB。当前没有性能故障证据，先观察实际加载指标；不要仅为消除 warning 破坏三个 Surface 常驻挂载和切换状态。

### 明确排除

- 不为第三方上传 System Package 的自带脚本建设复杂安全机制。预制包由管理员审核；第三方包风险由用户知情承担。保留现有基本门禁即可，不把理论上的动态 import 绕过当作本轮发布阻塞。
- OpenPencil 一比一视觉还原、#34 和 #52 继续按既有决定处理，不混入本轮代码库清理。

## 验证基线

- 最新完整 `npm run verify` 通过：94 个 TypeScript 测试文件、680 项测试；140 项 Python 测试；5 个正式 Contract 的发布冻结检查、11 个正式 Template 的状态一致性与 production 发布路径、类型检查、15-workspace 依赖边界、设计检查、Renderer 性能测量和 Platform 生产构建全部成功。
- Python 输出仍有 30 条 Pydantic alias 警告；生产构建仍有入口 chunk 大于 500 KiB 的提示，均未使验证失败。
- `node scripts/restart-dev.mjs` 已重新运行，Backend `8001` 与 Platform `5173` 均为 `OK`，脚本内的 Platform、Player、Creator、Market 模块级健康检查全部通过。
- Browser 插件已在真实本地 Player、Creator、GM 与 Market 页面完成验收，四个 Surface 均可读取真实 DOM 且控制台无错误；旧“环境 Template 验收包”缺少 `类型` 的本地草稿也能正常显示。本地浏览器已有验收数据未擅自删除。
- 若修改 Backend 或 Platform 运行代码，交付前运行 `node scripts/restart-dev.mjs`，以五个模块级健康入口均通过为准。

## 下一步

1. 决定 Resource Conversion 与 ADR-0027 的漂移：重构五个 Adapter 直接产出候选，或用新 ADR 明确接受当前通用中间模型与中央映射。
2. 清理 Market fixture、旧 Creator CSS、未使用代码、`.scratch` 和路线图漂移，每组保持独立可验证 diff。
3. 再处理 Creator 假 ContractDiagnostic、巨型 Surface 与源码字符串 UI 测试；不要仅按文件行数拆分。

## Suggested skills

- `$improve-codebase-architecture`：继续全库审阅清单，并避免遗漏原 findings。
- `$codebase-design`：判断 Player、Market、Conversion 的 deep module interface 和 seam，避免为了行数拆分。
- `$code-review`：每组修改完成后按仓库规则和设计文档双轴检查 diff。
- `$diagnose`：仅在 `npm run verify`、Backend 启动或浏览器验收出现真实失败时使用，不为警告猜测原因。
- `$handoff`：明天结束时更新本文件中的已完成项、剩余项和最新验证数字。

## 环境与操作提醒

- 安装依赖：`npm install`；Python 依赖只能装入项目 `.venv`。
- 唯一完整验证入口：`npm run verify`。
- GitHub Issue 使用 `gh`；本机沙箱内网络不可用时，直接申请在沙箱外运行，不要反复在沙箱内重试。
- 浏览器操作环境与排障记录见根目录 `AGENTS.md`，不要再次假定插件不可用。
- IndexedDB 数据不会因代码更新自动迁移；涉及旧浏览器数据时必须明确迁移或说明需要清库。
- 不提交密钥、token、密码或本地环境文件。
