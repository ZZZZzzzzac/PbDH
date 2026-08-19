# Contract Runtime

Player、Creator 与 Market 共用的 Contract Catalog Reader、JSON Schema Validator 和稳定 Contract Diagnostic 映射。

- Schema、Catalog 与 fixtures 的权威源位于 `contracts/`。
- 本 package 不拥有业务提示、确认、持久化或迁移提交。
- Platform Backend 使用 Python 实现并通过同一 conformance fixtures 保持一致，不依赖本 TypeScript package。
