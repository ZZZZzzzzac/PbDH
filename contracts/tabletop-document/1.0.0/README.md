# Tabletop Document Contract 1.0.0

开发期稳定目标版本。每个桌面实例保存自己的资源副本、当前运行状态和布局；资源副本中的 `replacements` 只保存换卡按钮与包内目标资源 ID，不保存目标卡内容、隐藏形态或切换历史。

执行换卡时，Creator App 必须从当前来源资源所属的 Creator Workspace 重新读取目标资源。成功时创建新实例并只沿用位置、缩放、旋转与层级；失败时不得修改桌面文档。
