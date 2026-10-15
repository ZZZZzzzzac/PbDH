# 固定资源回归样本

以下样本从提交 5ef347efd43cea627a36e536d2c138f0f3ecb623 的素材目录迁入，以免日常素材整理影响回归测试。

- daggerheart-core-gm.pbres：原 docs/third/daggerheart-core-gm.pbres，验证核心 GM 包的本地化及模板数据。
- dragon-campaign.dhcb：原 docs/third/与龙同行战役框架卡牌包.dhcb，验证 159 张卡图导入、去重和 PBRES 回读。

`daggerheart-hope-and-fear.pbres` 从提交 `6939810402d748c5eb4a73b377021118de864a16` 的 `docs/third/` 迁入，覆盖 340 条扩展资源的导入、装备审核与核心书范围隔离。核心书构建输入保存在 `docs/sources/daggerheart-srd2/daggerheart-core-book.pbres`，测试直接复用该输入。

`npm run build:daggerheart-core` 同时更新本目录的 `daggerheart-core-gm.pbres`，作为独立 GM 资源包及回归样本；生成器从该包复用已有媒体。
