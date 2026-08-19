# System Package Contract 1.0.0-alpha.1

目录根入口固定为 `system.json`。`embeddedResources[].path` 指向 `resources/` 下完整
`.pbres`；Loader 必须委托对应 Resource Package Reader 验证，随后核对 Package ID、
版本与 Snapshot Digest。

`.pbsys` 是目录的 ZIP 表达。ZIP entry 顺序、压缩和时间戳不是 System Package 语义。
当前 prerelease 仅服务最小离线基线；完整 Character Modules、脚本和 Adapter 不在此版本。
