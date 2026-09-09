# AGENTS.md

## 项目概述

PbDH 是桌游工具项目。默认使用 Python 与 Web 前端；未明确需求前，不引入具体框架。

## 技术基线

- Monorepo 使用 npm workspaces；不引入 Nx、Turborepo 或其他任务编排层。
- Player、Creator 与 Market 前端使用 React 19、TypeScript 6、Vite 8；前端单元测试使用 Vitest 4。
- 浏览器本地持久化优先使用 Dexie/IndexedDB；共享模块只依赖 Repository 接口，不直接依赖具体数据库。
- Platform Backend 使用 Python 与 FastAPI；具体数据库在首个需要持久化的 Backend 实现 Issue 中决定，未经确认不得创建或修改 schema。
- 文件与持久化 Contract 以 JSON Schema 2020-12 为权威；TypeScript 与 Python 实现必须消费同一组版本化 conformance fixtures。
- TypeScript Contract 校验使用 AJV；压缩归档使用 fflate。实现库不成为 Contract 权威。

## 验证入口

- 安装 Node 依赖：`npm install`。
- Python 开发依赖安装到项目 `.venv`，使用 `python -m pip install -r requirements-dev.txt`；不得安装全局依赖。
- 单一非交互式验证命令：`npm run verify`。
- 新增 App、共享 package、Contract 实现或 Python 消费端时，必须接入该命令；不得建立只在子目录运行的隐藏验证入口。
- 重启本地 Platform Backend 与 Platform Shell 时运行 `node scripts/restart-dev.mjs`；只有 Backend 和 Shell 内三个 App Surface 的模块级健康检查全部通过后才能报告启动完成。

## 本机执行环境

- 当前主工作环境是 Windows、PowerShell，仓库位于 `D:\Game\Daggerheart\PbDH`。命令示例应使用 PowerShell 语法，不得把 Bash 路径或转义规则直接套用到本机。
- 受管沙箱中的 Node/npm 有时无法读取 `C:\Users\zinge`，表现为 `EPERM ... lstat 'C:\Users\zinge'`；这属于沙箱边界，不是项目测试失败。遇到该错误时，应使用相同命令申请跳出沙箱运行，不得据此修改项目代码或依赖。
- GitHub Issue 操作使用 `gh` CLI，并需要网络访问；本机执行 `gh` 时直接申请跳出沙箱。查询、评论、关闭等操作仍须遵守 `docs/agents/issue-tracker.md`，不得因跳出沙箱扩大操作范围。
- 本地开发服务使用 `node scripts/restart-dev.mjs`，通常也应跳出沙箱运行。脚本报告 Backend `8001` 与 Platform `5173` 均为 `OK` 后，才可使用或报告本地页面可用。
- 浏览器验收使用已安装的 Browser 插件与 `node_repl`，不要改用另一套临时自动化。若出现 `failed to write kernel assets`，先确认 Browser 插件、Codex 的 `cua_node` runtime 和系统临时目录存在；本机已确认该错误可能来自失效的常驻 `node_repl` 进程，重启 Codex 后可恢复。不得为规避该问题关闭 `node_repl` 沙箱。
- 浏览器控制恢复后，至少用真实本地页面完成一次导航、DOM 读取或截图，不能仅凭运行环境初始化成功宣称浏览器可用。

## 工作规则

- 默认使用中文沟通；代码、命令、变量名使用英文，注释使用中文。
- 修改前先阅读本文件，以及 `docs/agents/` 下与任务相关的规则。
- 先明确可验证目标，再实施；实质性修改后运行对应验证。
- 只修改任务需要的内容，保持 diff 简洁，清理因修改产生的无用代码。
- 本地开发与验收所需凭据位于仓库根目录 `.env.local`；需要登录时先读取相关配置，不在文档、日志或回复中输出凭据值。
- 不提交密钥、token、密码或本地环境文件。
- 删除文件时移到回收站，不直接执行删除命令。

### 执行与收敛

- 改动前梳理完整调用链、受影响入口和验收条件；同一问题的关联改动按可独立验收的用户能力成批完成，不按文件或几行代码拆成反复交付。
- 验证按风险分层：中间运行受影响的测试与必要的类型检查，完整能力收尾时运行 `npm run verify`；只有跨模块风险或排查回归需要时才提前跑全量。纯文档修改只检查内容与 diff，不跑全仓构建和测试。
- 进度以 Issue 验收条件和实际可用能力为准。局部迁移、提交数量、测试数量或重复跑绿不等于完成；汇报时明确当前 Issue、剩余验收项及是否已部署。
- 若连续两轮仍未推进同一项验收条件，先重审方案、剩余依赖和工作范围，再继续编码；不得靠不断增加小步骤延长任务，或把新发现的独立问题无边界并入当前 Issue。

## 目录约定

- `apps/platform/`：唯一用户前端组合根；拥有全局账号、Platform App Bar 与四个主页面的路由
- `apps/player/`：Player App Surface 与领域状态，由 Platform Shell 组合
- `apps/creator/`：Creator App Surface（卡牌工坊与其内嵌的 GM Tabletop 标签页），由 Platform Shell 组合
- `apps/market/`：公共 Market Surface，由 Platform Shell 组合
- `apps/backend/`：模块化单体 Platform Backend
- `contracts/`：语言无关、独立版本化的 Contract Schemas 与契约样例；不得依赖具体 App、共享 package 或编程语言
- `packages/contract-runtime/`：前端共享的 Contract Catalog Reader、Validator 与稳定诊断映射；只依赖 `contracts/` 制品，不拥有 Schema 或业务操作
- `packages/templates/`：可信 Resource Templates 与 Template Registry；使用无 React 的 `core` 入口和前端专用 `frontend` 入口隔离
- `packages/resource-renderer/`：所有前端共用的 Canonical Card Surface 渲染接口、基础组件与隔离样式；接收已解析 Template，不反向读取 Template Registry
- `packages/resource-conversion/`：无 UI、无持久化的共享资源格式转换核心与可信 Adapter Registry；只能依赖 Contract 与 `templates/core`
- `packages/tabletop/`：共享 Tabletop Core 与 React Surface；使用 `core` 和 `react` 子入口隔离
- `packages/local-storage/`：浏览器本地持久化底座；拥有 PbDH IndexedDB schema 与通用文档/媒体存储实现，业务模块只通过各自 Repository 接口使用
- `packages/cloud-documents/`：浏览器端共享 Cloud Document Client 与持久 outbox/conflict 协调；只解释统一文档信封、revision、媒体准备和会话写门禁，不解释领域 payload
- `packages/platform-auth/`：浏览器端共享身份与活动会话客户端；使用无 React 的 `core` 入口和 React `provider` 入口，提供统一账号状态与 Platform App Bar 账号控件，不拥有业务文档或权限规则
- `packages/platform-ui/`：所有前端共用的 Platform App Bar 与应用级外壳样式；各 App 只注入当前页面和导航动作，不复制顶部栏实现
- `packages/publication-ui/`：Creator 与 Market 共用的 Publication 展示信息窗口；Creator 注入完整资源包发布动作，Market 注入既有 Publication 展示信息更新动作
- `packages/media-admission/`：所有浏览器图片入口共用的安全解码、尺寸/比例/裁剪参数与 WebP 规范化边界；业务 App 只声明用途和裁剪选择，不自行编码图片
- `tests/`：跨 App 集成测试与 Contract/Template 一致性测试；模块内部测试跟随所属模块
- `scripts/`：一次性或开发辅助脚本
- `docs/`：项目文档与 ADR
- `.scratch/`：临时 issue/研究材料；正式工作项使用 GitHub Issues

新增顶层目录或共享 package 前，必须先更新本节或建立对应目录级 `AGENTS.md`。不得把旧仓库作为 submodule、subtree 或嵌套仓库放入本项目。

## 依赖方向

- `contracts/` 位于最底层；共享 package 不得形成循环依赖，也不得依赖 `apps/`。
- `packages/contract-runtime`、`packages/templates/core`、`packages/tabletop/core` 与 `packages/resource-renderer` 的通用接口只依赖 Contract 生成物或各自内部模块；React 实现不得从 `core` 入口泄漏。
- `packages/templates/frontend` 可以依赖 `templates/core` 与 `resource-renderer`；`packages/tabletop/react` 可以依赖 `tabletop/core` 与 `resource-renderer`。
- 运行中的 App 通过 `@pbdh/templates/frontend/lazy` 按精确版本加载渲染器与编辑器；同步 `frontend` 入口只供契约验收和离线工具使用。历史实现保留，加载失败可重试；不得通过静态注册表把全部历史前端实现引入 App。
- `packages/local-storage` 只拥有浏览器存储机制与共享信封，不解释 Creator Workspace、GM Tabletop Document 或 Character Save payload；各领域 Repository 负责 Contract 校验与生命周期。
- `packages/cloud-documents` 可以依赖 `packages/local-storage` 与 `packages/platform-auth` 的凭据类型；不得依赖任何 App、领域 payload、React 或 Template/Renderer。
- `packages/platform-auth/core` 只依赖外部身份 SDK 和 Platform Backend HTTP 边界；React provider 可依赖 core 与 React，不得依赖任何 App 或业务领域 package。
- Platform Shell 在单一 origin 只挂载一个账号 Provider；Player、Creator/GM 与 Market 切换复用该活动会话，不得重新认领或顶替。
- `packages/platform-ui` 可以依赖 `packages/platform-auth/provider`；业务 App 不得复制 Platform App Bar 的结构或样式。
- `packages/publication-ui` 只提供受控 React 表单与样式，不读取 Workspace、Publication API、Template Registry 或持久化；Creator 与 Market 各自在组合根注入数据和提交动作。
- `packages/media-admission` 是浏览器图片处理底座，不依赖任何 App、业务领域 package 或 React；Player、Creator 与 Market 通过同一入口提交图片。
- `apps/platform` 可以依赖 `apps/player`、`apps/creator` 与 `apps/market` 的公开 Surface 入口；三个领域 App 不得依赖 Platform Shell 或彼此依赖。
- App 组合根负责解析 Template 并注入 Renderer、Tabletop 与 Conversion；共享模块不得通过全局 Registry 反向寻找宿主能力。
- `apps/backend` 只能使用 `contracts/` 与无 React 的 `packages/templates/core` 等服务端安全入口，禁止依赖 React、DOM 或浏览器专用代码。
- 建立代码后必须用自动化依赖边界检查守住以上规则；新增例外前先修订本节和对应 ADR。

## 旧仓库迁移

- `PbDH_Cards` 是半成品来源，可复制并重组到本项目；迁移验收前保留原仓库作为历史证据。
- `PbDH_sheet` 是线上产品来源，原仓库保持不动。本项目只选择性复制代码、测试和行为，不直接修改或运行时引用其源码。
- 每次复制必须记录来源仓库、commit 与原路径。旧 Issue、PRD、ADR 和 Git 历史只作证据，不成为本项目权威文档。
- Sheet 行为迁移以可验证的测试和显式验收为准；不得因为代码已复制就宣称完成替代。

## Agent skills

### Issue tracker

本项目使用 GitHub Issues，操作通过 `gh` CLI 完成。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认五类 triage labels：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。详见 `docs/agents/triage-labels.md`。

### Domain docs

本项目采用 single-context 文档布局。详见 `docs/agents/domain.md`。

### PRD hierarchy

- 正式 PRD 使用 GitHub Issues；本地 `CONTEXT.md` 与 `docs/adr/` 分别维护领域语言和已接受架构决策。
- L0 只有 `PbDH Platform`。
- L1 固定为 `System Authoring Workflow`、`Player App`、`Creator App`、`GM Tabletop`、`Market`、`Contracts & Template Platform`。`GM Tabletop` 是 Creator App 内的独立产品能力与文档类型，不是独立 App 或部署物。
- App 目录、共享 composition code、Platform Backend 及其内部模块是部署或实现边界，不自动成为产品 L1。
- L2 按一个 L1 内可独立验收的用户能力拆分；下层 PRD 不得覆盖上层边界，发生冲突时先修订上层权威。
- 旧 Sheet/Cards PRD 只作需求证据，不复制为新项目权威正文。
