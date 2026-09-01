# Platform Backend

Python/FastAPI 模块化单体。

## 目录

- `src/pbdh_backend/`：应用组合根与领域模块。
- `migrations/`：按文件名顺序执行的 SQLite SQL migrations；只允许追加，已执行文件不得改写。

## 持久化

Issue #38 已确认首个 Backend 持久化使用 SQLite、外键、WAL 和事务。运行期数据库路径来自配置，不进入 Git；测试必须使用临时数据库。任何后续 schema 变更仍须先获得用户确认。

Issue #39 追加 Market Publication、Package ID 所有权、公开资源索引和内容寻址媒体表。Supabase 仍只负责外部身份认证；结构化出版物与媒体字节保存在 Platform Backend 自有数据库。

`PBDH_PUBLICATION_MODE` 缺省为 fail-closed 的 `production`：只接受已进入 Release Catalog 的正式 Contract 与受支持 Template，并拒绝同版本覆盖。需要验证开发期发布生命周期时，必须在本机 `.env.local` 显式设为 `development`。

## 本地启动

根目录的 `npm run dev:backend` 会自动加载 Git 忽略的 `.env.local`，并在 `127.0.0.1:8001` 提供本地 API。Player、Creator 与 Market 的 Vite 开发代理统一指向该端口。本地 Supabase 身份配置、管理员 Auth Subject、数据库路径和发布模式统一放在 `.env.local`；不得把实际值写入受 Git 追踪的文件。
