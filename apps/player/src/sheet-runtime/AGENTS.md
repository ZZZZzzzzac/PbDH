# Sheet Runtime Migration

本目录拥有从 `PbDH_sheet` 迁移的 Player Runtime：System Package 加载与校验、人物卡渲染、Sheet Modules、依赖计算、角色存档工作流、检查和导入导出行为。

## 来源

- 来源仓库：`D:\Fish\TRPG\PbDH_sheet`
- 固定 commit：`0e44fa69b12209c172e4189e273615ba3a4d07a6`
- 路径映射与迁移边界见 `docs/pbdh-sheet-player-migration.md`。
- 复制源文件时保持相对路径；发生重组时在迁移文档中记录新旧路径。

## 迁移边界

- 以旧 Sheet 的用户可观察行为和测试为基线；平台 ADR 与 Contract 冲突时以本仓库为准。
- System Package 只由平台 JSON Schema Contract 定义；迁移的 Zod 类型和 Validator 是实现，不是第二权威。
- 游戏资源只通过当前 Resource Package Contract、Template Registry 与 `.pbres` 进入 Runtime。系统包自带资源也先生成原生 `.pbres`，再走同一安装与路由流程。
- Character Save 只通过 `apps/player/src/character-saves/` 的 Repository 保存。迁移工作流可以依赖其接口，不复制旧 Dexie schema 或存储键。
- 平台外壳、账号、云同步、媒体准入和共享 Tabletop 分别由现有共享 package 拥有；本目录通过注入的接口使用，不复制其实现。

## 兼容策略

- 当前开发版本不读取旧 `PbDH_sheet` Resource Extension、Character Data、Character Save 或 IndexedDB 数据。
- 不建立旧格式与新格式双写、加载时猜测或静默迁移。
- 角色格式导入只接受当前 System Package 明确声明、并输出当前 Character Save Contract 候选的 Adapter。

## 验证

- 每项迁移行为先复制或翻译对应旧 Sheet 测试，再修改实现。
- Player Runtime 的功能只能通过正式 `PlayerSheetSurface`、Repository 与 Contract seam 验收；不得重新建立临时 React 人物存档状态。
- 实质性修改后运行相关 Player 测试；阶段完成时运行根目录 `npm run verify`。
