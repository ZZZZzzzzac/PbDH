# Contracts

语言无关 Contract Schemas、Profiles 与版本化 conformance fixtures。这里不放 App 私有类型或可执行前端代码。

`conformance/tooling-smoke/` 只验证仓库工具链，不属于五个正式 Contract Family，也不得进入正式制品。

正式 Contract 按 `<family>/<exact-semver>/schema.json` 存放。跨语言 conformance
语料按 `conformance/<family>/<exact-semver>/` 存放，其中：

- `valid/`、`invalid/`：逻辑文档正反例；
- `media/`：仅存 fixture 所需的规范化媒体字节，以 Asset ID 命名；
- `cases.json`：语言无关的预期诊断；
- `digest-cases.json`：跨语言 Snapshot Digest known-answer；
- `source-manifest.json`：迁移数据与媒体来源证据，不属于 Contract 制品。

System Package conformance 目录使用 `conformance/system-package/<exact-semver>/`。
`cases.json` 保存跨语言 Schema 诊断；需要验证归档机制的版本还可用
`valid/<name>/system.json`、`resources/*.pbres` 与同级 `.pbsys` 表示等价目录/ZIP 输入。
`1.0.0` 由 `system.json.runtime` 统一声明 Player Runtime 文件，允许省略空的资源集合，
并只用 `embeddedResources[].path` 引用权威 `.pbres`。

## 正式发布

Contract 必须逐个经过人工审阅和明确批准，不能因实现或测试通过自动转正。批准后的冻结证据放在
`releases/<family>/<exact-semver>.json`，并遵守 `release.schema.json`。

Catalog 中标记为 `published` 或 `deprecated` 的版本必须同时满足：

- 使用不带 prerelease 的正式 SemVer；
- Schema 与冻结记录中的 SHA-256 完全一致；
- 冻结记录列出的 conformance 文件、真实生产者测试和真实消费者测试均存在；
- 至少有 TypeScript 与 Python 两种实际消费实现的共同 conformance 证据；
- `npm run check:contract-releases` 和完整 `npm run verify` 通过。

修改已发布 Schema 时必须发布新的 SemVer，不得原地更新冻结哈希。`development` 版本不需要发布记录，
也不得进入正式数据边界。

Tabletop Document `1.0.0` 只保存当前可见的桌面卡。每张卡的资源副本可保存换卡目标，
但不保存隐藏形态、历史形态或预先复制的目标资源；实际换卡时从当前 Creator Workspace
重新取得目标资源。卡牌实例保存桌面实际宽度，不把具体尺寸放进 `presentation`；运行状态和
替换动作都必须符合精确版本资源模板的声明。正式 Creator 数据入口只接受已发布版本；
仓库不保留 `1.0.0` 之前的开发期 Contract 或兼容读取代码。

Backend API 当前为 `1.1.0`，以 `backend-api/1.1.0/openapi.json` 为权威；新增账号云空间统计接口，
保留 `1.0.0` 制品不变。接口覆盖身份、云文档、
托管媒体与资源市场操作。OpenAPI 由真实 FastAPI 路由确定性生成；发布门禁会比较生成结果、
稳定 operation ID、认证矩阵、统一错误以及二进制上传下载声明，禁止实现静默偏离正式合约。
