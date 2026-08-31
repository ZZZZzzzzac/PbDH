# Tabletop Document Contract 1.0.0

开发期稳定目标版本。每个桌面实例保存自己的资源副本、当前运行状态和布局。资源副本的 `presentation` 只保存卡牌形式与是否固定比例；实例的 `geometry.width` 保存用户在桌面上调整后的实际宽度，高度由 Renderer 根据模板和内容决定。

运行状态的结构、默认值、操作和呈现由精确版本的资源模板声明，Tabletop Document 只保存实例当前的状态值。资源副本中的 `replacements` 只绑定模板声明的替换动作 ID 与包内目标资源 ID，不保存目标卡内容、隐藏形态或切换历史。

执行换卡时，Creator App 必须从当前来源资源所属的 Creator Workspace 重新读取目标资源。成功时创建新实例并只沿用位置、宽度、旋转与层级；失败时不得修改桌面文档。
