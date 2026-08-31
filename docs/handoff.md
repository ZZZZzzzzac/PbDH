# PbDH 开发交接

更新时间：2026-08-31

## 当前状态

- 当前分支：`main`。
- L0 #1 与六个 L1 #2—#7 均已完成验收并关闭。
- #8“平台合约生命周期治理”已关闭；Resource Package、System Package、Character Save、Tabletop Document 与 Backend API `1.0.0` 均已人工审阅、冻结并转为 `published`。
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
- 当前可信资源模板统一为稳定 `1.0.0`；未发布的 alpha/dev 模板和兼容代码已移除。
- 平台与模板不得用正则理解游戏字段语义；例如“等级”和“姓名”对平台都是普通作者数据。
- `additionalProperties: false` 仍用于封闭平台结构；不得借此预设自由模板的“简介”“类型”等游戏字段。
- Tabletop Document `1.0.0` 已正式发布：实例保存桌面实际宽度，状态与替换动作按精确版本模板校验，`presentation` 不再保存尺寸，正式 Creator 入口拒绝 development Contract。
- 四类正式 Contract 均以 `1.0.0` 为最低基线；所有 prerelease Schema、fixtures、catalog 项、兼容类型、迁移分支和临时 `.pbcha` Profile 已移除，旧开发文件明确不再支持导入。
- 浏览器图片统一先规范化为 WebP；资源图片宽 `630px`，所有规范化图片上限 `2 MiB`，原图不进入 Workspace、归档或服务器。服务端流式截断超限上传并校验 WebP 结构。
- Backend API `1.0.0` 已完成人工确认并正式发布：27 个操作以确定性生成的 OpenAPI 为权威，稳定 operation ID、认证矩阵、统一错误和二进制媒体边界由跨语言 conformance 与生成一致性检查守住。五个 Contract Family 现均有正式 `1.0.0`。
- 受限 Markdown 支持 `_斜体_`、`__粗体__` 和 `:red[染色]`，并由共享渲染链消费。
- Workspace 文件图标采用 Lucide，不再使用自绘图标。

## 本轮最后完成

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

## 验证基线

- 最新完整 `npm run verify` 通过：88 个 TypeScript 测试文件、660 项测试；136 项 Python 测试；5 个正式 Contract 的发布冻结检查、类型检查、依赖边界、设计检查、Renderer 性能测量和 Platform 生产构建全部成功。
- `node scripts/restart-dev.mjs` 通过：Backend `8001` 与 Platform `5173` 均为 `OK`。
- Python 输出仍有既有 FastAPI/Pydantic 弃用警告，不影响验证结果。
- 若修改 Backend 或 Platform 运行代码，交付前运行 `node scripts/restart-dev.mjs`，以五个模块级健康入口均通过为准。

## 下一步

1. 进入 UI 与美术细调前，先完成一次全库架构审查，只处理仍有明确收益的结构问题。
2. OpenPencil 视觉还原等待用户换到完整设计环境；#34 保持延后；#52 先补产品与损失模型设计。

## 环境与操作提醒

- 安装依赖：`npm install`；Python 依赖只能装入项目 `.venv`。
- 唯一完整验证入口：`npm run verify`。
- GitHub Issue 使用 `gh`；本机沙箱内网络不可用时，直接申请在沙箱外运行，不要反复在沙箱内重试。
- 浏览器操作环境与排障记录见根目录 `AGENTS.md`，不要再次假定插件不可用。
- IndexedDB 数据不会因代码更新自动迁移；涉及旧浏览器数据时必须明确迁移或说明需要清库。
- 不提交密钥、token、密码或本地环境文件。
