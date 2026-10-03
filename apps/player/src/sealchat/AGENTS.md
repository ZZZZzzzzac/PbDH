# SealChat 实验接入

- 仅通过宿主提供的 Channel Embed SDK 通信，不复制 SDK、不读取 token、不调用内部 HTTP API。
- 匕首之心专用字段映射在此适配器内，不进入 System Package Contract 或通用角色存档模型。
- 开窗期间的四项 Dice 资源为会话展示覆盖，不写入 Character Save、IndexedDB 或云文档；普通模式保持原有行为。
- 资源操作只发送相对 .st，不调用 characterCard.updateAttrs；切换存档、身份、频道或断线后须重新确认关联。
- 掷骰助手监听已有六特质显示的点击，不修改系统包皮肤或布局；弹窗读取 Dice 特质和经历，用 .dd/.ddr 发送，经历费用由 sealpack 校验和结算。
- 测试替身只供隔离预览，不打包到应用，不连接生产或真实 IM。
