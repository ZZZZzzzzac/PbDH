# PbDH 开发交接

更新时间：2026-08-26

## 当前落点

- 分支：`main`。
- 阶段 6 的 #38—#43 已完成；#44 已完成自动化实现并标记为 `ready-for-human`，等待真实 Player 交互验收。
- 本轮 Player 迁移固定来源为 `PbDH_sheet@0e44fa69b12209c172e4189e273615ba3a4d07a6`。
- 详细迁移范围、路径映射和验收标准见 [`docs/pbdh-sheet-player-migration.md`](pbdh-sheet-player-migration.md)；Character Save 边界见 [`docs/pbdh-sheet-character-save-migration.md`](pbdh-sheet-character-save-migration.md)。不要在本文件复制两份文档的内容。
- 当前工作项：[GitHub Issue #44](https://github.com/ZZZZzzzzac/PbDH/issues/44)。

## 本轮完成

- Player 已挂载完整 `SheetRenderer`、正式 Character Save Repository、云同步、`.pbcha`、统一图片准入、创建向导、问卷和打印。
- Daggerheart Core 已原生化为 8 个 `.pbres`，共 625 个资源和 280 个唯一媒体资产。
- 旧原型 `apps/player/src/PlayerAppPrototype.tsx` 和旧图片处理器 `apps/player/src/sheet-runtime/rendering/playerImageProcessor.ts` 已移入 Windows 回收站；Git 中记录为删除。

## 已验证

- `npm run verify` 最近一次通过：52 个 TypeScript 测试文件、314 个测试；76 个 Python 测试；类型检查、依赖边界、设计检查与 Platform build 均通过。
- `node scripts/restart-dev.mjs` 最近一次健康检查通过：Backend `8001`，Platform `5173`。
- #44 已标记为 `ready-for-human`；自动发布 Issue 评论被外部安全审查拒绝，没有评论落到 GitHub。

## 回家后继续

1. 启动或确认 Platform：`node scripts/restart-dev.mjs`，只使用 `http://localhost:5173`。
2. 按 #44 与迁移文档的阶段验收项，真实操作 Player：Daggerheart Core、人物创建与编辑、资源选择、自动保存、刷新恢复、`.pbcha`、图片、打印及登录后的云同步/恢复。
3. 若验收发现问题，先写可复现测试再修复；不要回退为旧 Sheet schema、旧资源格式或独立 Player 顶栏。
4. 验收通过后关闭 #44，再进入 #45 的 Creator → Market → Player 与 Creator → Market → GM 两条联合纵切验收。

## 建议 skills

- `$diagnosing-bugs`：真实 Player 交互、持久化或云恢复出现难以定位的问题时使用。
- `$code-review`：指定本次迁移前的固定提交后，对 Player 大范围迁移做 Standards / Spec 双轴审查。
- `$handoff`：下次跨设备暂停时更新本文件。
