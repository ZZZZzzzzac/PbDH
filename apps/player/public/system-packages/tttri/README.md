# TTTRI System Package

## 内容更新来源

后续规则与资源更新请查阅[飞书知识库](https://lcnz1nhz1wq6.feishu.cn/wiki/ZOFBw9A4NirdRHkri0Wc1PlVnEF)。

## 护甲迁移补漏（2026-09-08）

内置 `resources/tttri.pbres` 2.1.2 恢复 34 件 TTTRI 护甲，总计 607 条资源。来源为只读 `PbDH_Sheet` 仓库 commit `16396c6c36a814c4cf067d159b6bbef1310a1d7a` 的 `public/system-packages/tttri/resources/armor.json`。

保留原 ID、名称、位阶、阈值、护甲值及规则全文；`描述` 按首个中文冒号拆成护甲模板 1.0.1 的 `特性名称` 与 `特性描述`，空描述保留空特性。路径为 `护甲/位阶N/名称.json`，来源标签沿用“罗德岛旅记官方资源”，没有新增图片。原有 573 条资源及媒体不变。通过正式 PBRES 封包、摘要计算与回读校验，内置索引同步新摘要，使现有安装自动更新。
