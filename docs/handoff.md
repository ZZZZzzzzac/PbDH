# PbDH 开发交接

更新时间：2026-08-27

## 当前落点

- 分支：`main`；当前提交：`95dacc5`，比 `origin/main` 超前 1 个本地提交；不要未经确认 push。
- 问卷弹窗修复与回归测试已提交：问卷 Host 改为静态导入，确保 `window.open()` 在菜单点击的同步调用栈中执行。
- 阶段 6 的 #38—#44 已完成；#45 正在联合验收。敌人与武器两条真实纵切的本地、Market、运行时、刷新和云边界已验证，剩余真实武器公开发布/匿名取得和独立设备恢复证据，Issue 尚未关闭。
- 本轮 Player 迁移固定来源为 `PbDH_sheet@0e44fa69b12209c172e4189e273615ba3a4d07a6`。
- 详细迁移范围、路径映射和验收标准见 [`docs/pbdh-sheet-player-migration.md`](pbdh-sheet-player-migration.md)；Character Save 边界见 [`docs/pbdh-sheet-character-save-migration.md`](pbdh-sheet-character-save-migration.md)。不要在本文件复制两份文档的内容。
- 下一工作项：[GitHub Issue #45](https://github.com/ZZZZzzzzac/PbDH/issues/45)。

## 本轮完成

- Player 已挂载完整 `SheetRenderer`、正式 Character Save Repository、云同步、`.pbcha`、统一图片准入、创建向导、问卷和打印。
- Daggerheart Core 已原生化为单个 `daggerheart-core.pbres`，共 625 个资源和 280 个唯一媒体资产；`.pbres` 已去除压缩归档总字节数限制。
- 修复首次打开 Player 时预置 System Package 尚未进入 Platform Runtime Storage、默认人物就提前保存的问题；现在先建立包缓存边界，再激活系统包和创建默认人物，并补了真实 Storage seam 的回归测试。
- Player 人物存档已从页面左栏移回 Platform App Bar；顶部按旧 `PbDH_Sheet` 保留“玩家功能 / 玩家存档 / 导入导出 / 系统包”四组下拉菜单。打印媒体样式会隐藏完整 Platform App Bar。
- Platform App Bar 已明确分成左右两组：PB/PbDH 与四个主页面 Tab 靠左且位置固定，各 App 独有工具、通知、设置与账号靠右；资源管理器详情栏恢复内部滚动；资源表行样式改为专用类名，避免与系统包 `.resource-row` 碰撞并挤压“生命 / 压力 / 护甲 / 希望”到“希望特性”区域。
- Creator 发布资源包时，未手动上传封面会固定选择资源列表第一张卡的首个已声明媒体，不再随当前编辑卡变化；第一张卡没有媒体时才退回资源包首个资产。Daggerheart Core 首张卡带有 `portrait`，可直接作为市场封面。
- Player 的 Sheet Runtime 桥接现在只注入原生资源卡实际使用的 `portrait` / `back` 媒体；资源包独立封面继续保存在安装快照中，但不再被误当成 System Package 图片并报告 `UNUSED_PACKAGE_IMAGE`。
- 修复创建向导 Portal 脱离主题变量作用域后遮罩与面板透明的问题：向导现在挂入 Player App Shell，并为遮罩、面板和操作区保留实色回退值。
- “生命 / 压力 / 护甲 / 希望”的图片标志不再走文字自适应缩放，并覆盖布局皮肤的 `11px` 后代字号；实际页面中与熟练度统一为 `26px`。
- “系统包”下拉菜单已移除重复的“管理资源包”入口；资源管理器仍保留在“玩家功能”菜单。
- Daggerheart Core 的 280 个带图资源现在写入 `image` 卡面模式，无图的武器、护甲等继续使用文字卡；内置资源包版本提升到 `1.0.1`，已有 `1.0.0` 安装会按最低版本自动刷新；运行时媒体资产带上资源包来源键，Card Table 能解析到对应 Blob URL。
- Player Resource Picker 的 `字段模板` 已改为显示白名单，并为种族、社群、职业、子职、武器、护甲、物品和领域卡配置了玩家有价值的精简列，不再显示 `ID`、卡图路径、卡背路径等内部列。
- 旧原型 `apps/player/src/PlayerAppPrototype.tsx` 和旧图片处理器 `apps/player/src/sheet-runtime/rendering/playerImageProcessor.ts` 已移入 Windows 回收站；Git 中记录为删除。

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
- #45 真实武器纵切已验证：Market 的“测试资源包”以标准 `.pbres` 安装到 Daggerheart Core 原生“武器”入口；Player 显示 2 个资源，主武器 Dependency 产出与描述在刷新后恢复；人物存档已同步；重复安装同一快照为明确 no-op。该出版物当前仍为未发布，仅作者账号可取得，不能据此宣称公开匿名取得已通过。
- 修复 Market 武器卡图被误报为 `UNUSED_PACKAGE_IMAGE`：动态资源媒体继续参与存在性与卡图引用校验，但只有真正的 System Package 图片进入“未使用图片”警告。新增回归测试后，真实 Player 资源管理器不再显示该警告。
- 390×844 自动化验收通过：关闭资源管理器后 Player、Market、GM 页面均无横向溢出；Player 主武器、Market 两个出版物、GM 两个独立敌人实例和移动端主导航均可见，控制台无错误；临时 viewport 已恢复默认值。
- 当前 `npm run verify` 通过：54 个 TypeScript 测试文件、329 个测试，76 个 Python 测试、类型检查、依赖边界、设计检查与 Platform build 全部通过。Python 仍输出既有 FastAPI/Pydantic 弃用警告，Vite 仍输出既有大 chunk 警告，均不影响退出码。

## 接下来

1. 获得明确授权后，把真实武器“测试资源包”发布为公开出版物，并在未登录会话验证匿名发现和完整包取得；发布是项目红线，不能自行执行。
2. 使用与当前浏览器不共享 IndexedDB 的独立浏览器会话登录测试账号，验证 Character Save 与 GM Tabletop 的云恢复；不要用同源刷新冒充两设备恢复。
3. 补齐上述证据后在 #45 发布完整验收矩阵，移除 `ready-for-human` 并关闭 Issue；若发现问题，继续先写复现测试再修复。

## 换机交接

### 当前电脑离开前

1. 先检查 `git diff --check` 与 `git status --short`。本轮改动横跨 Backend Contract、Creator 发布封面、Platform App Bar、Player Runtime、Daggerheart Core 生成物、测试和文档，不能只提交 `apps/player/src`。
2. 使用 `git add -A` 时确认以下归档迁移完整进入暂存区：新增 `apps/player/public/system-packages/daggerheart-core/resources/daggerheart-core.pbres`，删除同目录原有 8 个分包 `.pbres`。
3. 提交并推送当前分支后，记录新提交 SHA；不要把 `.env.local`、Supabase URL/anon key、`.venv`、`node_modules` 或浏览器 IndexedDB 提交进 Git。
4. 若不准备提交推送，必须复制完整工作区（包含未跟踪文件和删除状态）；仅复制已跟踪文件不足以恢复单包资源迁移。

### 另一台电脑开始时

1. 拉取包含本轮修改的新提交，确认 `git status --short` 干净，并检查单包存在：`apps/player/public/system-packages/daggerheart-core/resources/daggerheart-core.pbres`。
2. 安装 Node 依赖：`npm install`。创建项目 `.venv` 后安装 Python 开发依赖：`python -m pip install -r requirements-dev.txt`；不要使用全局 Python 包。
3. 单独重建被 Git 忽略的 `.env.local`。Supabase 配置沿用 `DaggerHeart_Battle` 的公开客户端 URL 与 anon key，但凭据只从安全的本地来源复制，不写入 handoff 或 Git。
4. 运行 `node scripts/restart-dev.mjs`，确认 Backend `8001` 与 Platform `5173` 均为 `OK`，只从 `http://localhost:5173` 访问四个 App。
5. 运行 `npm run verify`；当前基线为 TypeScript 328 / Python 76 / 类型检查通过 / Platform build 通过。
6. 浏览器本地数据不会随 Git 迁移。新电脑首次打开 Player 会安装 Daggerheart Core `1.0.1`；如导入旧人物存档，存档内已嵌入的旧文字卡不会被强制改写，重新选择对应资源即可获得图片卡。

## 建议 skills

- `$diagnosing-bugs`：真实 Player 交互、持久化或云恢复出现难以定位的问题时使用。
- `$code-review`：指定本次迁移前的固定提交后，对 Player 大范围迁移做 Standards / Spec 双轴审查。
- `$handoff`：下次跨设备暂停时更新本文件。
