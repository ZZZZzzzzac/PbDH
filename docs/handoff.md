# 开发交接

## 2026-09-09：工作区批量与文件夹复制（v0.1.12 已部署）

- v0.1.12（4c7705c）已发布部署：Release run 34370342377 完整 verify 通过，Deploy run 34370651217 成功；正式 current 指向 releases/0.1.12，服务 active、HTTPS health 正常。测试合计 1,053 项 TS、167 项 Python。
- 多选“复制到资源包”现在冻结全部选中范围，按源资源包分组传递到已有/新建目标，不再只复制右键卡牌。
- 文件夹右键新增“复制到资源包…”，递归复制文件夹、子目录、空目录及资源。目标同名文件夹自动避让，保留目标当前文件夹落点；不覆盖原资源。
- 同一批次的关联切换形态只复制一次，使用新资源 ID 重建关联，并复制图片与署名。成功通知显示实际复制数量。
- 模型测试覆盖多选与形态重叠、子目录/空目录、重复复制同名目录和源/目标不可变。真实 Chrome 本地页面已验证多选两张到新包，以及整文件夹到已有包，两种结果符合预期。

## 2026-09-09：市场信息编辑显示最低版本要求（v0.1.11 已部署）

- 完整 verify 通过：1,051 项 TS、167 项 Python；Release run 34365720021 与 Deploy run 34365990172 成功。正式服务器 current 指向 releases/0.1.11，服务 active、HTTPS API health 正常。
- 修复市场“编辑资源包信息”只提示提高版本、不说明最低要求的问题。信息更新冲突现在携带后端已经算出的 minimumVersion，通知说明新增、移除/更换或版本变更的目标系统原因，并提示“版本号至少需要 x.y.z”。
- 沿用 ADR-0053 和现有分类规则，不更改版本门槛，不修改数据库 schema；名称、介绍等仍可同版本编辑。
- 回归场景：从 1.0.0 新增目标系统，1.0.0/1.0.1/1.0.3 明确提示至少 1.1.0；更换目标系统提示至少 2.0.0。失败不改已发布版本，使用最低版本保存成功。前端 API 测试确认通知错误保留完整提示。

## 2026-09-09：正式域名迁移完成与系统包加载修复（最新）

本节覆盖下方测试部署、未切域名和待最终同步的历史状态。

- 用户授权后，daggerheart.cn 与 www 的 A 记录切到 192.243.116.94，现为 DNS only；chat Tunnel 保持原状。
- 首页已迁移并更新入口；/character → /pbdh/player，/battle → /pbdh/market，/pbdh 默认 Player，/SRD 使用完整生产站。
- PbDH v0.1.10 保持运行，正式认证配置已恢复；configured=true。没有进行真实账号登录验收。
- 旧站停止 PbDH/SRD 写入后完成最终一致性同步。14 账号、57 Publication、5,367 资源、121 媒体、37 云文档及 SRD 反馈库均核对一致，SQLite integrity_check 为 ok；未修改 schema 或清理旧回执。
- 最终私有归档位于新机 /srv/domain-migration-20260909/final/snapshot.tar.gz，SHA-256：44553c07255cbd12c6db00b9ae3a14cc6a2ca5c7e3d70cc5dc96c93b9f7e016a。旧机和新机恢复前备份保留。
- 正式 Nginx 配置由 Daggerheart_VPS/bandwagon/daggerheart-production.conf 管理。系统包目录使用 ^~，避免隐藏文件规则拦截公开清单 .pbdh-runtime-files.json；五个系统包共 145 个清单文件均通过 HTTPS 获取验证，四个非默认系统包通过正式站真实浏览器加载。
- 旧服务器应用停用，Nginx 转发新机以承接 DNS 缓存流量；TLS 上游验证深度为 4，健康检查通过。不可直接重启旧应用回滚，否则会分叉数据。
- Deploy Release 继续使用 bandwagon-preview Environment，PUBLIC_URL 已改为 https://daggerheart.cn/pbdh/；routes.yml 改为只读检查新机，避免旧路由工作流恢复旧部署。
- SRD 服务 srd-production 位于 /srv/srd-production，使用 5002；构建、9 项 Node 测试、编辑器无修改保存及 Git 推送 dry-run 通过。反馈备份 timer 启用。
- 正式域名已签发新的 Let's Encrypt 证书，续期使用现有 pbdh-preview-cert-renew.timer。正式域名续期 dry-run 通过；网站、跳转、认证保护与后端健康检查通过。

## 2026-09-09：搬瓦工 v0.1.10 HTTPS 测试部署（最新）

- 用户授权先迁移部署并测试网络，暂不切正式域名。新入口：`https://pbdh-preview.192.243.116.94.sslip.io/pbdh/`，直达 `192.243.116.94`。
- 应用 Release `v0.1.10`（`e244bc0`）已发布并部署；Release run `34358574396`、Deploy run `34359051363` 全部成功。CI 完整 verify 通过。
- `Deploy Release` 已改用独立 `bandwagon-preview` Environment；AlmaLinux 使用 Python 3.11，与制品 ABI 对齐。新机 `/var/www/pbdh-platform/current` 指向 `releases/0.1.10`，`pbdh-platform` active。
- 旧站在 UTC 13:41:30 生成一致性快照并恢复到新机；传输 SHA-256 两端一致：`c547672d0c18b004c50298f9a62b4734f9330249287a17011634395cd0722df0`。恢复前后 integrity_check 均 ok，57 个 Publication、5,367 项资源、121 个媒体（7,914,902 bytes），以及 14 个账号、37 个云文档的计数一致。
- 新机快照 `/srv/pbdh-migration-20260909/production-snapshot.sqlite3`，旧站备份 `/var/lib/pbdh-platform/bandwagon-snapshot-20260909/pbdh-20260909T134130Z.sqlite3`。均为私有数据，不公开或提交。旧站继续运行，切流前须最终同步；本次没有清理历史幂等回执。
- HTTPS 已签发证书、启用 HTTP/2/gzip；续期 timer 已启用且 certbot dry-run 通过。旧 IP HTTP 的 API 403 会返回 HTML，且不是安全上下文；完整应用请使用 HTTPS 地址。
- 真实浏览器确认车卡器启动、姓名编辑、种族资源选择、市场 57 包和封面、九州志异详情卡面，以及将该 180 项资源包安装到 Player 成功。最初一次跨代理请求有 15 秒超时，复试通过；不能据此宣称大陆各网络均已测速通过。
- 账号配置暂留空，`/api/auth/config` 返回 JSON `configured:false`；测试站暂不启用登录/云写入。旧服务器、正式域名和 SRD/sub2api 服务未切流。
- 新机旧 `pbdh-preview` 已停用，原目录与数据库保留供回退。运维配置和恢复边界详见 `deploy/README.md`。

## 2026-09-09：全部优化 Issue 已关闭（最新）

用户明确授权后，已逐项发布验收评论并关闭 GitHub #55–#68，共 14 项；再次查询全部为 CLOSED。本节覆盖下面历史段落中的“待授权关闭”状态。

- 实现与验收：`165fad6`；追加界面调整：`69a5d6f`。详细证据见 [优化验收记录](optimization-acceptance.md)。
- 最近完整验证通过：1,050 项 TypeScript、165 项 Python，以及类型检查、契约、依赖边界、测量与构建。
- 优化目标完成。尚未推送或部署；已有数据库迁移未执行，本次授权仅用于 GitHub 验收评论和关闭 Issue。

## 2026-09-09：界面命名与玩家桌面层级调整

- 用户追加的三处修改已完成：资源包右键菜单“关闭资源包”改为“删除资源包”；应用导航、Market 入口及使用说明统一为“卡牌工坊”；玩家卡牌容器建立独立层叠上下文，卡牌内部置顶不再超过侧面工具栏。
- 真实本地浏览器确认导航名称，以及卡牌容器 `z-index: 0`、同级侧栏 `z-index: 6` 的层叠关系。没有改变资源包删除流程。
- 修改后 `npm run verify` 全部通过：1,050 项 TS、165 项 Python，类型检查、依赖边界、测量及构建通过；日志 `.scratch/ui-label-layer-verify.log`。
- 本轮之前优化收尾提交为 `165fad6`。GitHub #55–#68 的关闭仍等待明确授权，未推送或部署。

## 2026-09-09：优化续作验收完成（最新）

本节优先于后面的历史停点。实际工作目录为 `D:\Game\Daggerheart\PbDH`，本轮开始时 HEAD 为 `9cd5b22`，工作树干净；之前交接所列未提交实现已在该基线中。

- #55–#68 的本地实现与验收已汇总至 [优化验收记录](optimization-acceptance.md)。本轮补完 #62 导入图片归一化、#65 新幂等回执增长上限，以及 #66 最老模板隐式全量加载和浏览器失败缓存导致重试失效的问题。
- 最终 `npm run verify` 退出码 0：1,050 项 TS、165 项 Python，类型检查、契约、依赖边界、测量和构建通过。`git diff --check` 通过。
- Browser 插件在真实本机页面验证冷启动、1,000 项混合历史版本、当前卡编辑、GM 操作、Market 51 项资源包，以及 renderer 文件缺失后恢复重试。详细指标和保真边界见验收记录。
- `node scripts/restart-dev.mjs` 完成 Backend 8001 与 Platform 5173 全部健康检查；生产预览另在 4173 运行。本机 Python 缺少的 Pillow 已安装到 `.venv`。
- 没有执行已有数据库迁移。151 条旧回执只读测得约 40 MB，工具预计可紧凑至约 60 KB；应用需要用户单独批准并备份。新回执不再保存正文，最多 256 条/文档、30 天，不改 schema。
- 尚未推送或部署。GitHub 仍待明确授权写入验收证据并关闭 #55–#68；不得把本地完成说成 Issue 已关闭或线上已更新。

下面的旧目录、旧 HEAD、未提交清单和待验收状态仅作为历史证据。

## 2026-09-09：优化工作下班停点（最新）

用户要求停在合适位置，保存交接后下班。本节优先于下面的历史发布记录；不要把历史的“已推送、已部署”套用到本轮优化。

### 现场状态

- 工作目录：`D:\Fish\TRPG\PbDH`。HEAD 为 `29788b6`，本轮此前的修复已经形成多笔本地提交，但没有推送或部署。
- 今天最后一批 #62/#63/#66 修改仍在未提交工作树中；保留现场，不 reset、不丢弃、不把它们误认为用户无关改动。
- `AGENTS.md` 已按用户要求新增“执行与收敛”：先梳理完整链路，按用户能力成批完成；中间只做针对性验证，收尾跑全量；不要以提交数或测试数充当进度。该修改也未提交。
- 下班前已运行 `node scripts/restart-dev.mjs`，Backend 8001、Platform 5173 及脚本要求的模块健康检查通过。本地服务留着，没有停服；新加的 `core/validation` 导出已随重启生效。
- 本批未做新的完整浏览器验收、未跑完整 `npm run verify`，不能标记三个 Issue 完成。

### Issue 状态

本轮优化为 #55–#68，共 14 项。最近一次 GitHub 查询中它们全部仍为 OPEN。

| Issue | 状态与内容 |
| --- | --- |
| #55–#61 | 已有本地实现与验证：保存失败保留编辑、同步回执隔离、草稿门禁、真实媒体校验、渲染异常隔离、真实性能测量、行为测试。待用户验收与发布。 |
| #64 | 流式摘要与发布链路重复校验削减已有本地实现与验证。 |
| #67 | 自动版本建议、手动覆盖、最终内容复核与 Player 兼容测试已有本地实现。 |
| #68 | 主动登录接管、取消专用轮询、实际请求通知失效；被动刷新保留账号/工作区，避免切浏览器标签页时暂时消失。已有本地实现。 |
| #62 | 当前批次正在收尾：普通字段更新已改为文档与媒体增量分离，仍需下述导入图片边界检查及完整验收。 |
| #63 | 当前批次正在收尾：只保存变化桌面，再只校验/写入变化媒体；同步回执改为仅刷新同步状态。尚未整体验收。 |
| #66 | 静态入口已移除全部历史实现；本批进一步消除隐藏首次恢复和恢复校验触发的 Core 加载。尚需真实运行时验收。 |
| #65 | 未实施。历史幂等回执清理涉及数据处理，仍待用户明确授权；不在本次“完成部分完成项”的授权范围内。 |

### 本批未提交实现

**#62：角色字段更新与媒体变化分开**

- `character-save-repository.ts` 新增 `getDocument`、`saveUpdate`：普通保存不读取旧图片正文；保留已有媒体 ID，只校验新传入的媒体字节。原 `get`、`save` 和外部导入的完整校验仍保留。
- `characterSaveAdapter.ts` 新增 `prepareCharacterSaveUpdate`，返回 `document` 与 `mediaUpdates`；完整候选导出仍通过 `sheetCharacterToSave` 合并所需媒体。
- `platformRuntimeStorage.ts` 的普通保存、当前角色保存、重命名已接入增量接口；`onCharacterSaved` 现在只承诺文档与同步状态，不再承诺媒体正文。
- 未变头像通过内容地址 ID 复用；换图片 ID 会重新准入。已经用真实 Repository 测试确认只改名称时旧媒体读取和 SHA-256 调用均为 0，错误新字节与缺失引用仍拒绝写入。

**#63：桌面增量保存与同步回执**

- `tabletop-document-repository.ts` 新增 `saveUpdate`：检查文档/引用与新媒体；若旧资产的描述发生变化，才读取该资产字节重新核对。原完整保存/导入仍保留。
- `use-creator-document-persistence.ts` 记录已恢复/成功保存的模型与媒体基线，普通编辑只向 `saveUpdate` 传入变化媒体；失败不更新成功基线。
- `cloud-document-service.ts` 的 `flush`、`enable` 改为返回 `CreatorCloudSyncSnapshot`；`applyCloudSync` 只刷新同步状态，不再为了回执重新读取全部 Workspace/Tabletop 媒体、校验模板并重建文档。
- `packages/local-storage/src/index.ts` 的媒体存在性检查改用已有主键索引，不再 `bulkGet` 整个媒体记录。没有修改 IndexedDB schema，也没有做迁移。
- 测试确认字段更新不读/哈希旧媒体；错误新字节、错误字节长度仍拒绝写入；同步回执不调用领域 Repository 的全列表恢复或媒体读取。

**#66：运行时恢复不执行无关历史能力**

- 已提交的 `29788b6` 把初始静态闭包中的 Core、渲染器、编辑器版本数全部降到 0，并设了构建门禁。当时初始 JS gzip 为 408,614 字节，不是本批最终体积。
- 未提交的 `restoreStarted` 门禁使隐藏的 Creator 首次不读取本地/云端文档；首次进入后开始恢复，后续隐藏/切换保留状态，不反复恢复。首次本地恢复未完成时只显示等待界面。
- 新增 `packages/templates/src/core/validation-metadata.ts` 与 `@pbdh/templates/core/validation` 入口。恢复校验需要的是状态 Schema 和替换声明，不是渲染、默认状态或升级函数；现有 40 个版本只有两种状态 Schema，替换声明来自既有 `catalog.json`。
- Creator 的资源包/桌面恢复校验已使用上述只读元数据，不调用 `loadTemplateCore`。一致性测试逐版本对照原能力的 Schema 和替换声明；非法状态仍会被拒绝。
- 元数据是对当前声明的轻量投影，不是删减历史兼容。以后新增/改变状态规则时，必须保持该一致性测试通过。

### 已验证与未验证

- 本批最终 `npm run typecheck` 通过。
- 停点相关测试通过：59 个文件、461 项测试。命令：

```powershell
npx vitest run tests/creator tests/contracts tests/templates tests/local-storage tests/player/character-save-repository.test.ts tests/player/platform-runtime-storage.test.ts tests/player/sheet-runtime-character-save-adapter.test.ts --maxWorkers=2
```

- 新测试包括角色/桌面媒体读取和哈希计数、坏字节拒绝、同步回执不恢复全文、40 版本元数据一致性、恢复校验不加载 Core。
- 最后一次完整验证是本批之前的 1041 项 TS、162 项 Python；不可用这个结果代替本批完整验证。先前高并发时两个内置资源测试偶发 5 秒超时，降低并发后通过，未改超时门槛。
- 停点 `git diff --check` 通过，仅有既有 CRLF 转 LF 提示；不因纯文档修改再跑全仓测试。

### 下次接续顺序与风险

1. 先读 `AGENTS.md` 的“执行与收敛”和当前 diff，不重新做全仓调查，也不再拆成逐文件小提交。
2. 核对外部导入图片的 ID 归一化：`characterFormatAdapter.ts` 会产生 `player-image-*` ID，而增量保存复用条件是运行时 imageId 等于存档中的内容地址。`persistImportedCharacter` 保存后仍保留原 UI 数据，可能导致这种导入图片在后续字段保存时重复准入。普通上传使用 `admitted.id`，已覆盖；这个导入分支尚未补验/修正，#62 不能直接关闭。
3. 补齐 #62/#63 的端到端保存计数，特别是带图片角色导入后连续编辑、桌面连续编辑及云同步。检查首次恢复基线和账号切换时的同步状态，不只看 Repository 单测。
4. 对 #66 做真实页面冷启动、Creator/GM/Player/Market 切换、混合历史版本、失败重试验收。应核对恢复不触发无关 Core、当前引用仍能显示和操作。现有构建门禁只证明静态闭包，不等于所有运行时路径已验收。
5. 完整能力收尾后再统一运行 `npm run verify`、测量与必要的浏览器验收；通过后更新三个 Issue 的证据，再提交。推送、部署仍须用户明确授权。

已知独立问题：浏览器曾出现“云端 Creator Workspace 无效：contract.schema.invalid”。本地编辑器仍能打开；这不是已修好的云恢复，也未单独建 Issue，不要静默放宽校验绕过。云恢复结束时替换 UI 快照的路径也尚未在本批重新做完整编辑竞争验收。

GitHub 写入限制：此前向 #68 写详细实现评论被权限审查拒绝。未换手段绕过；后续需要明确授权再写，不得声称评论已同步或 Issue 已关闭。

### 必须保留的其他改动

以下在本轮开始前就存在，属于用户/其他任务，不要回退或混入优化提交：`apps/player/public/system-packages/tttri/system.json`、`apps/player/src/tttri-system.generated.json`、`scripts/sync-tttri-sheet-update.ts`、`tests/player/tttri-september-update.test.ts`、未跟踪的 `docs/user-guide.md`。

本批新增未跟踪代码：`packages/templates/src/core/validation-metadata.ts`、`tests/templates/validation-metadata.test.ts`，是本批实现，不是可清理的临时文件。没有修改 `.env`、凭据、CI/CD，没有删除用户文件。

---

## 2026-09-09：0.1.9 与主入口切换

- 应用提交 `7a24605`，双入口运维脚本提交 `302ac31`；全部已推送。
- Release `v0.1.9` 完整验证成功：971 项 TypeScript、153 项 Python；新增路由变换测试 2 项单独通过。
- Release run `34253358247`、Deploy run `34253717573`、路由切换 run `34253848911` 均成功。
- `/pbdh/` 提供 Platform 0.1.9，默认跳转 `/pbdh/player/daggerheart-core`；浏览器确认匕首心人物卡、教程与工具栏正常。
- `/pbdh_tools/` 提供旧 Sheet 2.3.0，浏览器确认既有卡图和 `/pbdh_tools/tttri` 正常。旧制品保持不动，独立部署副本仅调整资源基路径。
- 两个公开入口及 `/api/health` HTTP 200；Environment `PUBLIC_URL` 已更新为 `/pbdh/`，后续部署检查新主入口。回退使用 routes.yml 的 rollback 模式，详见 deploy/README.md。
- 待修：当前浏览器已有新版 TTTRI 存档版本为 1.0.6，切换到 1.1.0 提示缺少升级链；未修改或删除该存档。新版 TTTRI 路由返回 0.1.9，但这份历史存档阻断浏览器验收，不应记为 TTTRI 全部通过。
- PDF 每页末行已通过真实保存文件验收；卡多时预览仍卡顿，用户要求暂缓优化。

## 以下为 0.1.7 历史交接

日期：2026-09-07

## 当前状态

本轮功能及素材整理已提交并部署为 `v0.1.7`。发布提交：`5e60f64`。

## 变更

- 市场更新时间使用真实时间戳；资源管理器按钮分为新建、导入导出、发布三组。
- 第三方资源包导入统一显示 dhcb，位于 PBRES 下方第一项，仅接受 `.json`、`.dhcb`；人物存档仍使用 dhsheet。
- 转换核心清理纯文本字段 Markdown、武器距离中的“范围”；修复九州志异嵌套强调标记导致特性标题及正文残留，保留正文 Markdown。
- Creator 支持当前卡图重新裁剪；共享标题按单行缩字，新增敌人模板 1.0.5 并增大生命点、压力点字号。
- 账号云空间按资源包/文档显示图片占用、回收站与可释放空间，总量去重；读取现有配额配置。Creator、Player、Market 显示包内图片大小。
- 发布新增 Backend API 1.1.0，保留 1.0.0；无数据库 schema 变更。
- 包含 docs/third 素材整理；旧 GM 包和与龙同行包作为固定回归样本迁入 tests/fixtures/resources。

## 验证证据

- 浏览器验收资源按钮分组、dhcb 文件筛选、重新裁剪取消与确认、长标题缩字、敌人字号、账号云空间与市场时间。
- 使用原始《九州志异1.5（猫猫头卡包）》导入 180 项资源，零跳过/失败；侠士的三个特性标题及正文显示正常。
- 完整 npm run verify 通过：109 个 TypeScript 测试文件、895 个测试；Python 152 个测试；类型检查、Contract、依赖边界、渲染测量和构建通过。GitHub Release 工作流完整验证亦通过。

## 发布流程

按 deploy/README.md 推送版本标签，Release 工作流完整验证并构建不可变制品，再运行 Deploy Release 更新当前 Platform 入口，检查公开版本标记、Backend 健康和浏览器页面。

## 发布结果

- [Release v0.1.7](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.7) 发布成功。
- [Deploy Release](https://github.com/ZZZZzzzzac/PbDH/actions/runs/34139148361) 成功。
- 公开页面版本为 0.1.7，Backend 健康返回 ok。
- 浏览器完成线上工坊加载与市场导航，资源目录及真实更新时间显示正常。
