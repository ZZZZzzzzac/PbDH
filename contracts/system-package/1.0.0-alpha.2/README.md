# System Package Contract 1.0.0-alpha.2

目录根入口固定为 `system.json`。包身份、Player Runtime 文件引用、Resource
Compatibility 与 Embedded Resources 只在该文件声明；不再存在第二个
`manifest.json` 根定义。

`runtime` 引用 Pages、Modules、Dependencies、Layouts、Skins、创建流程、校验脚本、
角色格式 Adapter 与文本导出等包内作者文件。系统自带游戏资源只通过
`embeddedResources[].path` 引用完整 `.pbres`；Player 按 `resourceCompatibility`
把已验证资源投影到 Runtime Resource Libraries，不在 `system.json` 重复资源库文件清单。

`.pbsys` 与目录表达同一 System Package。当前版本仍为 prerelease，用两个真实系统包
验证单一根定义后再进入稳定发布门禁。

