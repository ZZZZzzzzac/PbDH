# PbDH 开发交接

更新时间：2026-08-24

## 当前落点

- 分支：`main`
- 功能基线提交：`cead992a328bbd36ff2cfb49333781bd42fa245d`（`feat: complete Creator workspace and Market prototype`）
- 路线状态：阶段 5 已完成，阶段 6 进行中，详见 `docs/roadmap.md`。
- Market 设计原型实现项 [#33](https://github.com/ZZZZzzzzac/PbDH/issues/33) 已完成人工验收并关闭。
- 阶段 6 实现项 [#38—#45](https://github.com/ZZZZzzzzac/PbDH/issues/38) 已发布并完成 triage；当前处理 HITL #38。

## 本轮完成

- Creator Workspace 成熟行为、本地持久化、资源包生命周期与发布候选逻辑已提交。
- Market 双交接 OpenPencil 设计、真实 App 外壳原型、筛选与资源包呈现已提交。
- 主武器媒体与三种卡面形态、相关 fixtures、Player 共用顶栏设计同步已提交。
- `PbDH_Cards` 迁移来源与边界见 `docs/pbdh-cards-creator-workspace-migration.md`。
- UI 真相源：`docs/design/creator-app.op`、`docs/design/player-app.op`、`docs/design/market.op`。

## 已验证

- `npm run verify` 通过：21 个 TypeScript 测试文件、149 个测试；43 个 Python 测试；类型检查及 Creator、Player、Market 构建通过。
- `git diff --cached --check` 通过。
- 已知非阻塞警告：Creator 构建 chunk 超过 500 kB；Git 提示部分 LF 将转 CRLF。

## 下一步

1. 确认 #38 的 SQLite identity schema 与 Supabase 配置边界；这是数据库 schema 与认证配置红线。
2. 实施并人工验收 #38 统一账号会话与接管。
3. 按 #39—#45 的依赖顺序贯通两条真实端到端路径。
4. #41 只把 Market 的完整 `.pbres` 接入 Player Resource Manager 标准入口，不迁移或重写 `PbDH_sheet` 框架与武器模块。
5. 发现设计假设错误时先同步对应 `.op`、ADR 或 Issue 权威，再改实现。

## 关键约束

- 开始工作先读仓库 `AGENTS.md` 与 `docs/agents/` 相关规则。
- OpenPencil 是已覆盖 UI 的唯一设计源；localhost 是实现结果。
- Creator 自动保存到 IndexedDB；标签圆点表示相对导入/导出快照有修改，不表示未本地保存。
- 关闭资源包会确认后删除其本地 Creator Workspace 数据。
- 不直接修改或运行时引用旧仓库；迁移只复制并记录来源。
- Push、schema 变更、公开发布等命中红线，必须先问用户。

## 建议 skills

- `$openpencil-design`：修改 `.op` 或同步 UI 实现。
- `$qa`：人工回归 Creator/Market 并形成 Issue。
- `$code-review`：进入阶段 6 前审查大范围纵切改动。
- `$diagnose`：排查持久化、拖拽或跨 App 交接故障。
