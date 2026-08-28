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
`1.0.0-alpha.2` 开始由 `system.json.runtime` 统一声明 Player Runtime 文件；`1.0.0`
允许省略空的资源集合，并只用 `embeddedResources[].path` 引用权威 `.pbres`。
