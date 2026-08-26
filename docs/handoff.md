# PbDH 开发交接

更新时间：2026-08-27

## 当前落点

- 分支：`main`；当前基线提交：`96ac0ba`。
- **工作区包含本轮全部实现但尚未提交。** 换机前必须把修改、新增的单包 `daggerheart-core.pbres`，以及 8 个旧分包 `.pbres` 的删除一起提交并推送；只拉取当前远端 `main` 会丢失本轮工作。
- 阶段 6 的 #38—#43 已完成；#44 已完成自动化实现并标记为 `ready-for-human`，等待真实 Player 交互验收。
- 本轮 Player 迁移固定来源为 `PbDH_sheet@0e44fa69b12209c172e4189e273615ba3a4d07a6`。
- 详细迁移范围、路径映射和验收标准见 [`docs/pbdh-sheet-player-migration.md`](pbdh-sheet-player-migration.md)；Character Save 边界见 [`docs/pbdh-sheet-character-save-migration.md`](pbdh-sheet-character-save-migration.md)。不要在本文件复制两份文档的内容。
- 当前工作项：[GitHub Issue #44](https://github.com/ZZZZzzzzac/PbDH/issues/44)。

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

- 本轮资源包与 Player 改动通过 54 个 TypeScript 测试文件、327 个测试，76 个 Python 测试、类型检查、依赖边界与 Platform build；单包归档实测 20,796,696 bytes。
- 真实浏览器已验证：Player 连续刷新稳定启动；资源管理器只安装一个 Daggerheart Core（625 资源、280 图片、8 个类型）；主武器选择、人物编辑、自动保存与刷新恢复正常；人物复制产生第二份可切换存档；正式 `.pbcha` 导入产生第三份存档且无诊断；头像经统一裁剪入口上传后可跨刷新恢复；创建向导显示 18 步；打印会在缺少必填车卡内容时给出预检查提示。
- `.pbcha` 导出按钮在真实页面执行后没有错误；内嵌浏览器不暴露应用通过 Blob 链接触发的下载事件，归档字节级写入/读取往返继续由 Contract 测试覆盖。
- `npm run verify` 当前被既有的 `Generated Creator Workspace design is stale` 设计一致性检查阻断；其余验证入口均已单独通过，本轮未改写无关 Creator 设计生成物。
- `node scripts/restart-dev.mjs` 最近一次健康检查通过：Backend `8001`，Platform `5173`。
- 本地 Supabase 登录沿用 `DaggerHeart_Battle/js/enemy_library_online.js` 的公开客户端 URL 与 anon key，已写入被 Git 忽略的 `.env.local`；重启后 `/api/auth/config` 返回 `configured: true`，Backend 与 Platform 健康检查通过。
- Creator 默认发布封面回归通过：相关 3 个测试文件共 31 个测试与 `npm run typecheck` 均通过；统一 `npm run verify` 仍只在既有 `Generated Creator Workspace design is stale` 检查处停止。
- 带独立封面的真实 Daggerheart Core Runtime 加载回归通过；Player 资源桥接、Market 交接、离线仓库与系统包相关 4 个测试文件共 19 个测试及类型检查通过。
- 本轮五项 Player 回归的 5 个定向测试文件共 16 个测试通过；完整 `tests/player` 共 15 个文件、58 个测试通过。真实浏览器确认：向导遮罩为 `rgba(18, 25, 27, 0.68)`、面板为实白色；四项图片标志和熟练度均为 `26px`；主武器 Picker 只显示“名称 / 属性 / 距离 / 伤害 / 负荷 / 伤害类型 / 描述”，领域卡只显示“名称 / 领域 / 等级 / 属性 / 回想 / 描述”；升级后新选子职卡使用 Blob 卡图。复测产生的临时卡牌已从本地人物存档清理。
- #44 已标记为 `ready-for-human`；自动发布 Issue 评论被外部安全审查拒绝，没有评论落到 GitHub。

## 回家后继续

1. 启动或确认 Platform：`node scripts/restart-dev.mjs`，只使用 `http://localhost:5173`。
2. #44 剩余真实环境验收只包括：允许弹窗后完成问卷创建全流程；使用已登录账号验证云同步、刷新恢复与云端回收站。内嵌浏览器未提供可用登录会话，也不暴露问卷 `window.open` 的新标签页。
3. 若验收发现问题，先写可复现测试再修复；不要回退为旧 Sheet schema、旧资源格式或独立 Player 顶栏。
4. 验收通过后关闭 #44，再进入 #45 的 Creator → Market → Player 与 Creator → Market → GM 两条联合纵切验收。

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
5. 先运行 `npm run verify`。当前预期它会在既有的 `Generated Creator Workspace design is stale` 停止；在该门禁修复前，分别运行 TypeScript 测试、Python 测试、类型检查与 Platform build，结果基线为 327 / 76 / 通过 / 通过。
6. 浏览器本地数据不会随 Git 迁移。新电脑首次打开 Player 会安装 Daggerheart Core `1.0.1`；如导入旧人物存档，存档内已嵌入的旧文字卡不会被强制改写，重新选择对应资源即可获得图片卡。

## 建议 skills

- `$diagnosing-bugs`：真实 Player 交互、持久化或云恢复出现难以定位的问题时使用。
- `$code-review`：指定本次迁移前的固定提交后，对 Player 大范围迁移做 Standards / Spec 双轴审查。
- `$handoff`：下次跨设备暂停时更新本文件。
