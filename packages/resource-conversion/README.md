# Resource Conversion

无 UI、无持久化的资源转换核心。只允许依赖 Contract 与 `templates/core`。

所有入口都要求调用方显式选择来源格式。第三方数据先进入短生命周期、保留来源 DTO
的转换信封，再由逐 Template 映射器产生候选；转换信封不得写入 Workspace、Resource
Package、Market 或云存储。

第三方数据映射到当前 Template 时，不支持 Markdown 的字段会去除强调、标题、链接等
格式标记并保留文字。支持 Markdown 的正文及武器/护甲特性名称保持原样；此处理不修改
来源 DTO，不作用于原生 PBRES 导入。新增模板映射时需同步核对 `plain-text.ts` 的正文路径。

当前固定的兼容性证据：

- `rinkcx`：`RinkCX/DH_TOOLS@bbf7faa1303c2bbeacfbe8ff339c7ba4cec6e10a`
- `kid`：`jeffdyuyi/DHcard-tool@13385f4b633d35eddf6681f11d0d5c5d46ce5733`
- `zzz`：`ZZZZzzzzac/DaggerHeart_Character@64e6a4484dd1daf9b93779dcf7aaea6e512efde4`
- `dhsheet`：`RidRisR/DaggerHeart-CharacterSheet@fdc1f9e1423a5e044fc547b84f4dbe02af6a5b38`

Rink 导入支持单个 JSON（对象或数组），以及每个 JSON 文件包含一个资源对象的 ZIP。
ZIP 内的相对目录和文件名直接成为资源 path，不移除顶层目录，也不按模板重新分类；
UTF-8 文件名按 ZIP 标记读取，未标记的旧中文文件名按 GBK/GB18030 解码。
图片和其他非 JSON 成员完全忽略。坏记录按成员路径报告，不安全路径和路径重名拒绝整包；
ZIP 最多 1000 个成员，JSON 解压后总量最多 64 MiB。导出仍使用原有 JSON 格式。

未裁定的字段损失不会静默接受。Adapter 返回 `decision-required` 诊断，由后续逐
Template 策略决定允许、拒绝或采用显式降级映射。

基德独有且暂不进入 PbDH 专用模型的 16 类使用 `自由@1.0.0` 显式降级，只保存
`名称`、`类型`、`简介`和有序的标题/正文内容块。未列入该策略的未知记录仍保持未映射。

基德导出按最终卡牌数量选择容器：一张为 JSON，多张为 ZIP（每个成员一个原生 JSON）。
相同名称与主职的子职业等级合并为一张卡；重复或无效等级拒绝导出，避免静默丢失。
ZIP 成员名使用序号与清理后的卡名，避免同名覆盖和路径逃逸；任一卡无法转换时拒绝整包。
Creator 对无署名的 PBRES 提供 `creator`、`owner` 的“未署名”占位，不推断真实身份。
ZIP 是分发容器，使用时解压后导入各 JSON；基德 PNG、卡图和外观不在导出范围内。
敌人导出基德 NPC 时，简介与原文进入 `description`；战斗数值及经历放进第一条
无标题特性的紧凑正文，后续特性名称使用“名称 - 类型”。空字段省略；资源类型与
特性原文不输出，重新导入不反解析战斗摘要。
武器与护甲的非空位阶以“位阶N”独立一行合入 `feature` 开头，其余特性文字保留。
罗德岛子职明确不支持基德导出，包含该模板时拒绝整包；不套用普通子职业映射。
其他已知损失（原文、掷骰、职业推荐项和问题、子职业不同简介等）按已接受策略省略，
不额外补入文字；合并后仍完整保留的内容不视为信息损失。
