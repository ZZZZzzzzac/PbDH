# System Package Contract 1.0.0

目录根入口固定为 `system.json`。包身份、Player Runtime 文件引用、Resource
Compatibility 与 Embedded Resources 只在该文件声明；不存在第二个根定义。

`runtime` 引用 Pages、Modules、Dependencies、Layouts、Skins、创建流程、校验脚本、
角色格式 Adapter 与文本导出等包内作者文件。系统自带游戏资源只通过
`embeddedResources[].path` 引用完整 `.pbres`；包身份、版本与 Digest 以该
Resource Package 的权威文档为准，不在 `system.json` 重复。

`resourceCompatibility` 与 `embeddedResources` 都可以省略。Reader 将缺失值归一化
为空数组，因此没有原生资源入口或没有内嵌资源的纯人物卡 System Package 仍然有效。

网站随应用提供的 Preset System Package 由管理员登记并作为可信包运行。用户自行导入
或用于 Author Preview 的第三方包不继承该信任；Player 在运行脚本前要求确认，并使用
受限 Worker 隔离脚本。该隔离用于降低脚本影响范围，不承诺抵御所有浏览器或运行时漏洞。

导入不仅检查 `system.json` 的结构，还检查其中声明的运行文件确实存在、`defaultSkin`
指向已声明 Skin、Skin Page override 指向实际 Page，以及 Resource Compatibility 的
最低版本严格小于最高版本。任一检查失败都返回诊断并拒绝候选包，不进入运行阶段。

Catalog 中的 `1.0.0` 已经人工审阅、冻结并进入 `published`；后续修正必须发布新的 SemVer，不能原地修改本版本。
