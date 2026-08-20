# Use One Local Document Store with Domain Repositories

Status: accepted

Player App 与 Creator App 共用一个名为 `pbdh-platform` 的 IndexedDB 数据库。Creator Workspace、GM Tabletop Document 与 Character Save 以统一本地文档信封存入 `localDocuments`，通过 `documentKind`、稳定 Document ID、Contract 版本和更新时间区分；媒体字节按 Asset ID 存入共享的 `mediaAssets`。已安装 Resource Package 保持独立 store，不成为长期文档 payload。

共享存储层只实现信封、事务、按种类查询和内容寻址媒体，不解释业务 payload。每个领域提供自己的 Repository 接口与实现，限定可访问的 `documentKind`，并在提交前执行对应 Contract 与业务校验。统一物理 store 因此不形成统一可变工作区，也不允许跨领域事务修改多个文档。

现有开发版数据库从 v1 升到 v2 时，在同一 Dexie upgrade 事务内把 `resourceMedia` 复制到 `mediaAssets`，再移除旧 store。旧 PbDH Sheet 数据库不在本次迁移范围内。

## Consequences

- 三类长期文档从第一版共用相同离线、同步状态和媒体缓存框架；新增领域 Repository 不需要继续扩展 IndexedDB schema。
- Creator Workspace、GM Tabletop Document 与 Character Save 仍各自加载、保存、导入导出、同步和删除；共享数据库不改变领域所有权。
- 登录前本地文档、outbox、冲突与云端修订可以在统一信封上演进，但本 ADR 不实现 Cloud Sync。
- 读取或写入 payload 前必须由领域 Repository 校验；通用存储层不能把未验证候选直接提升为业务文档。
