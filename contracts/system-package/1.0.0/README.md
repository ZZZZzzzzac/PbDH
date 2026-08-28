# System Package Contract 1.0.0

目录根入口固定为 `system.json`。包身份、Player Runtime 文件引用、Resource
Compatibility 与 Embedded Resources 只在该文件声明；不存在第二个根定义。

`runtime` 引用 Pages、Modules、Dependencies、Layouts、Skins、创建流程、校验脚本、
角色格式 Adapter 与文本导出等包内作者文件。系统自带游戏资源只通过
`embeddedResources[].path` 引用完整 `.pbres`；包身份、版本与 Digest 以该
Resource Package 的权威文档为准，不在 `system.json` 重复。

`resourceCompatibility` 与 `embeddedResources` 都可以省略。Reader 将缺失值归一化
为空数组，因此没有原生资源入口或没有内嵌资源的纯人物卡 System Package 仍然有效。

Catalog 中的 `1.0.0` 生命周期保持 `development`，直到 PbDH monorepo 通过发布门禁。
