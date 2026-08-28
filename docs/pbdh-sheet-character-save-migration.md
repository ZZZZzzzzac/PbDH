# PbDH Sheet Character Save Migration

Source repository: `PbDH_sheet`

Source commit: `0e44fa69b12209c172e4189e273615ba3a4d07a6`

完整 Player Runtime 的迁移范围与路径映射见 `docs/pbdh-sheet-player-migration.md`。本文只记录 Character Save seam。

Selected sources:

- `src/storage/storageService.ts`: 按系统包隔离的存档列表、读取、保存、重命名和删除行为。
- `src/store/workflows/autosave.ts`: 250ms 自动保存，以及切换存档前刷新待保存内容。
- `src/domain/characterData.ts`: 人物最终字段与卡牌状态共同构成一个存档快照的用户体验。

Migration boundary:

- 迁移旧 Sheet 的完整角色存档工作流，但不复制旧 Dexie schema 或旧内部存档格式。
- 新 Character Save 使用平台 Contract 和统一 `localDocuments` store。
- 不读取或迁移旧 `resourceSelections`、资源库引用、资源包依赖和旧 Character Save；资源应用后只保存最终人物字段。
- Player 的每个 `cardTable` Module 使用平台 `TabletopInstanceResourceCopy`，其完整状态随同一 Character Save revision 原子保存，不建立独立玩家桌面文档或平台级统一桌面字段。
- 云恢复时把自包含 Resource Copy、运行状态、布局和可取得媒体投影回 Sheet Runtime；复制人物或再次保存不依赖来源 `.pbres`。卡图缺失不能导致实例结构丢失。
- 本地 Repository、显式上云、outbox、冲突三动作、删除与 30 天回收站继续复用平台 Cloud Document Service。
- 原生文件交换使用 Character Save Contract 的 `.pbcha`，只携带 `imageField` 中玩家上传的 WebP，不打包 System Package 图片或桌面卡图，也不读写旧 Sheet 内部 Character Data JSON。
