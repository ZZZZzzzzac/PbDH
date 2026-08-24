# Platform Backend

Python/FastAPI 模块化单体。

## 目录

- `src/pbdh_backend/`：应用组合根与领域模块。
- `migrations/`：按文件名顺序执行的 SQLite SQL migrations；只允许追加，已执行文件不得改写。

## 持久化

Issue #38 已确认首个 Backend 持久化使用 SQLite、外键、WAL 和事务。运行期数据库路径来自配置，不进入 Git；测试必须使用临时数据库。任何后续 schema 变更仍须先获得用户确认。
