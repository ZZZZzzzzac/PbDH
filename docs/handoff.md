# PbDH 开发交接

更新时间：2026-08-27

## 当前落点

- 分支：`main`；最新产品代码提交为 `befaf03b224176604f21f3e101390377580a12ef`，本交接文档随后以独立提交收尾；完成后工作区干净，相对 `origin/main` 超前 13 个本地提交。不要未经确认 push。
- 问卷弹窗修复与回归测试已提交：问卷 Host 改为静态导入，确保 `window.open()` 在菜单点击的同步调用栈中执行。
- 阶段 6 的 #38—#45 已全部完成并关闭。敌人与武器两条真实纵切的本地、Market、运行时、刷新、公开取得、取消/重新发布和独立设备云恢复均已验证。
- 本轮 Player 迁移固定来源为 `PbDH_sheet@0e44fa69b12209c172e4189e273615ba3a4d07a6`。
- 详细迁移范围、路径映射和验收标准见 [`docs/pbdh-sheet-player-migration.md`](pbdh-sheet-player-migration.md)；Character Save 边界见 [`docs/pbdh-sheet-character-save-migration.md`](pbdh-sheet-character-save-migration.md)。不要在本文件复制两份文档的内容。
- #34“快速即兴敌人卡”按用户决定延后到 PbDH 本体完成后，不修改、不关闭，也不作为当前候选。
- 当前完成工作项：[GitHub Issue #46](https://github.com/ZZZZzzzzac/PbDH/issues/46)“迁移寻望之心作为第二个真实 System Package”。下一项应继续从六个 L1 的未完成产品能力中拆分正式实现 Issue。
- #46 后续迁移缺口已补齐：Player 普通状态消息进入统一 PbDH 通知；System Package ZIP/文件夹上传与 Author Preview 入口恢复；寻望之心计数资源 WebP 已修复。

## 本轮完成

- Player 已挂载完整 `SheetRenderer`、正式 Character Save Repository、云同步、`.pbcha`、统一图片准入、创建向导、问卷和打印。
- Daggerheart Core 已原生化为单个 `daggerheart-core.pbres`，共 625 个资源和 280 个唯一媒体资产；`.pbres` 已去除压缩归档总字节数限制。
- 修复首次打开 Player 时预置 System Package 尚未进入 Platform Runtime Storage、默认人物就提前保存的问题；现在先建立包缓存边界，再激活系统包和创建默认人物，并补了真实 Storage seam 的回归测试。
- Player 人物存档已从页面左栏移回 Platform App Bar；顶部按旧 `PbDH_Sheet` 保留“玩家功能 / 玩家存档 / 导入导出 / 系统包”四组下拉菜单。打印媒体样式会隐藏完整 Platform App Bar。
- Platform App Bar 已明确分成左右两组：PB/PbDH 与四个主页面 Tab 靠左且位置固定，各 App 独有工具、通知、设置与账号靠右；资源管理器详情栏恢复内部滚动；资源表行样式改为专用类名，避免与系统包 `.resource-row` 碰撞并挤压“生命 / 压力 / 护甲 / 希望”到“希望特性”区域。
- Creator 发布资源包时，未手动上传封面会固定选择资源列表第一张卡的首个已声明媒体，不再随当前编辑卡变化；第一张卡没有媒体时才退回资源包首个资产。Daggerheart Core 首张卡带有 `portrait`，可直接作为市场封面。
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

## 已验证

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

## 接下来

1. 不处理 #34；先审计六个 L1 的“产品完成”缺口，选择一个仍阻塞 PbDH 本体完成的最小纵切，建立正式 GitHub Issue 并 triage。
2. 新工作项开始前回读对应父 PRD、相关 ADR 与 `docs/agents/issue-tracker.md`，以用户可验收的完整产品能力为目标，不把部署目录或内部模块误当成产品 L1。

## 换机交接

### 当前电脑离开前

1. 当前工作区已提交且干净；最新产品代码提交为 `befaf03`，随后是本交接文档提交。`main` 比 `origin/main` 超前 13 个提交，远端仍停在 `1c7aebf`。
2. 这 13 个提交目前只存在于本机。由于 `git push` 属于必须由用户确认的红线操作，Agent 没有推送；若希望回家后直接拉取，请离开前手动运行 `git push origin main`。
3. 如果不推送，必须复制包含 `.git` 的完整仓库；只复制工作文件无法保留今天的 13 个提交。被忽略的 `.env.local` 不会随 Git 传输，应通过安全方式单独重建，不要写入交接文档或提交。
4. 离开前可再次运行 `git status --short --branch`，预期除 `main...origin/main [ahead 13]` 外没有文件状态。

### 另一台电脑开始时

1. 如果公司电脑已推送，运行 `git pull --ff-only origin main`；确认 `git log -2 --oneline` 的最新两项依次为交接文档提交和 `befaf03 fix: restore daggerheart card art and equipment tiers`，并确认 `git status --short` 为空。如果使用完整仓库副本，直接做相同检查。
2. 检查单包存在：`apps/player/public/system-packages/daggerheart-core/resources/daggerheart-core.pbres`。该包应包含 625 个资源与 280 个媒体资产。
3. 安装 Node 依赖：`npm install`。创建项目 `.venv` 后安装 Python 开发依赖：`python -m pip install -r requirements-dev.txt`；不要使用全局 Python 包。
4. 单独重建被 Git 忽略的 `.env.local`。测试账号键名见“已验证”小节；凭据只从安全的本地来源复制，不写入 handoff、日志或 Git。
5. 运行 `node scripts/restart-dev.mjs`，确认 Backend `8001` 与 Platform `5173` 均为 `OK`，只从 `http://localhost:5173` 访问四个 App。
6. 运行 `npm run verify`；当前基线为 56 个 TypeScript 测试文件 / 350 个测试、76 个 Python 测试、类型检查、依赖边界、设计检查和 Platform build 全部通过。
7. 浏览器本地数据不会随 Git 迁移。新电脑首次打开 Player 会安装 Daggerheart Core 与寻望之心两个预置包；Daggerheart 子职业和领域卡应直接显示卡图，不应先显示文字再依赖刷新修复。

## 建议 skills

- `$diagnosing-bugs`：真实 Player 交互、持久化或云恢复出现难以定位的问题时使用。
- `$browser:control-in-app-browser`：需要对本地 Player、Creator、GM 或 Market 做真实交互与视觉验收时使用。
- `$code-review`：指定本次迁移前的固定提交后，对 Player 大范围迁移做 Standards / Spec 双轴审查。
- `$handoff`：下次跨设备暂停时更新本文件。
