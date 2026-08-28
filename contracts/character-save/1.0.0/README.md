# Character Save 1.0.0

Character Save 是 Player 本地优先的长期逻辑文档。平台信封保存稳定存档身份、System Package 引用、独立 Character Data 版本和按 Module ID 表达的完整持久状态。

Character Data 的具体键、值形状、默认值和语义由目标 System Package 的 Modules 自动推导。`cardTable` 与 `freeText`、`countableResource`、`imageField` 一样以自己的 Module ID 拥有状态；平台不建立统一 `tabletop` 字段或第二套人物模型。

逻辑文档不保存媒体清单。Player Repository 从经过目标 System Package 校验的 `imageField` 与 `cardTable` 状态派生本地及云端 Asset ID 投影。`.pbcha` 文件 Profile 只自包含玩家上传到 `imageField` 的 WebP；System Package 图片和卡图字节不重复进入人物文件。

当前仓库仍处于首次公开发布前，`1.0.0` 以 `development` 状态收敛；首次正式上线后冻结。
