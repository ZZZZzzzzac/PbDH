# Player Character Saves

## Scope

本目录拥有 Player Character Save 的领域 Repository、Contract 校验和 Cloud Document 组合。React 页面只消费这里的接口，不直接读写 IndexedDB 或 Cloud API。

## Boundaries

- `character-save-repository.ts` 只访问 `LocalDocumentKind = character-save`，每次提交前同时执行 Character Save Schema 与语义校验。
- `cloud-document-service.ts` 只协调 Character Save 的显式首次同步、恢复、冲突、回收站和 outbox；不得解释或修改人物字段。
- Installed Resource Packages、当前系统包、资源选择状态、Package 依赖和 UI 偏好不得进入 Character Save payload。
- 玩家桌面实例必须保存完整 `resourceCopy`、运行状态和布局；恢复不得读取来源 Resource Package。
- 自动保存的 debounce、当前选中存档和对话框属于 React 组合状态，不进入 Repository 或 Character Save Contract。

## Migration Evidence

从 `PbDH_sheet` 只迁移存档列表、当前存档、250ms 自动保存与切换前刷新行为。来源 commit 和原路径记录在 `docs/pbdh-sheet-character-save-migration.md`。
