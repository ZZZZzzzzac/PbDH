# PbDH 产品设计路线图

本文记录从 L0 平台 PRD 收敛到完整 PbDH 生态交付的顺序和阶段门禁。它是依赖与验收路线，不是发布日期承诺；具体功能状态以对应 GitHub Issue 为准。

## 当前状态

- L0 `PbDH Platform` PRD：已发布为 GitHub Issue #1 并完成审阅，产品边界已冻结。
- C4 L1/L2：已记录当前系统上下文和运行容器；未定义的 L3/L4 保持留白。
- L1 PRD：六个 L1 均已发布并完成审阅；`GM Tabletop`（#6，原 GM App）与 `Market`（#7）已完成 grill 和 triage，全部作为开放父 Issue 保留。
- L2 PRD：首条敌人资源纵切所需的 #8—#22 已全部发布、完成 triage，状态均为 `ready-for-human`，并作为开放父 Issue 保留。它们覆盖 Contracts/Template/Renderer、最小 System Package、Creator、Player、GM Tabletop、Market，以及三个产品各自的 Cloud Document 连续性。
- 产品实现：阶段 5 已完成；#23—#33、#35—#41 已完成。阶段 6 已拆为 #38—#45 并完成 triage；Market 敌人交接到 GM 与本地恢复 #40、Market 武器交接到 Player Resource Manager #41 均已通过人工端到端验收；Publication 更新、取消发布、重新发布与主动拉取 #42 已完成自动化验证，等待人工验收。
- 下一步：人工验收 #42；通过后进入敌人路径的 Creator 与 GM 云恢复 #43。

## 推进模型

Issue 层级固定为：

```text
L0 平台 PRD
└── L1 产品父 Issue
    └── L2 用户能力 PRD
        └── 可独立领取的实现 Issue
            └── Pull Request
```

推进不采用“先完整做完一个 L1，再开始下一个 L1”的瀑布顺序。先用一份真实敌人资源形成跨 L1 的 tracer-bullet 纵切，证明 Contract、Template、Renderer、文件交换、App 消费、Tabletop、Market 和 Cloud Document 边界可以共同工作，再扩充模板、内容和各产品剩余能力。

L0、L1 和 L2 PRD 都是开放父 Issue：实现 Issue 完成后才关闭所属 L2；一个 L1 的所有 L2 完成后才关闭该 L1；六个 L1 全部完成并通过生态发布门禁后才关闭 L0。

## 设计—实现双轨循环

纵切是一个可由用户从入口走到结果、同时穿过所需 UI、业务逻辑、Contract、持久化和测试的真实用户结果，不是单个页面、组件或纯视觉稿。第一条纵切使用阶段 6 的同一份敌人资源，覆盖该路径真正触达的 Creator、Player、GM Tabletop、Market 和 Cloud Document 表面；不要求先设计四个产品的全部页面。

启动阶段先完整跑通一轮，不提前并行扩面：

1. 从已审阅的 L2 中选定纵切边界，在实现 Issue 记录入口、最终结果、依赖、非目标和可验证验收条件。
2. 建立 PRD 覆盖表，把每项验收映射到页面区域、弹窗、侧栏、编辑态、拖拽反馈、空白/加载/错误/权限状态和响应式变化；无关状态不因“以后可能需要”进入本轮。
3. 在 OpenPencil 中先做低保真线框和层级说明。人工评审布局、信息层级和缺漏后，再收敛 Platform UI 的单一浅色中性主题；系统包、桌面内容和卡牌渲染主题仍由各自既有边界负责。已覆盖界面的视觉、布局、组件层级与状态表现以 `.op` 为唯一设计源。
4. 从 `.op` 形成可审查的设计规格/实现映射，再在真实 App 外壳中生成或实现可交互浏览器原型；localhost 只作运行验收结果，不与 `.op` 并列维护。原型使用受控 fixtures 验证操作顺序、状态转换和视觉反馈，可以暂未接通后端，但不得伪装成纵切完成，也不得发明与正式 Contract 不同的临时数据模型。
5. 接通真实 Contract、业务逻辑、持久化和跨 App 边界，把原型收敛为产品代码；通过自动化测试、PRD 覆盖回读、`.op` 到实现映射检查和人工交互/视觉验收。无法忠实实现的设计差异必须显式记录并回到 OpenPencil 决策，禁止静默分叉。
6. 把实现中发现的错误假设回写到对应 PRD、ADR、覆盖表或设计稿，再关闭本轮实现 Issue；不得只修代码而让设计证据继续表达旧行为。

第一条完整纵切通过后进入稳态流水线：实现纵切 N 时，设计纵切 N+1；设计最多领先一条，不开始 N+2。N+1 的设计可以在 N 编码期间评审，但只有 N 完成真实端到端验收后，N+1 才进入产品实现。共享外壳或交互规则因 N 改变时，先同步 N+1，再继续编码。

每轮的正式范围、覆盖表、评审结论和验收证据归属对应 GitHub 实现 Issue。`.scratch/openpencil/` 中的 `.op` 是可编辑工作源，不单独成为产品权威；需要长期保留的设计决策进入 ADR，产品行为仍以 PRD、Contract 和验收测试为准。

## 阶段 1：冻结 L0

阶段状态：已完成（GitHub Issue #1）。

1. 已将经审阅的 `PbDH Platform` L0 PRD 发布为正式 GitHub Issue。
2. 已完成正文回读与 triage；Issue 作为后续 L1 的开放父项保留，待其全部功能完成后关闭。
3. 后续 L1/L2 不得静默覆盖 L0、`CONTEXT.md` 或已接受 ADR；发现冲突时先修订上层权威。

完成标准：L0 Issue 成为六个 L1 PRD 的共同产品边界。

## 阶段 2：依赖优先编写六个 L1 PRD

按以下顺序进行。顺序表达设计依赖，不代表产品发布日期。

### 1. Contracts & Template Platform

先定义所有应用共同遵守的合约、模板、渲染、资源转换、版本兼容和一致性测试边界。它是其他 L1 的共同地基。

状态：已完成 PRD 审阅（开放父 Issue #2）；待其 L2 与实现子项全部完成后关闭。

### 2. System Authoring Workflow

定义系统包、资源兼容声明、角色数据结构、角色格式适配器、校验和玩家运行时预览。它依赖平台合约，但不依赖独立作者应用。

状态：已完成 PRD 审阅（开放父 Issue #3）；待其 L2 与实现子项全部完成后关闭。

### 3. Creator App

定义游戏资源创作、Creator Workspace、规范卡面预览、资源转换、资源包组装、文件导入导出、云同步和市场发布动作。Creator App 同时是 GM Tabletop 的前端宿主，但不接管其 L1 产品验收所有权。

状态：已完成 PRD 审阅（开放父 Issue #5）；待其 L2 与实现子项全部完成后关闭。

### 4. Player App

定义 PbDH Sheet 成熟玩家行为的迁移边界，以及当前系统包、角色存档、资源管理器、兼容路由、“其他资源”和玩家卡牌桌面。

状态：已完成 PRD 审阅（开放父 Issue #4）；待其 L2 与实现子项全部完成后关闭。

### 5. GM Tabletop

定义 Creator App 内的特殊 Tabletop Document 标签页、跨 Creator Workspaces 的资源浏览、显式放置、桌面实例资源副本、实例定义修改、运行状态、`.pbtab` 文件导入导出和桌面云同步。它不是独立 App 或部署物，也不拥有 GM Resource Workspace。

状态：已完成 L1 grill 和 triage（开放父 Issue #6）；其 L2 与实现子项全部完成前保持开放。

### 6. Market

定义公共资源发现、规则标签筛选、市场出版物、稳定分享链接、资源包安装与显式更新、公共媒体引用和作者生命周期。

状态：已完成 L1 grill 和 triage（开放父 Issue #7）；其 L2 与实现子项全部完成前保持开放。

每个 L1 PRD 开始前先列出其 L2 能力地图；L1 只定义产品范围、能力关系、共同规则和产品级验收，不提前写页面或代码结构。

完成标准：六个 L1 都有经审阅的正式 Issue，且每个用户能力只有一个明确拥有者。

## 阶段 3：横向冲突检查

阶段状态：已完成，并在权威规则或 PRD 变化后重新生成带基线的审计快照。#6/#7 已完成 triage；Resource License、Tabletop Document 共享模型、统一云存档策略、Fork 来源与手动触发边界，以及 Market 媒体撤回后的既有云文档读取授权均已统一。

六个 L1 完成后，逐项检查：

1. 每种数据由谁创建、拥有、修改、持久化和删除。
2. 每个跨产品动作使用哪个平台合约。
3. 哪些边界传递快照，哪些边界只传稳定引用。
4. 哪些更新必须由用户明确触发，是否出现静默升级。
5. 哪些能力必须离线可用，远端依赖失败时如何降级。
6. 统一账号是否错误地合并了角色、工作区、桌面或市场数据。
7. 共享模块是否引入共享可变状态、反向依赖或中央在线运行前提。
8. 系统包、资源模板、游戏资源、角色存档和桌面实例副本是否发生职责混淆。
9. 同一规范卡面在不同应用中是否仍由精确模板版本和同一渲染器修订版生成。
10. C4 图、`CONTEXT.md`、ADR 和 PRD 是否表达同一组边界。

发现冲突时，先确定哪一层权威需要修改，再继续拆分 L2，不用下层 PRD掩盖问题。

完成标准：形成一份冲突检查结果；每份结果记录审计时间、仓库 commit、工作树状态、纳入的 ADR 范围，以及每个 GitHub Issue 的编号、URL 与 `updatedAt`。权威规则或 PRD 更新后必须生成新快照，旧快照不能继续充当当前通过证明；未解决冲突不得进入对应 L2 实现。

## 阶段 4：发布首批最小 L2 PRD

阶段状态：已完成。首条纵切所需的 #8—#22 均已发布并完成 triage，状态为 `ready-for-human`；所有 L0/L1/L2 PRD 保持开放。

不先写完所有 L2。只发布第一条敌人资源纵切真正依赖、且能在单一 L1 内独立验收的用户能力。发布顺序表达依赖，不要求前一个 L2 的全部实现结束后才开始编写下一个 L2。

### 4.1 Contracts & Template Platform

1. `平台合约生命周期治理`（#8，已发布并完成 triage，`ready-for-human`）：首条纵切只实现 Resource Package Contract `1.0.0` 发布所需的状态、诊断与 conformance 门禁，不预先补全其他 Contract Family。
2. `Resource Package 互操作`（#9，已发布并完成 triage，`ready-for-human`）：定义真实 Resource Package 的身份、版本、目录/ZIP、`.pbres`、自包含媒体、安全校验、诊断与生产者—消费者验收。
3. `可信资源模板生命周期`（#10，已发布并完成 triage，`ready-for-human`）：首批只要求一个真实敌人 Template 的精确版本、Schema、默认数据、投影、媒体槽位、桌面声明和 fixtures。
4. `规范资源呈现`（#11，已发布并完成 triage，`ready-for-human`）：首批只要求同一敌人资源在 Creator、Player、GM 和 Market 中使用同一精确 Renderer Revision 产生一致卡面。

`资源格式转换` 不因首条纵切自动进入首批 L2。官方敌人数据可以通过有来源记录的一次性迁移进入；通用 Adapter 平台和 `.dhcb` 双向转换在纵切成立后扩面。

### 4.2 System Authoring Workflow

5. `System Package 创作与资源兼容声明`（#12，已发布并完成 triage，`ready-for-human`）：建立首条纵切所需的最小 System Package 创作与运行时声明能力，产出一个真实 Daggerheart System Package，供 Player 验证按精确 Resource Template ID 与版本范围声明的原生路由兼容性；不把 Loader、CLI 或 Preview 实现组件升格为产品能力。

### 4.3 Creator App

6. `Creator Workspace 资源创作与包交换`（#13，已发布并完成 triage，`ready-for-human`）：创建和编辑敌人资源，保存本地工作区，并导入、导出完整 `.pbres`。
7. `Creator Workspace 云连续性`（#14，已发布并完成 triage，`ready-for-human`）：在保持匿名、离线、本地优先的前提下，按统一 Cloud Document 策略同步 Creator Workspace。

### 4.4 Player App

8. `Player 资源取得与兼容路由`（#15，已发布并完成 triage，`ready-for-human`）：导入同一个 `.pbres`；所有结构有效的资源包均可安装，资源 Template 命中当前 System Package 的 Resource Compatibility 时进入原生资源区域，不兼容或无法执行精确 Template 时进入“其他资源”；目标系统引用只作可选分发与发现元数据。
9. `Character Save 云连续性`（#16，已发布并完成 triage，`ready-for-human`）：Character Data 与嵌入的玩家桌面状态作为同一个 Character Save 同步；玩家在资源库选择后由 Player 框架执行 System Package Dependency 并保存最终字段值，不保存游戏资源引用、Resource Package 依赖或资源选中状态；不建立独立玩家桌面云文档，也不同步 Resource Package 安装状态。

### 4.5 GM Tabletop

10. `GM 桌面文档生命周期`（#17，已发布并完成 triage，`ready-for-human`）：保存单桌面的实例定义、运行状态和布局，并完成 `.pbtab` 单桌面导入导出。
11. `GM 资源浏览与显式放置`（#18，已发布并完成 triage，`ready-for-human`）：从 Creator Workspace 显式放置敌人资源，创建独立 Tabletop Instance Resource Copy；来源后续变化不静默修改桌面实例。
12. `GM 资源卡片桌面操作`（#19，已发布并完成 triage，`ready-for-human`）：以共享 Tabletop Core 和 Canonical Renderer 完成移动、外层等比缩放、Template 声明状态命令和受限实例私有编辑；桌面命令直接生效且不提供撤销/重做，左侧 Creator Workspace 的危险操作统一使用 Creator 警告流程。
13. `GM Tabletop 云连续性`（#20，已发布并完成 triage，`ready-for-human`）：每张 GM Tabletop Document 作为独立 Cloud Document，同 Creator Workspace 的同步与 revision 完全隔离。

### 4.6 Market

14. `Market 出版生命周期`（#21，已发布并完成 triage，`ready-for-human`）：由 Creator 显式发布同一个完整 Resource Package Snapshot，Market 原子建立当前 Publication。
15. `Market 资源取得与 App 交接`（#22，已发布并完成 triage，`ready-for-human`）：匿名下载 `.pbres`，显式安装到 Player、导入 Creator，或“发送到桌面…”后选择桌面；任何路径都不得静默放置资源。

公共资源发现和最小市场治理不必阻塞最早的发布—取得纵切，但必须在 Market L1 完成前分别作为 L2 完成。

### 4.7 Cloud Document 关联验收

16. Creator Workspace（#14）、Character Save（#16）和 GM Tabletop Document（#20）分别在其所属 L1 接入已确认的统一云文档策略。共享 Backend 是实现边界，不创建无产品所有者的“全平台云同步 L2”；三个文档类型分别验收本地优先、显式登录复制、自动同步、冲突、删除恢复和媒体读取引用。

每个 L2 必须属于一个 L1，并能独立验收。跨域纵切通过关联验收连接这些 L2，不创建无所有者的“全平台功能”Issue。Digest 字节布局、Schema 字段名、Profile 具体数值和所选库等实现细节不阻塞 L2 发布，应进入 Contract 或实现子 Issue。

完成标准：已达到。首批 L2 共同覆盖一条可运行、可测试、可离线传递并可跨设备恢复的敌人资源闭环，且没有为了纵切扩写社区、完整 VTT、历史快照等无关产品范围。

## 阶段 5：实施准备与 Issue 拆分

阶段状态：已完成。实现 Issue #23—#33 与 #35—#37 已完成；正式武器 Template、Renderer、Creator 创作链路、Player 主武器最终值写入、Creator 内 GM Tabletop 敌人桌面原型、Creator Workspace 成熟行为及 Market 双交接设计与原型均已接通并通过对应验收。

进入产品代码前完成：

1. 把首批 L2 拆成可独立领取的 tracer-bullet 实现 Issue；每个 Issue 写明外部行为、输入输出 Contract、验收测试、依赖和不在范围内事项。
2. 建立 monorepo 的最小目录骨架和自动化依赖边界检查，守住 `contracts/`、共享 packages 与 `apps/` 的依赖方向。
3. 建立跨语言 Contract conformance、Template/Renderer 一致性和单一验证入口；不得使用只供某个 App 的临时 Schema 或伪 Renderer 穿过纵切。
4. 为 Resource Package Contract `1.0.0` 建立真实语料、正反例、安全边界和 known-answer fixtures；具体 Profile 上限在正式发布前根据语料和压力结果冻结。
5. 记录从 `PbDH_Cards`、`PbDH_sheet` 或其他旧来源复制的每份代码、测试和数据的来源仓库、commit 与原路径。
6. 冻结首条纵切使用的一份敌人资源、媒体和预期卡面，作为跨 App 共同 fixture；Player 同时使用一份主武器 fixture 验证 Daggerheart Core 的真实原生入口，敌人资源在 Player 中进入“其他资源”。
7. 为第一条纵切建立 PRD 覆盖表，并完成其 OpenPencil 低保真线框、相关状态清单和人工布局评审；设计范围只覆盖该纵切实际经过的界面。
8. 在真实 App 外壳中建立可交互浏览器原型，验证主路径和验收相关异常状态；fixtures 与正式 Contract 对齐，原型验收不替代真实端到端验收。

完成标准：实现 Issue 不需要重新决定顶层产品边界；Agent 能在明确 Contract、依赖方向、PRD—界面映射、已评审原型和验收条件下独立实施。

## 阶段 6：完成敌人与武器两条资源纵切

阶段状态：进行中。实现 Issue #38—#45 已发布并完成 triage；#38—#41 已完成，#43、#45 为 HITL，#42、#44 为 AFK。当前处理 #42。

实施并联合验收两条真实路径。敌人卡验证 Creator、Market 与 GM，武器卡验证 Creator、Market 与 Player：

```text
官方敌人数据与媒体
→ Resource Package Contract
→ 敌人 Template 与 Renderer Revision
→ Creator Workspace 创建、编辑和规范卡面预览
→ 导出并重新导入完整 .pbres
→ Creator 发布到 Market
→ Market 下载并交接到 Creator App 内的 GM Tabletop
→ GM 显式放置、修改实例状态并保存 .pbtab
→ Creator Workspace / GM Tabletop Document 分别云同步与恢复

官方主武器数据
→ Resource Package Contract
→ 武器 Template 与 Renderer Revision
→ Creator Workspace 创建、编辑和规范卡面预览
→ Creator 发布到 Market
→ Market 下载并交接到 Player
→ Daggerheart Core 将主武器路由到原生“武器”入口
→ 玩家选择主武器，System Package Dependency 把最终字段值写入 Character Data
→ Character Save 云同步与恢复，不保存资源引用或选择状态
```

两条纵切必须使用真实 Contract、对应的正式 Template、共享 Renderer 和正式文件边界。不得使用私有临时 Contract、Player 硬编码武器字段映射、截图伪卡面、公开私有媒体捷径、自动放置或静默更新来宣称闭环。敌人包可安装到 Player，但只能进入“其他资源”；主武器包不得因此自动改写 Character Data。

本阶段同时完成设计—实现循环的首次校准：先完成整条纵切的设计与原型评审，再实施真实端到端路径；首次校准通过前，不以“设计领先”为理由启动第二条纵切。校准结果至少确定 Platform UI 外壳、共同交互规则、PRD 覆盖表格式和人工评审门禁。

完成标准：敌人资源完成 Creator → Market → GM 的创建、发布、取得、显式放置、实例操作和恢复；主武器资源完成 Creator → Market → Player 的创建、发布、取得、原生路由、显式选择、最终字段写入和 Character Save 恢复。文件、云端和 Market 路径保持相同身份与内容边界。若纵切失败，先修正对应 Contract、ADR 或 L2，不扩大模板和应用范围。

## 阶段 7：扩大共同平台与官方内容

第一条纵切通过后，按“实现当前纵切、设计下一纵切”的双轨循环补全 Contracts & Template Platform 及其关联交付：

1. 完成十个官方专用 Resource Template 与自由 Template，不把各模板误拆为长期产品 L2。
2. 一次性迁移全部官方核心资源，记录来源、字段映射、数量、媒体与规则文本不变证据。
3. 补齐 Template 版本、Upgrader、Renderer Revision、支持清单和跨宿主视觉/行为基线。
4. 完成 Resource Conversion Platform、`.dhcb` 双向 Adapter，再按真实需求增加其他第三方 Adapter。
5. 按 System Authoring、Player、GM 和 Backend 的真实需求发布 System Package、Character Save、Tabletop Document 与 Backend API Contract；不为假想字段预先设计。
6. 使用完整官方语料和压力 fixtures 冻结 Resource Package Contract Profile 的互操作上限。

完成标准：平台从“能承载一个真实敌人”扩展为能承载全部首版官方资源、可信模板和明确第三方转换边界，且所有声明支持的 App 通过共同 conformance。

## 阶段 8：补全六个 L1 产品

纵切证明共享地基后，各 L1 可以按依赖并行扩面，但每条工作流内部仍遵守设计最多领先一条的门禁，每个能力仍须通过独立 L2 和实现 Issue 验收。

### 8.1 System Authoring Workflow 完成

- 完整 System Package 目录/ZIP 文件优先工作流、资源兼容声明、Character Data Schema、校验与玩家运行时预览。
- 完成首版官方系统包及需要的第三方角色格式 Adapter。
- 证明旧来源只作迁移证据，新 Contract 与 fixtures 成为权威。

### 8.2 Creator App 完成

- 完成 Creator Workspace 生命周期、目录整理、多资源包创作、复制、回收和本地优先持久化。
- 支持全部可信 Template 的结构化编辑、规范卡面预览、媒体处理和资源替换。
- 完成 `.pbres`、第三方格式、版本推荐、导入冲突、打印、云同步和 Market 发布入口。
- 保持 GM Tabletop 是同一 App 内的独立 L1 能力，不引入 GM Resource Workspace。

### 8.3 Player App 完成

- 按显式验收迁移现有 Sheet 的成熟角色行为，不按复制代码数量宣称完成。
- 完成当前 System Package、Character Save、Resource Manager、兼容路由、“其他资源”和玩家 Tabletop Document。
- 完成文件交换、打印、离线、本地优先云同步和移动端体验。

### 8.4 GM Tabletop 完成

- 完成 `桌面文档生命周期`、`资源浏览与显式放置`、`资源卡片桌面操作`、`GM Tabletop 云连续性` 四个 L2。
- 支持跨 Creator Workspaces 浏览但保留包边界；所有桌面变化均由显式命令产生。
- 完成单桌面 `.pbtab`、打印、布局、实例定义/运行状态、恢复和跨设备连续性。

### 8.5 Market 完成

- 完成 `公共资源发现`、`出版生命周期`、`资源取得与 App 交接`、`最小市场治理` 四个 L2。
- 完成包级/资源级搜索、稳定链接、作者页、人工精选、取消发布/重新发布、举报/下架、账号注销和响应式体验。
- 保持第一版免费、单作者、无社区功能、无历史版本下载、无 Market 直接上传或编辑资源。

### 8.6 Contracts & Template Platform 完成

- 完成五个长期 L2：平台合约生命周期治理、Resource Package 互操作、可信资源模板生命周期、规范资源呈现、资源格式转换。
- 五个 Contract Family、Template Registry、Renderer、Adapter Registry 和支持清单均具有真实消费者与自动化 conformance。

完成标准：每个 L1 的所有 L2 均满足其父 PRD 的产品级验收；不存在用另一个 L1、共享 package 或 Backend 实现替代本产品责任的情况。

## 阶段 9：生态级强化与正式发布门禁

六个 L1 功能齐全后，统一通过以下生产级门禁：

1. Creator → Player → GM → Market 的完整跨 App E2E；文件、云端和 Market 三条路径得到相同规范资源。
2. 离线启动、断网编辑、重试、恢复、多设备冲突、会话接管和 30 天删除恢复行为。
3. 无静默 Contract/Template/资源升级、无静默放置、无静默覆盖桌面实例或工作区。
4. 路径穿越、ZIP 炸弹、Unicode/大小写碰撞、恶意媒体、权限绕过和原子失败等安全测试。
5. 常规与压力语料下的性能、按需渲染、搜索分页、云同步和媒体生命周期测试。
6. 桌面、平板和手机的响应式、键盘操作、可访问性、打印和视觉基线验收。
7. Publication 取消发布或平台下架后，已下载文件和既有有效 Cloud Document 仍按已接受规则恢复媒体。
8. 账号注销、个人资料移除、Publication custody、文档永久删除和媒体引用释放。
9. 旧 Sheet/Cards 数据迁移、关键用户行为回归、备份恢复、部署、日志、监控和故障演练。
10. C4、`CONTEXT.md`、ADR、GitHub PRD、Contract 和实现仍表达同一组产品及依赖边界。

完成标准：发布候选在真实官方数据和跨应用场景下达到功能、安全、性能、恢复和运维要求，可以正式替代旧产品边界内的对应能力。

## 阶段 10：关闭 Issue 层级

关闭顺序不可倒置：

1. 实现 Issue 的代码、测试和验收全部完成后关闭实现 Issue。
2. 一个 L2 的所有实现子项与关联验收完成后关闭该 L2 PRD。
3. 一个 L1 的全部 L2 完成后关闭该 L1 父 Issue；不得因为 PRD 已写完或纵切已通过提前关闭。
4. 六个 L1 全部关闭且生态级发布门禁通过后，最后关闭 L0 `PbDH Platform` #1。

完成标准：GitHub Issue 树准确反映实际完成状态，不把“设计完成”“纵切通过”或“代码已复制”误报为整个 PbDH 生态完成。

## 文档维护规则

- `CONTEXT.md`：领域术语与跨域关系。
- `docs/adr/`：已经接受且需要长期保留理由的架构决策。
- GitHub Issues：L0/L1/L2 PRD 与正式工作项。
- `docs/c4.md`：当前系统上下文和运行结构。
- 本文：设计与拆解顺序。

路线或边界改变时，更新本文；具体功能状态以对应 GitHub Issue 为准。
