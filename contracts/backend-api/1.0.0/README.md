# Backend API Contract 1.0.0

`openapi.json` 是 PbDH Platform Backend HTTP 边界的权威 OpenAPI 3.1 制品，覆盖身份与活动会话、云文档、托管媒体和资源市场。

- `payload` 内部的 Character Save、Creator Workspace 与 Tabletop Document 结构仍由各自 Contract 管理。
- 匿名 Market 读取明确标记为无认证；可选登录读取同时声明匿名与活动会话两种方式。
- 云写入、发布和管理要求 Bearer JWT 与 `X-PbDH-Session` 同时存在。
- 所有失败使用 `ApiErrorResponse`；业务代码依赖稳定 `error.code`，不依赖中文文案。
- 普通云媒体为宽 `630px`、不超过 `2 MiB` 的 WebP；市场封面为 `630×880` WebP。

运行 `node scripts/python.mjs scripts/generate_backend_openapi.py --check` 可证明实现路由与已发布制品仍然一致。发布后不得原地修改本文件或 OpenAPI；破坏性变化必须发布新的 Backend API SemVer。
