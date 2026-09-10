# 文档索引

## 当前入口

- [图文速查](user-guide.md)：玩家、卡牌工坊与带团操作。
- [系统包创作](system-package-authoring.md)、[PBRES 批量编辑](pbres-bulk-edit.md)：可重复使用的文件工具。
- [dhsheet 人物互通](dhsheet-character-interop.md)：兼容边界、来源与联调入口。
- [开发交接](handoff.md)：尚需关注的事项，不作为实时发布状态。
- [部署与恢复](../deploy/README.md)：发布、备份和恢复。

## 架构与依据

- [领域上下文](../CONTEXT.md)、[C4 架构](c4.md)、[ADR](adr/)：领域语言和架构决策；ADR 的历史决定按后续替代关系解释。
- [转换来源](conversion-source-engines.md)、[渲染性能](renderer-performance.md)：上游依据和测量方法。
- [Player 迁移](pbdh-sheet-player-migration.md)、[人物存档](pbdh-sheet-character-save-migration.md)、[资源选择](pbdh-sheet-player-resource-selection-migration.md)：旧 Sheet 来源与行为证据。
- [Creator 工作区迁移](pbdh-cards-creator-workspace-migration.md)、[身份迁移](pbdh-cards-identity-migration.md)：旧 Cards 来源与映射。
- `agents/` 是项目协作规则；正式 PRD 和工作项以 GitHub Issues 为准，旧路线图和阶段审计不再充当当前任务清单。
- `sources/`、`third/` 保存原始资料和资源，未纳入本次过期文档清理。
- `template-1.0.0-review-resource-package.json` 仍由模板一致性测试使用，不是可清理的临时样本。
