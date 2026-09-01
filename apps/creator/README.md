# Creator App

Creator App 组合根，同时承载 GM Tabletop 标签页。Creator Workspace 与 Tabletop Document 不在此合并。

`src/workspace-prototype/` 是 #30 的 Creator App 外壳原型。Creator、GM 与每个资源模板的视觉直接由对应 React/HTML/CSS 源码定义，资源数据、导入导出和卡面分别调用正式 Contract、
Template 与 Renderer。首次启动显示空白工作区列表，新建资源包不预填游戏内容、简介或许可。
工作区使用浏览器本地持久化，并可由用户选择同步到云端。
