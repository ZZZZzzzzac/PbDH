# Creator App

Creator App 组合根，同时承载 GM Tabletop 标签页。Creator Workspace 与 Tabletop Document 不在此合并。

`src/renderer-lab/` 是 #28 的跨宿主校准台：只组合共享 Template 与 Renderer，禁止在
宿主壳中复制卡面字段映射。视觉确认完成后它保留为 Renderer Revision 回归入口。

`src/workspace-prototype/` 是 #30 的 Creator App 外壳原型：布局令牌由
`docs/design/creator-app.op` 生成，资源数据、导入导出和卡面分别调用正式 Contract、
Template 与 Renderer。默认打开牛头人工作区；使用 `?state=empty` 检查首次启动空列表。
原型只在页面内存保存，不代表本地持久化、云同步或完整端到端已完成。
