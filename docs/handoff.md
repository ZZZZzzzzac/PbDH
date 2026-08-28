# PbDH 开发交接

更新时间：2026-08-28

## 当前落点

- 分支：`main`；#53 提交前本地比 `origin/main` 领先 13 个提交。本轮仍只做本地提交，不 push；下次开始时先检查本地 `main` 是否领先远端。
- 问卷弹窗修复与回归测试已提交：问卷 Host 改为静态导入，确保 `window.open()` 在菜单点击的同步调用栈中执行。
- 阶段 6 的 #38—#45 已全部完成并关闭。敌人与武器两条真实纵切的本地、Market、运行时、刷新、公开取得、取消/重新发布和独立设备云恢复均已验证。
- 本轮 Player 迁移固定来源为 `PbDH_sheet@0e44fa69b12209c172e4189e273615ba3a4d07a6`。
- 详细迁移范围、路径映射和验收标准见 [`docs/pbdh-sheet-player-migration.md`](pbdh-sheet-player-migration.md)；Character Save 边界见 [`docs/pbdh-sheet-character-save-migration.md`](pbdh-sheet-character-save-migration.md)。不要在本文件复制两份文档的内容。
- #34“快速即兴敌人卡”按用户决定延后到 PbDH 本体完成后，不修改、不关闭，也不作为当前候选。
- [GitHub Issue #47](https://github.com/ZZZZzzzzac/PbDH/issues/47)“AFK：完成护甲 Creator → Market → Player 真实纵切”已完成自动化与 Chrome 实机验收；最终验收记录已发布并关闭 Issue。
- [GitHub Issue #48](https://github.com/ZZZZzzzzac/PbDH/issues/48)“AFK：一次完成 Daggerheart Core 剩余六类资源真实纵切”已完成种族、社群、职业、子职业、物品、领域卡的稳定 Template、Creator/Market/Player 纵切、真实发布与更新/no-op 验收；最终验收记录已发布并关闭 Issue。
- [GitHub Issue #49](https://github.com/ZZZZzzzzac/PbDH/issues/49)“AFK：完成环境 Template 1.0.0 真实纵切”已完成稳定 Core、旧开发版升级候选、Authoring Layout、Canonical Renderer、Creator/Market/Player/GM 接线、自动封面、`.pbres` 往返、Backend 发布门禁与 Chrome 真实纵切；最终证据已记录，等待标签已移除，Issue 已关闭。
- [GitHub Issue #50](https://github.com/ZZZZzzzzac/PbDH/issues/50)“AFK：合并 System Package 为单一 `system.json` 根定义”已完成 `1.0.0-alpha.2`、两个真实包生成、Player ZIP/目录/预置/Author Preview Loader 迁移和实机 `.pbsys` 验收；公开包不再包含 `manifest.json`。
- [GitHub Issue #51](https://github.com/ZZZZzzzzac/PbDH/issues/51)“System Package Contract 收敛为开发期 1.0.0”已完成 Schema、双语言 conformance、Reader 归一化、两个真实包和构建期内嵌资源索引；稳定 `system.json` 的 `embeddedResources[]` 只保留 `path`。
- [GitHub Issue #52](https://github.com/ZZZZzzzzac/PbDH/issues/52)记录高保真人物存档格式转换与结构化损失处理，当前为 `needs-triage`，不并入 System Package `1.0.0`。
- [GitHub Issue #53](https://github.com/ZZZZzzzzac/PbDH/issues/53)“稳定 Character Save 1.0.0 与 Module 状态持久化”已完成 Contract、Module 状态投影、`.pbcha` 媒体边界、开发期存档补全迁移和云恢复门禁；最终验收记录已发布并关闭 Issue。
- L2 #9、#10、#12、#13、#15、#22 已按当前实现与真实纵切证据发布验收记录并关闭；#9/#10 正文已补充公开上线前继续在开发期 `1.0.0` 修改的版本规则。
- #11“规范资源呈现”已补齐统一可信 Renderer 解析：Player 与 Market 不再维护各自的 Template 特判列表，十个专用 Template 与自由 Template 均可通过精确版本进入同一 Canonical Card Surface；未知 Template/版本仍明确降级。
- #46 后续迁移缺口已补齐：Player 普通状态消息进入统一 PbDH 通知；System Package ZIP/文件夹上传与 Author Preview 入口恢复；寻望之心计数资源 WebP 已修复。

## 本轮完成

- Character Save Contract 已直接收敛到开发期 `1.0.0`：`characterData` 以有状态 Module ID 为持久键，`freeText` / `longText`、Checkbox、Countable、`imageField` 和每个 `cardTable` 均保存可逆状态；System Package Runtime 必须声明 `characterDataVersion`。
- Card Table 不再使用平台特判的统一 `characterData.tabletop`。每张卡的 Resource Copy、运行状态、Indicators、Token Count 和几何布局均位于所属 `cardTable` Module 下；卡图缺失时仍保留实例，当前资源包可用时重新解析媒体。
- `.pbcha` 逻辑文档不含 `assets`；Writer 和 Repository 只携带顶层 `imageField` 引用的玩家 WebP，系统包图片与卡图不会进入人物归档或云媒体列表。旧 `1.0.0-alpha.1` 可确定性转换，开发期缺失 Module 状态按当前包默认值补齐。
- 导入 `.pbcha` 和云端恢复会先加载目标预置 System Package，再校验 Package ID、版本、Character Data 版本、Module 集合和值形状；验证失败不会写入 Repository。
- 寻望之心 System Package 已从开发期误用的 `1.1.0` 回到 `1.0.0`；生成器改为消费源 Manifest 版本，不再硬编码。已有本地 `1.1.0` 人物档会迁回当前 `1.0.0`。

- 新增可信 `种族`、`社群`、`职业`、`子职业`、`物品`、`领域卡` 六个 `1.0.0` Template，覆盖封闭 Schema、默认值、投影、媒体槽位、Tabletop、Authoring Layout、Canonical Renderer 与 Catalog；旧 `0.0.0-dev.1` 保留精确读取但禁止发布。
- Creator 使用通用结构化编辑器完成六类资源的新建、编辑、预览与 `.pbres` 导出；Market 与 Player 复用相同 Canonical Card Surface，Player 将六类资源路由到 Daggerheart 原生 Picker、人物字段、物品栏和卡牌桌面。
- Daggerheart Core 内置包提升到 `1.0.3`，仍为 625 个资源、280 个媒体；剩余 399 份官方资源全部迁移到稳定 Template，包 Digest 为 `sha256:801bc36e5c4fd07522f1c0cb5542f60b65356456077393827d1dab63f7a42385`。
- 浏览器验收出版物 ID 为 `734fcbba-cedc-4210-be35-61a03e5344da`，Package ID 为 `01a04392-34a8-7807-8798-79efb6ff5d5d`。最终公开归档 116021 bytes，文件 SHA256 为 `4F32370477B7C4789F60BB3F62CF89703ECE1220AF36976F74ABDEAF8B28622A`，Snapshot Digest 为 `sha256:6ea401f92d838443594a07144cdbd97e0e3c0667d73b49a02c1790682182603a`。

- 新增可信 `护甲@1.0.0`：封闭 Schema、默认值、投影、媒体槽位、Authoring Layout、不可变 `armor-card-r1` Renderer、Tabletop 空状态、旧版精确升级候选与双运行时 conformance fixture 均已接入。
- Creator、Market、Player 与 GM Tabletop 均使用同一 Armor Canonical Resource Renderer；Creator 支持护甲新建、全字段编辑、预览、媒体与 `.pbres` 导出—重新导入，Market 支持匿名取得与规范卡面，Player 资源管理器支持规范预览。
- Daggerheart Core 的 34 份护甲已全部迁移到 `护甲@1.0.0`，内置资源包提升到 `1.0.2`；仍为 625 个资源、280 个媒体，Digest 为 `sha256:aba2fb68884b84c32466592d89a3bafeb106dd01af32e7f8f0ad952704ac86b4`。
- Player 真实 Daggerheart Runtime 集成测试证明护甲 Picker 原子写入名称、护甲值、描述与护甲槽，Character Data 导出—恢复后字段保留，且不保存 Resource Package、Game Resource Reference 或 `pick-armor` selection snapshot。
- 实机发布发现 Backend 的可信 Template Catalog 漏登 `护甲`；现已登记旧 `0.0.0-dev.1`（禁止发布）与稳定 `1.0.0`（开发环境可发布），并新增服务端发布回归测试。
- Market 的 Player 交接现在把护甲明确显示为 `Daggerheart Core / 护甲`，不再误标为“其他资源”；Player 仍以 System Package Compatibility 为权威完成原生路由。

- Player 已挂载完整 `SheetRenderer`、正式 Character Save Repository、云同步、`.pbcha`、统一图片准入、创建向导、问卷和打印。
- Daggerheart Core 已原生化为单个 `daggerheart-core.pbres`，共 625 个资源和 280 个唯一媒体资产；`.pbres` 已去除压缩归档总字节数限制。
- 修复首次打开 Player 时预置 System Package 尚未进入 Platform Runtime Storage、默认人物就提前保存的问题；现在先建立包缓存边界，再激活系统包和创建默认人物，并补了真实 Storage seam 的回归测试。
- Player 人物存档已从页面左栏移回 Platform App Bar；顶部按旧 `PbDH_Sheet` 保留“玩家功能 / 玩家存档 / 导入导出 / 系统包”四组下拉菜单。打印媒体样式会隐藏完整 Platform App Bar。
- Platform App Bar 已明确分成左右两组：PB/PbDH 与四个主页面 Tab 靠左且位置固定，各 App 独有工具、通知、设置与账号靠右；资源管理器详情栏恢复内部滚动；资源表行样式改为专用类名，避免与系统包 `.resource-row` 碰撞并挤压“生命 / 压力 / 护甲 / 希望”到“希望特性”区域。
- Creator 发布资源包时，未手动上传封面会按确定顺序尝试包内资源卡，取第一张可渲染卡，强制固定比例并通过同一 Canonical Renderer Revision 渲染为 WebP；单张卡失败会继续尝试下一张，不把独立封面缺失当作发布阻塞。生成资产加入完整发布快照。带图媒体先内联为 Data URL，避免 Canvas 污染；`react-dom/server` 仅在点击发布时动态加载，不增加主入口常驻体积。
- Player 的 Sheet Runtime 桥接现在只注入原生资源卡实际使用的 `portrait` / `back` 媒体；资源包独立封面继续保存在安装快照中，但不再被误当成 System Package 图片并报告 `UNUSED_PACKAGE_IMAGE`。
- 修复创建向导 Portal 脱离主题变量作用域后遮罩与面板透明的问题：向导现在挂入 Player App Shell，并为遮罩、面板和操作区保留实色回退值。
- “生命 / 压力 / 护甲 / 希望”的图片标志会按可用宽度自适应缩放，并覆盖布局皮肤的 `11px` 后代字号；常规数量下与熟练度统一为 `26px`。
- “系统包”下拉菜单已移除重复的“管理资源包”入口；资源管理器仍保留在“玩家功能”菜单。
- Daggerheart Core 的 280 个带图资源现在写入 `image` 卡面模式，无图的武器、护甲等继续使用文字卡；内置资源包版本提升到 `1.0.1`，已有 `1.0.0` 安装会按最低版本自动刷新；运行时媒体资产带上资源包来源键，Card Table 能解析到对应 Blob URL。
- Player Resource Picker 的 `字段模板` 已改为显示白名单，并为种族、社群、职业、子职、武器、护甲、物品和领域卡配置了玩家有价值的精简列，不再显示 `ID`、卡图路径、卡背路径等内部列。
- 寻望之心已从 `PbDH_sheet@0e44fa69b12209c172e4189e273615ba3a4d07a6` 的 `public/system-packages/heart-of-hopefind` 迁移为第二个真实预置 System Package。旧 `survivor-styles` 已转换为使用“自由”Template 的标准内嵌 `.pbres`；页面、Modules、Dependencies、Character Text Export、3 个 Validation Scripts 与 Skin 均走正式 Loader/Validator/Player Runtime。
- Player 现在可在 Daggerheart 与寻望之心间显式切换，当前系统偏好跨刷新保存；Character Save 与 active save 按稳定 System Package ID 隔离。移动端 Platform 主菜单同时暴露当前 App 的四组 Player 操作。
- 旧原型 `apps/player/src/PlayerAppPrototype.tsx` 和旧图片处理器 `apps/player/src/sheet-runtime/rendering/playerImageProcessor.ts` 已移入 Windows 回收站；Git 中记录为删除。
- Platform App Bar 的通知铃铛现在拥有统一通知队列、数量、查看、逐条关闭与全部清除；Player 已移除两处 `message message-info` 横幅，错误横幅仍保留。
- Player “系统包”菜单已恢复 ZIP、文件夹上传与 Author Preview。输入目录会同时经过权威 `system.json` Contract 和正式 Sheet Loader/Validator；嵌入 `.pbres` 复用现有资源路由，动态 System Document 进入 Character Save resolver，避免自定义包只能打开却不能保存。
- 寻望之心作者源中 10 个曾被文本复制损坏的 WebP 已从固定来源仓库按二进制恢复，并重新生成公开 System Package。
- Countable 图片标志恢复按内容数量自动缩放；图片型 Countable 的减号也会拦截右键并减少上限，不再打开浏览器右键菜单。
- Player “系统包”菜单不再显示资源包数量；数量改为跟随“玩家功能 → 资源管理器”入口。资源管理器外壳、详情标题和资源表已使用 Player 专用类名，避免 Sheet Runtime 与 Market 的全局样式污染；分类横向滚动条也不再遮挡按钮。
- 正确的 ZSeven-W OpenPencil CLI `op 0.8.4` 已安装到 `C:\Users\zinge\.local\bin\op.exe`，该目录在用户 PATH 中；不要误装同名的 `open-pencil/open-pencil`。
- Player 资源管理器按当前 System Package 的 `embeddedResources` 分成“原生资源包 / 额外资源包”。“同步到云”已归入“玩家存档”；“系统包”改为可用的当前包下拉框和独立版本号，只保留 `.pbsys` 与文件夹两个上传入口。
- 文件夹入口现在就是 Author Preview：目录句柄按 `PbDH_sheet@0e44fa69b12209c172e4189e273615ba3a4d07a6:src/storage/storageService.ts` 的机制持久化到共享 IndexedDB `authorPreviewHandles` 表；同一标签页刷新会重新读取目录，恢复成功后不会再被首选预制包覆盖。
- Daggerheart 主武器、副武器与护甲 Picker 已显示“位阶”并默认按位阶升序；主/副武器的“伤害类型”表头显示为“类型”，底层字段键不变。预置系统包加载器现在保留调用方注入的 Resource Package 媒体资产，不再把 Daggerheart 子职业和领域卡错误回退为文字卡。
- 环境 Template 已从 `PbDH_Cards@0745f4e45d6bc1cb06bc7f5d7b005757546c5cbe:frontend/src/templates/environment/**` 提升为 `环境@1.0.0`。稳定结构补入“原文”和特性“原名”，旧 `0.0.0-dev.1` 保持精确读取并可生成不修改源数据的升级候选；Creator 可新建和完整编辑，四个资源 Surface 共用 `environment-card-r1`。
- Player 资源管理器的环境入口判断已补齐；Market 安装的环境包位于“额外资源包 / 其他资源”，可直接打开共享 `environment-card-r1`，刷新后从 IndexedDB 恢复。
- Creator Workspace 目录不再保存或执行同目录手动重排；文件夹优先，文件夹按名称、资源按文件名确定排序。拖到其他文件夹或根目录仍会更新资源路径并保持 Resource ID，旧本地/云 payload 的 `order` 值会在读取时规范化，无需持久化 schema 迁移。
- Resource Package Structural SemVer Classifier 已在 TypeScript 与 Python 两端落地并消费同一组 `1.0.0` conformance cases：集合重排与版本/Digest 变化为 `none`，字段、路径、媒体、展示、许可、来源及兼容 Template/目标变化为 `PATCH`，新增资源/目标为 `MINOR`，删除或改变稳定 Resource/Template/目标引用为 `MAJOR`；作者可过度升级但不可低于最低版本。正式 Publication Repository 在同一事务内执行门禁并保证拒绝时零写入，development 的 `1.0.0` 同版本替换仍按 ADR-0057 保留。
- Resource Package Directory/ZIP Portable Archive Profile 的容器诊断版本已从遗留的 `1.0.0-alpha.1` 提升到当前 `1.0.0`。TypeScript 与 Python 现在共同消费 `contracts/conformance/resource-package/1.0.0/archive-cases.json`，覆盖路径安全、跨平台碰撞、特殊条目、媒体缺失/篡改/孤儿、未知文件和空目录一致性；旧 alpha `.pbres` 仍有双实现读取回归，不会被静默升级。
- 浏览器侧 Resource Package Contract 测试已从只消费 alpha fixture 改为同时消费 `1.0.0-alpha.1` 与 `1.0.0` 的逻辑文档和 Snapshot Digest known-answer fixtures，与 Python Backend 的双版本证据对齐。
- System Package Loader 已将“合法但未声明的归档文件”与“不安全的可移植路径”分离：前者报告 `system-package.archive.file.unknown`，绝对路径、反斜杠、`.` / `..`、空段、控制字符、尾随空格或点及 Windows 保留名仍报告 `system-package.archive.path.invalid`。
- System Package Contract 已收敛为开发期 `1.0.0`：`resourceCompatibility` 与 `embeddedResources` 均可省略并由 Reader 归一化为空数组；`embeddedResources[]` 只声明 `.pbres` 路径，包身份、版本和 Digest 由嵌套 Resource Package 提供。`alpha.2` 仍可精确校验、读取并归一化。
- 两个公开预置包在构建时从权威 `.pbres` 派生快速索引。Player 已安装相同版本时直接通过 ID、版本和 Digest 判断，不再为了识别资源包而在每次启动下载、解压 Daggerheart 的 20.8 MB 归档；首次安装仍读取并完整校验 `.pbres`。

## 已验证

- #48 最终 `npm run verify` 完整通过：63 个 TypeScript 测试文件 / 399 个测试、87 个 Python 测试、类型检查、依赖边界、设计检查与 Platform build 全部通过。Python 仍只有既有 Pydantic 警告，Vite 仍只有既有大 chunk 警告。
- Creator 导出的六资源 `.pbres` 经正式 Loader/Validator 验证为 0 诊断；最终 Market 下载包同样为 0 诊断、6 个稳定 `1.0.0` 资源与 1 个封面资产。六种 Canonical Surface 在 Creator、Market、Player 均逐项显示。
- Chrome 实机完成 Creator 登录发布、Market 取得、Player 安装与原生使用：种族、社群、职业、子职业、物品与领域卡分别进入人物字段、物品栏或卡牌桌面；刷新后状态保留。对同 Package ID、同版本但不同 Digest 的出版物，Player 明确要求“更新”；更新后再取得相同 Digest，明确 no-op 且不创建副本。
- Creator 390×844 下无横向溢出；本地测试账号继续仅保存在被 Git 忽略的 `.env.local`，文档和提交不含凭据值。

- #47 最终 `npm run verify` 完整通过：59 个 TypeScript 测试文件 / 361 个测试、78 个 Python 测试、类型检查、依赖边界、设计检查与 Platform build 全部通过。Python 仍只有既有 Pydantic 警告，Vite 仍只有既有大 chunk 警告。
- #47 Creator、Market、Player 护甲定向集成测试为 3 个文件 / 29 个测试；Python Resource Package conformance 为 17 个测试。`node scripts/restart-dev.mjs` 已确认 Backend `8001` 与 Platform `5173` 均为 `OK`。
- Chrome 实机桌面纵切已通过：Creator 新建、全字段编辑、保存与刷新恢复；登录后上传封面并发布；退出账号后匿名 Market 可发现、打开 Canonical 护甲卡面并下载 `护甲纵切验收包.pbres`；交接对话框显示 `Daggerheart Core / 护甲`，Player 安装后资源管理器显示“护甲 1”，Picker 为 35 条结果，选择发布包的“填充布甲”后写入阈值 `5/11`、护甲值 `3`、护甲槽上限 `3` 与特性，刷新后完整恢复。各 Surface 控制台无 error。
- 390×844 实机验收通过：Creator、Market、Player 均无横向溢出，Creator 编辑器的移动端最小宽度已收敛；临时 viewport 已恢复默认桌面尺寸。

- 本轮资源包与 Player 改动通过 54 个 TypeScript 测试文件、328 个测试，76 个 Python 测试、类型检查、依赖边界与 Platform build；单包归档实测 20,796,696 bytes。
- 真实浏览器已验证：Player 连续刷新稳定启动；资源管理器只安装一个 Daggerheart Core（625 资源、280 图片、8 个类型）；主武器选择、人物编辑、自动保存与刷新恢复正常；人物复制产生第二份可切换存档；正式 `.pbcha` 导入产生第三份存档且无诊断；头像经统一裁剪入口上传后可跨刷新恢复；创建向导显示 18 步；打印会在缺少必填车卡内容时给出预检查提示。
- `.pbcha` 导出按钮在真实页面执行后没有错误；内嵌浏览器不暴露应用通过 Blob 链接触发的下载事件，归档字节级写入/读取往返继续由 Contract 测试覆盖。
- `npm run verify` 已完整通过，既有的 Creator 设计一致性阻断在当前基线中已不存在。
- `node scripts/restart-dev.mjs` 最近一次健康检查通过：Backend `8001`，Platform `5173`。
- 本地 Supabase 登录沿用 `DaggerHeart_Battle/js/enemy_library_online.js` 的公开客户端 URL 与 anon key，已写入被 Git 忽略的 `.env.local`；重启后 `/api/auth/config` 返回 `configured: true`，Backend 与 Platform 健康检查通过。
- Creator 默认发布封面回归通过：相关 3 个测试文件共 31 个测试与 `npm run typecheck` 均通过。
- 带独立封面的真实 Daggerheart Core Runtime 加载回归通过；Player 资源桥接、Market 交接、离线仓库与系统包相关 4 个测试文件共 19 个测试及类型检查通过。
- 本轮五项 Player 回归的 5 个定向测试文件共 16 个测试通过；完整 `tests/player` 共 15 个文件、58 个测试通过。真实浏览器确认：向导遮罩为 `rgba(18, 25, 27, 0.68)`、面板为实白色；四项图片标志和熟练度均为 `26px`；主武器 Picker 只显示“名称 / 属性 / 距离 / 伤害 / 负荷 / 伤害类型 / 描述”，领域卡只显示“名称 / 领域 / 等级 / 属性 / 回想 / 描述”；升级后新选子职卡使用 Blob 卡图。复测产生的临时卡牌已从本地人物存档清理。
- #44 已移除 `ready-for-human` 标签，发布真实验收记录并关闭。
- 新电脑上的 `npm run verify` 已完整通过：54 个 TypeScript 测试文件、328 个测试，76 个 Python 测试、类型检查、依赖边界、设计检查与 Platform build 全部通过。
- 本地测试账号凭据保存在被 Git 忽略的 `.env.local` 中，键为 `PBDH_TEST_ACCOUNT_EMAIL` 与 `PBDH_TEST_ACCOUNT_PASSWORD`；不要把值写入文档、日志或 Git。
- 内嵌浏览器自动化连续完成登录、会话接管、云恢复、刷新和 30 题问卷，没有导致 Codex 应用崩溃；全局 `C:\Users\zinge\.codex\AGENTS.md` 中对应风险限制已删除。
- #45 真实敌人纵切已验证：Market 单资源入口交接完整包；同 Package ID 不同 Digest 必须显式更新；Creator Ingress 只导入并聚焦、不自动放置；“陨落神殿”两个牛头人实例分别保持压力 `3/5` 与 `0/5`，刷新后不互相污染；桌面已同步云端，`.pbtab` 导出无控制台错误。
- #45 真实武器纵切已验证：Market 的“测试资源包”以标准 `.pbres` 安装到 Daggerheart Core 原生“武器”入口；Player 显示 2 个资源，主武器 Dependency 产出与描述在刷新后恢复；人物存档已同步；重复安装同一快照为明确 no-op。随后经 Market“导入卡片工坊”完整回到 Creator 并同步云端；只读核对 Backend 证明 Market 与云 Workspace 的完整逻辑文档相同，Package ID、版本、Digest、2 个资源和 2 个媒体一致。用户确认后已公开重新发布；退出账号后的匿名 Market 仍可发现并打开详情，匿名 API 返回同一快照且 `.pbres` 下载为 200、正确媒体类型、110251 bytes。
- 修复 Market 武器卡图被误报为 `UNUSED_PACKAGE_IMAGE`：动态资源媒体继续参与存在性与卡图引用校验，但只有真正的 System Package 图片进入“未使用图片”警告。新增回归测试后，真实 Player 资源管理器不再显示该警告。
- 390×844 自动化验收通过：关闭资源管理器后 Player、Market、GM 页面均无横向溢出；Player 主武器、Market 两个出版物、GM 两个独立敌人实例和移动端主导航均可见，控制台无错误；临时 viewport 已恢复默认值。
- 当前 `npm run verify` 通过：54 个 TypeScript 测试文件、329 个测试，76 个 Python 测试、类型检查、依赖边界、设计检查与 Platform build 全部通过。Python 仍输出既有 FastAPI/Pydantic 弃用警告，Vite 仍输出既有大 chunk 警告，均不影响退出码。
- #45 定向证据集通过：15 个 TypeScript 文件 / 93 个测试覆盖归档、Contract、Market 交接、Publication、Creator/GM 放置、Player 安装与 Dependency、云恢复和冲突；Backend Publication/Cloud Document 12 个测试覆盖匿名下载、权限/会话、媒体原子提交、revision 冲突与零部分写入。运行中匿名 API 证明：武器未发布时下载返回 404；用户确认重新发布后，同一快照返回 200、正确媒体类型和 110251 bytes。
- Chrome 扩展提供了与 IAB 独立的 IndexedDB 验收环境：初始没有 Market 测试资源包；登录会话自行恢复后，云端 Character Save 恢复人物名、主武器最终字段和描述，且当时源武器包尚未安装；随后公开武器包完整安装为第 9 个包，同快照再次取得明确 no-op。Creator Workspaces 和“陨落神殿”也从云端恢复，两个同源敌人实例压力分别为 `3/5` 与 `0/5`，刷新并重新选择桌面后仍一致；全程无控制台错误。
- #42 真实敌人取消/重新发布验收通过：取消后匿名目录不再包含该 Publication，详情、`.pbres` 下载和媒体均返回 404；作者管理页仍保留同一 Publication。重新发布后公开目录、详情、下载和媒体恢复，Publication ID、Package ID、版本与 Digest 均不变；下载为 200、44,809 bytes，媒体为 200、42,822-byte WebP。#42 与 #45 的最终验收记录已发布，`ready-for-human` 已移除，两个 Issue 均已关闭。
- #46 自动化浏览器验收通过：寻望之心的 8 个求生者风格可组合为实际人物字段，人物编辑、生命/压力、噪音 d12→d20→d12、切换保存和刷新恢复正常；Daggerheart 原人物与武器数据未被串写。390×844 下页面宽度为 390px、无横向溢出，移动端系统包面板可展开，控制台无 error；临时 viewport 已恢复。
- 当前 `npm run verify` 通过：55 个 TypeScript 测试文件、335 个测试，76 个 Python 测试、类型检查、依赖边界、设计检查与 Platform build 全部通过。Python 仍输出既有 FastAPI/Pydantic 弃用警告，Vite 仍输出既有大 chunk 警告。
- 后续修复的浏览器验收通过：系统包菜单显示“上传系统包(zip) / 上传系统包(文件夹) / 系统包预览”；寻望之心页面存在 33 个有效 `128×128` 标记图片、fallback 与破图均为 0；`.message.message-info` 为 0；PbDH 通知显示数量并可打开查看。自动化期间 Codex 未崩溃，浏览器风险旧规则已确认不再存在。
- Countable 浏览器回归通过：Daggerheart 生命上限从 6 增至 14 时，14 个图片标志由 `26px` 自动缩至 `17px`，容器无溢出；右键减号可将上限从 14 减至 13，且不弹浏览器菜单。验收后已把生命上限恢复为 6，字号恢复为 `26px`，控制台无 error。
- 当前 `npm run verify` 通过：56 个 TypeScript 测试文件、342 个测试，76 个 Python 测试、类型检查、依赖边界、设计检查与 Platform build 全部通过。Python 仍输出既有 FastAPI/Pydantic 弃用警告，Vite 仍输出既有大 chunk 警告。
- Player 资源管理器布局浏览器验收通过：660×756 下弹窗底部未越界，详情标题为 48px，分类栏为 38px、按钮为 30px，横向滚动条不再遮挡分类；1280×720 下顶栏 64px、汇总 58px、搜索 36px、底部操作 38px，控制台无 error，临时 viewport 已恢复。
- 当前 `npm run verify` 通过：56 个 TypeScript 测试文件、345 个测试，76 个 Python 测试、类型检查、依赖边界、设计检查与 Platform build 全部通过。Python 仍输出既有 FastAPI/Pydantic 弃用警告，Vite 仍输出既有大 chunk 警告。
- Player 菜单与资源分组浏览器验收通过：资源管理器显示“原生资源包 / 额外资源包”；系统包选择框为正常深色可用状态，选项为 Daggerheart / 寻望之心，版本号独立显示，菜单只显示“上传系统包(.pbsys) / 上传系统包(文件夹)”，控制台无 error。浏览器安全策略拒绝自动执行下拉切换，未绕过；切换逻辑由回归测试和类型检查覆盖。
- 当前 `npm run verify` 通过：56 个 TypeScript 测试文件、349 个测试，76 个 Python 测试、类型检查、依赖边界、设计检查与 Platform build 全部通过。Python 仍输出既有 FastAPI/Pydantic 弃用警告，Vite 仍输出既有大 chunk 警告。
- 装备 Picker 与卡图修复浏览器验收通过：主/副武器表头均为“名称 / 属性 / 距离 / 伤害 / 负荷 / 位阶 / 类型 / 描述”，护甲包含位阶，三者默认位阶升序；不刷新页面切换寻望之心再切回 Daggerheart 后，领域卡“符文护符”为图片卡（图片 1、文字卡 0）。当前 `npm run verify` 通过：56 个 TypeScript 测试文件、350 个测试，76 个 Python 测试、类型检查、依赖边界、设计检查与 Platform build 全部通过。
- #49 最终 `npm run verify` 通过：66 个 TypeScript 测试文件 / 409 个测试、88 个 Python 测试、类型检查、依赖边界、设计检查和 Platform build 全部通过。Creator 实机确认环境入口、9 个顶层字段、可变长特性编辑、实时规范卡面，以及无图环境卡和带图敌人卡的自动 WebP 封面。
- #49 公开 Publication ID 为 `e6ccb6d0-2320-495c-803d-db16817e559b`，Package ID 为 `01a04620-97cd-757c-b8c0-df43207b9562`，Snapshot Digest 为 `sha256:7410244b3e701db783efd35dd7edfd3d637f2138d828bb1bf26393d19605e761`。匿名 Market 可发现并下载；Player 安装到“其他资源”、共享卡面与刷新恢复通过；Chrome 原生 HTML5 拖放把环境卡显式放入 GM 桌面，刷新后实例恢复。全程控制台无 error。
- Creator 目录确定排序完整验证通过：`npm run verify` 为 66 个 TypeScript 测试文件 / 411 个测试、88 个 Python 测试，类型检查、依赖边界、设计检查和 Platform build 全通过。内嵌浏览器中同一父目录的 `0 文件夹 / A 文件夹` 会立即按名称排序，刷新后顺序保持，控制台无 error；跨目录移动、资源路径更新、旧 `order` 规范化与同目录 no-op 由模型/仓库测试覆盖。浏览器自动化无法为该目录树构造原生 HTML5 `DataTransfer`，因此未把坐标拖拽结果作为验收证据。
- Structural SemVer 与封面回退收紧后的 `npm run verify` 完整通过：67 个 TypeScript 测试文件 / 436 个测试、113 个 Python 测试、类型检查、依赖边界、设计检查和 Platform build 全部通过。共同 fixture 还覆盖了同一 System Package 多个精确目标版本的匹配顺序，证明集合顺序不会改变分类。
- 内嵌浏览器使用未上传独立封面的“环境 Template 验收包”打开发布窗口，自动封面成功显示；图片自然尺寸为 `680×1073`、来源为本地 Blob，证明走固定比例 Canonical Renderer → WebP 链路。未点击最终发布，控制台无 error，临时验收标签页已关闭。
- Portable Archive Profile `1.0.0` 提升后的 `npm run verify` 完整通过：67 个 TypeScript 测试文件 / 437 个测试、113 个 Python 测试、类型检查、依赖边界、设计检查和 Platform build 全部通过。
- 双版本 Resource Package Schema/Digest 浏览器 conformance 补齐后的 `npm run verify` 完整通过：67 个 TypeScript 测试文件 / 448 个测试、113 个 Python 测试、类型检查、依赖边界、设计检查和 Platform build 全部通过。
- System Package 未知文件诊断修复后的 `npm run verify` 完整通过：67 个 TypeScript 测试文件 / 449 个测试、113 个 Python 测试、类型检查、依赖边界、设计检查和 Platform build 全部通过。
- #50 最终 `npm run verify` 完整通过：67 个 TypeScript 测试文件 / 449 个测试、113 个 Python 测试、类型检查、依赖边界、设计检查和 Platform build 全部通过。内嵌浏览器验证 Daggerheart / 寻望之心切换与刷新保持；上传 20.8 MB、只有 `system.json` 根且不含 `manifest.json` 的真实 Daggerheart `.pbsys` 后完整加载，控制台无 error。
- #51 最终 `npm run verify` 完整通过：67 个 TypeScript 测试文件 / 453 个测试、116 个 Python 测试、类型检查、依赖边界、设计检查和 Platform build 全部通过。内嵌浏览器中已安装 Daggerheart 刷新到可交互约 421 ms，寻望之心切换后刷新保持约 946 ms；资源管理器原生/额外分组正常，20.8 MB 稳定版 Daggerheart `.pbsys` 上传成功，全程控制台无 error。原生目录选择器不能由浏览器自动化注入路径，目录 VFS 由共用 Loader 测试覆盖。
- #53 `npm run verify` 完整通过：67 个 TypeScript 测试文件 / 456 个测试、116 个 Python 测试、类型检查、依赖边界、设计检查和 Platform build 全部通过。内嵌浏览器验证旧 Daggerheart 存档补全后正常启动并保留“符文护符”卡图；寻望之心姓名与希望点修改可跨刷新恢复，恢复验收前状态后再次刷新无 error；两包菜单均显示 `v1.0.0`。
- #11 Renderer 收敛后的 `npm run verify` 完整通过：68 个 TypeScript 测试文件 / 468 个测试、116 个 Python 测试、类型检查、依赖边界、设计检查和 Platform build 全部通过。11 个首版可信 Template 的精确 Renderer、四宿主同输入输出和未知版本不回退由共同测试锁定；真实 Player 与 Market 武器预览均显示 Canonical Surface，新标签页冷启动控制台无 error。

## 接下来

1. #34“快速即兴敌人卡”继续按用户决定延后，不要自行恢复。
2. #52 高保真人物存档转换为后续复杂需求，保持 `needs-triage`，不要在未设计损失 Contract 前直接扩写现有脚本。
3. #11 关闭后审计 #18 的 Replacement 闭包与显式放置缺口，选择不扩大 GM 桌面范围的最小纵切。

## 换机交接

### 当前电脑离开前

1. 本次 handoff 提交并推送后，当前工作区应已提交且干净，`main` 与 `origin/main` 同步。
2. #47 与 #48 的实现、验收和交接提交均已推送到 `origin/main`，另一台电脑可直接快进拉取。
3. 被忽略的 `.env.local` 不会随 Git 传输，应通过安全方式单独重建，不要写入交接文档或提交。
4. 离开前可再次运行 `git status --short --branch`，预期显示 `## main...origin/main` 且没有文件状态。

### 另一台电脑开始时

1. 运行 `git pull --ff-only origin main`；确认近期日志包含 #47 与 #48 的实现及交接提交，并确认 `git status --short` 为空。如果使用完整仓库副本，直接做相同检查。
2. 检查单包存在：`apps/player/public/system-packages/daggerheart-core/resources/daggerheart-core.pbres`。该包应包含 625 个资源与 280 个媒体资产。
3. 安装 Node 依赖：`npm install`。创建项目 `.venv` 后安装 Python 开发依赖：`python -m pip install -r requirements-dev.txt`；不要使用全局 Python 包。
4. 单独重建被 Git 忽略的 `.env.local`。测试账号键名见“已验证”小节；凭据只从安全的本地来源复制，不写入 handoff、日志或 Git。
5. 运行 `node scripts/restart-dev.mjs`，确认 Backend `8001` 与 Platform `5173` 均为 `OK`，只从 `http://localhost:5173` 访问四个 App。
6. 运行 `npm run verify`；当前基线为 67 个 TypeScript 测试文件 / 456 个测试、116 个 Python 测试、类型检查、依赖边界、设计检查和 Platform build 全部通过。
7. 浏览器本地数据不会随 Git 迁移。新电脑首次打开 Player 会安装 Daggerheart Core 与寻望之心两个预置包；Daggerheart 子职业和领域卡应直接显示卡图，不应先显示文字再依赖刷新修复。

## 建议 skills

- `$diagnosing-bugs`：真实 Player 交互、持久化或云恢复出现难以定位的问题时使用。
- `$browser:control-in-app-browser`：需要对本地 Player、Creator、GM 或 Market 做真实交互与视觉验收时使用。
- `$code-review`：指定本次迁移前的固定提交后，对 Player 大范围迁移做 Standards / Spec 双轴审查。
- `$handoff`：下次跨设备暂停时更新本文件。
