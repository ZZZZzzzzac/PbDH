# Resource Conversion

无 UI、无持久化的资源转换核心。只允许依赖 Contract 与 `templates/core`。

所有入口都要求调用方显式选择来源格式。第三方数据先进入短生命周期、保留来源 DTO
的转换信封，再由逐 Template 映射器产生候选；转换信封不得写入 Workspace、Resource
Package、Market 或云存储。

当前固定的兼容性证据：

- `rinkcx`：`RinkCX/DH_TOOLS@bbf7faa1303c2bbeacfbe8ff339c7ba4cec6e10a`
- `kid`：`jeffdyuyi/DHcard-tool@13385f4b633d35eddf6681f11d0d5c5d46ce5733`
- `zzz`：`ZZZZzzzzac/DaggerHeart_Character@64e6a4484dd1daf9b93779dcf7aaea6e512efde4`
- `dhsheet`：`RidRisR/DaggerHeart-CharacterSheet@fdc1f9e1423a5e044fc547b84f4dbe02af6a5b38`

未裁定的字段损失不会静默接受。Adapter 返回 `decision-required` 诊断，由后续逐
Template 策略决定允许、拒绝或采用显式降级映射。
