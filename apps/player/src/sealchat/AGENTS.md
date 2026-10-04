# SealChat 实验接入

- 仅通过宿主提供的 Channel Embed SDK 通信，不复制 SDK、不读取 token、不调用内部 HTTP API。
- 匕首之心专用字段映射在此适配器内，不进入 System Package Contract 或通用角色存档模型。
- Dice 数值为会话展示覆盖，不写入 Character Save、IndexedDB 或云文档；普通模式保持原有行为。
- 余额与上限步进发送相对 .st；用户显式编辑白名单数值时只发送单字段 .st field=value，不调用 characterCard.updateAttrs。切换存档、身份、频道或断线后须重新确认关联；草稿携带关联令牌。
- 六特质与主副武器使用独立骰子按钮，属性原点击保留编辑。不得更改系统包皮肤或布局；只有新按钮和弹窗使用局部样式。
- 检定读取 Dice 特质和经历，用 .dd/.ddr 发送；经历费用由 sealpack 校验和结算。
- 伤害使用 PbDH 武器摘要与熟练度，按同类骰数量、固定修正、额外骰的显式接口组合 .r；发送前核对源快照，不推断特性自然语言。
- 测试替身只供隔离预览，不打包到应用，不连接生产或真实 IM。
