# L0/L1/L2 横向冲突检查快照

本文件是一次有明确输入基线的审计快照，不是会自动保持正确的永久“通过”声明。任何纳入范围的领域语言、ADR 或 GitHub PRD 正文变化都会使本结论过期，必须重新生成新快照。

## 快照基线

- 审计时间：`2026-08-16T18:32:15+08:00`
- 本地仓库基准 commit：`38de0019908d5b2394ac69d95e541438cea10a3b`
- 工作树状态：有未提交修改；不能只用上述 commit 复现本快照。
- 本地内容范围：`CONTEXT.md`、`docs/c4.md`、`docs/roadmap.md`、`docs/adr/*.md`，共 56 个文件；不包含本审计文件。
- 本地内容摘要：按规范相对路径排序，依次写入 UTF-8 路径、换行、原始文件字节、换行后计算 SHA-256，结果为 `739c6f8c9c9c3352edc36cd3013ad398d7e85717a93da5db35c7d5a0a9c272ad`。
- ADR 范围：ADR-0001—ADR-0053；历史正文保留，通过后续 ADR 的显式 supersede 链解释当前权威。
- PRD 范围：GitHub Issues #1—#22 的正文。评论只作决策证据；本次一致性判断以同步后的正文摘要为准。

| Issue | `updatedAt` | 正文 SHA-256 |
| --- | --- | --- |
| #1 | 2026-08-16 10:28:23Z | `6ac6147facad0bccebca94b9f6a0e289eb8142f1010ce688bbf397cfab6f3341` |
| #2 | 2026-08-16 10:28:24Z | `a83f1488868384f0f7ebbc83d8cbaa764859a7f5004be736cb09a41d789239d0` |
| #3 | 2026-08-16 10:28:25Z | `47f7a025c4b49f47603133858fe1272cd709e7634638c25879acbc6da2b24d60` |
| #4 | 2026-08-16 10:32:39Z | `3450b172bc0f7f8b03c5c4f4ac2e386a16c102a1f2bbc197ed532ef721e3d324` |
| #5 | 2026-08-16 10:28:27Z | `d519a637e5670a19590bf990bc3ccd61ac29c14c9fa4f5399fb0d33d7da09e62` |
| #6 | 2026-08-16 10:28:28Z | `f4a4c9f43248712cfc8ce4efe2da6fed1c8b4ec23406f17f2da30f2197a33bff` |
| #7 | 2026-08-16 10:28:29Z | `f607d0e4270313910c9cd0d8e84b54b0fc0d290ad2fba3c47aab542b7a72fb27` |
| #8 | 2026-08-16 05:16:25Z | `3bcb0618825ff7b81960f4ce3081ff11bb230f4d65f39a8b9bdcdd8e07a9f5da` |
| #9 | 2026-08-16 10:28:30Z | `b246da26c7ea76326879c1f18e0f6115dcb1a15273541c507e933955619d3728` |
| #10 | 2026-08-16 05:29:18Z | `f1d7d06c36b98b0c1452416e5037245962388c9d6ae7fa71b84fb71dfbf460b0` |
| #11 | 2026-08-16 05:33:59Z | `1b6d56cb52bc7faf8604be028bbc72a2abbf60bbe06a1bab95170347669fd4e4` |
| #12 | 2026-08-16 10:28:31Z | `b838210884fe47926b78da4e2d7e353e42f3c1ffa19eb1b358ef7e7d0273101a` |
| #13 | 2026-08-16 10:28:32Z | `d0a55a9efec8ac2905e2e763e7813ff93247c67d6213c2f07def7c752405b810` |
| #14 | 2026-08-16 05:39:24Z | `3c10477e8313bcccd7dde43c84f8ff9c34eda0947e29cc90753713d83ca1763c` |
| #15 | 2026-08-16 10:28:33Z | `947afb81f68b2ca50fbd6997a005a3d783fcd7aecb3e5d9a6922d7fdee972282` |
| #16 | 2026-08-16 10:28:34Z | `3e6be07324035f277717c5bfaa1bf8ee5c72e3c572672b9f62353bd36e7085b9` |
| #17 | 2026-08-16 05:42:20Z | `a117f8a0ca0b085c398ebe6e799ac0f21179137a0830b4ab101738db6630ecb7` |
| #18 | 2026-08-16 05:42:25Z | `0fe436bd843823ad5ef99905474e580a2cfc5524aa5392738c1a7420700763d3` |
| #19 | 2026-08-16 10:28:35Z | `6a347663caccf87a4f1ca20b1101e20ea11b8d2f808c2f7375880424fae0fc88` |
| #20 | 2026-08-16 05:43:51Z | `76c132144b1bef6d026dcf1e25073616ca1b837c3d23a89761b7d475512827df` |
| #21 | 2026-08-16 05:45:21Z | `e5c6144d858dc4788e33afca268bfebb1a96ba663f99785a198588492f86a2ff` |
| #22 | 2026-08-16 05:45:27Z | `3c14ff9bfa8b88c64277dbcbf44dfe05bf54e710741cfd95155db553c314e130` |

## 当前结论

状态：**在上述快照基线上通过。没有发现尚未裁决的 L0/L1/L2 直接冲突。**

本次重新检查关闭了四组此前存在的冲突：Resource Package 单目标/安装门禁、Character Data 写入职责、GM Tabletop undo/redo 与危险操作、独立 GM App 的旧 ADR 决策链。实现开始前仍须把这些决定落实为 Contract fixtures 和跨 L1 验收；“文档通过”不表示产品已经实现。

## 检查矩阵

| 检查项 | 结论 | 统一规则 |
| --- | --- | --- |
| 产品与部署 | 通过 | `GM Tabletop` 是独立 L1，但只作为 Creator App 的特殊 Tabletop Document 标签页实现；没有独立 GM App、入口或部署物。 |
| Workspace 与 Tabletop | 通过 | Creator/GM 共用左侧 Creator Workspace 和其危险操作警告；Tabletop Document 独立。桌面实例命令直接生效，无 undo/redo 或命令历史。 |
| Resource Package 安装与路由 | 通过 | Target System Package References 为可选分发与发现元数据；所有结构有效包可安装。资源 Template 命中当前 System Package 的 Resource Compatibility 时进入原生入口，其余进入 Other Resources。 |
| Player 资源应用 | 通过 | System Package 声明 Dependency，玩家触发选择，Player App 框架原子执行并写 Character Data；存档只保留最终值，不保留来源、选择或资源依赖。 |
| 快照与下游独立性 | 通过 | 上游资源、Publication、Workspace 或已安装包变化不会自动修改 Character Data 最终值或 Tabletop Instance Resource Copy；反向编辑也不会写回上游。 |
| 账号与云文档 | 通过 | 一个 PbDH Account；Character Save、Creator Workspace、GM Tabletop Document 共用 Cloud Document 机制，但保持独立 ID、payload、revision、删除和恢复生命周期。 |
| 游戏语义 | 通过 | 平台只理解 ID、Contract、Template、Module、事件和不透明值等平台语义；字段含义和格式由 Template/System Package 声明。 |
| 角色频率与复杂度 | 通过 | Player > GM > Creator > System Package Author > Platform Administrator；低频工作流保持直接、文件优先和可审查。 |
| License、Fork 与 Market custody | 通过 | License 只保存展示；Fork 仅由 Market 显式改编并最终发布触发；Publication 取消发布不召回已取得快照或有效文档媒体。 |
| Contract、Template 与 Renderer | 通过 | Contract Families 独立版本化；精确 Template 和 Renderer Revision 不可变；所有宿主共享 Canonical Renderer，宿主不重解释资源字段。 |

## 已确认的跨域决定

### C1：Resource License 只声明、不执行

Resource License 随 Resource Package Snapshot 保存并展示。平台不解释、验证或据此允许/禁止编辑、Fork、导出、发布、安装或发送到桌面。Market 所有权、举报和版权治理使用各自规则，不从许可字符串自动推导。

### C2：Player 与 GM 共用 Tabletop 数据模型

Player 把 Tabletop 数据嵌入 Character Data；GM 使用独立 Tabletop Document 信封与 `.pbtab`。二者共享实例、副本、布局和运行状态模型，但不共享外层生命周期。

### C3：既有文档媒体不可被上游召回

有效 Character Save、Creator Workspace 或 GM Tabletop Document 对已取得 Market 媒体建立持久、非所有权、非配额的私有读取引用。Publication 取消发布、平台下架或作者注销只停止新的公共取得；最后一条有效引用释放后才可回收。

### C4：Fork 只由明确 Market 改编触发

普通导入、复制、冲突另存和云冲突副本不自动成为 Fork。只有用户从已发布 Market 资源明确发起改编并最终发布新 Package ID，才建立非空 Fork Provenance。

### C5：三类 Cloud Document 使用统一机制

Character Save、Creator Workspace 与 GM Tabletop Document 共用本地先写、outbox、base revision、单活动会话、30 天回收站和恢复协议；登录前本地文档必须显式复制到云，payload 与领域生命周期保持独立。

### C6：Template compatibility 决定 Player 原生路由

Resource Package 可声明零个或多个精确目标引用，作为可选分发与发现元数据。Target 不限制安装、Other Resources 使用或原生路由；Player 逐资源按当前 System Package 对精确 Template ID 与版本范围的 Resource Compatibility 声明决定原生入口。安装仓库只保存一份 Package Snapshot，切换 Current System Package 重算路由视图。

### C7：资源选择是一次性 Player 写入

System Package 用 Dependency 声明资源库选择事件如何读取模板字段、格式化不透明值并写入目标 Module。玩家主动选择，Player App 框架执行。Character Save 不保存 `resourceSelections`、Library/Entry ID、Game Resource Reference 或来源；重新打开只恢复最终字段值。

### C8：Creator Workspace 与 GM Tabletop 操作模型分离

Creator 与 GM 共用左侧 Workspace 的删除、清空等危险警告。GM Tabletop 的实例修改、移除、清空、放置、状态和 Replacement 命令直接生效；第一版没有 undo/redo、持久命令历史或另一套桌面危险确认。

### C9：产品能力不等于部署物

Creator App 与 GM Tabletop 保持两个 L1 验收边界，但只有 `apps/creator` 一个组合根、入口和发布物。ADR-0051 显式 supersede ADR-0004、0005、0012 等旧独立 GM App 表述；旧渲染、桌面行为和权限语境中的 `GM App` 解释为 Creator-hosted GM Tabletop。

## 后续门禁

1. Resource Package Contract 首版直接采用 Target `0..N`，并以 fixtures 锁定集合规范化与可选分发元数据语义；Player 路由 fixtures 只按精确 Template ID、版本范围和本地实现可用性验证原生入口与 Other Resources 降级，不得用 Target 限制安装、访问或路由。
2. Player Resource Manager 的 Interface 只暴露一份安装快照和按 Current System Package 计算的路由视图，避免把系统隔离复杂度泄漏到每个调用方，保持 Module 的 Depth 与路由规则的 Locality。
3. Player 资源应用测试必须穿过同一个 Player Runtime Seam，证明 System Package 声明由 Player 框架执行、最终值原子写入且无选择来源持久化；不得用 App 私有 Adapter 绕过。
4. Creator/GM 联合测试分别验证共享 Workspace 警告与直接 Tabletop 命令，不能把一个 L1 的确认机制复制到另一个 L1。
5. 每次权威 ADR 或 PRD 正文变化后记录新 commit/工作树摘要和 Issue 正文摘要，再重新执行本检查；旧快照保留为历史证据。
