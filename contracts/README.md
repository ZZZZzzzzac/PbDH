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

System Package conformance 目录使用 `conformance/system-package/<exact-semver>/`：
`valid/<name>/system.json` 与其 `resources/*.pbres` 表示可读目录输入，同级 `.pbsys`
表示相同内容的 ZIP 输入；二者必须产生同一标准化候选。
