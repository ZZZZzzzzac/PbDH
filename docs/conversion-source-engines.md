# 第三方格式转换源码与测试引擎基线

状态：开发中
固定日期：2026-08-25

本文记录 `packages/resource-conversion` 与 Player 人物卡临时转换测试使用的上游证据。
上游仓库没有作为 submodule、subtree、嵌套仓库或运行时依赖进入 PbDH。

## 固定源码

| 格式 | 仓库与 revision | 读写入口 |
| --- | --- | --- |
| RinkCX | `RinkCX/DH_TOOLS@bbf7faa1303c2bbeacfbe8ff339c7ba4cec6e10a` | `enemy.html`、`scene.html`、`【最新】匕首之心整合框架_1222版本.html` |
| 基德 | `jeffdyuyi/DHcard-tool@13385f4b633d35eddf6681f11d0d5c5d46ce5733` | `types.ts`、`App.tsx`、`utils.ts`、`ccExporter.ts` |
| ZZZ | `ZZZZzzzzac/DaggerHeart_Character@64e6a4484dd1daf9b93779dcf7aaea6e512efde4` | `js/action.js`、`js/custom.js`、`js/card.js`、`js/rrr_converter.js` |
| dhsheet | `RidRisR/DaggerHeart-CharacterSheet@fdc1f9e1423a5e044fc547b84f4dbe02af6a5b38` | `card/card-types.ts`、`app/card-editor/utils/import-export.ts`、`zip-import.ts`、`zip-export.ts`、`lib/sheet-data.ts`、`hooks/use-character-management.ts`、`lib/html-importer.ts`、`lib/html-exporter.ts` |
| PbDH 资源 | 本仓库 `resource-package@1.0.0-alpha.1` | `packages/contract-runtime` 的 `loadPbres` / `writePbres` |

测试目录中的 `upstream-engines.ts` 只抽取上表入口真正决定“目标工具能否读取”的最小
行为，不加载 PbDH Adapter。测试因此能发现“PbDH 自己写出、PbDH 自己读回”无法发现的
兼容性错误。

## 资源转换边界

调用方必须显式选择 `pbres`、`rinkcx`、`kid`、`dhsheet` 或 `zzz`。Core 不跨生态
探测或回退。Adapter 只在所选格式内部判断 JSON、`.dhcb`、`.pbres` 或尾附数据 PNG。

第三方来源先进入短生命周期转换信封。每条记录同时包含：

- 可用于当前 Template 映射的规范字段；
- 来源格式、固定 revision 与来源位置；
- 转换会话内的来源 DTO，用于尚未经过逐 Template 损失裁定的往返证明。

来源 DTO 和完整报告不得持久化到 Resource Package、Workspace、Market 或云数据。当前敌人、
武器、护甲、物品、职业、子职业、种族、社群、领域卡和环境已注册专用 Template 映射；其中护甲、
物品、职业、子职业、种族、社群、领域卡和环境仍使用开发期临时 Template。基德独有且暂不兼容的
16 类使用显式自由 Template 映射；其他未知类型继续停留在转换信封中，不能仅因字段相近而伪装成
合法资源。

## 人物卡转换边界

人物卡格式固定为 `.pbcha`、dhsheet 与 ZZZ。dhsheet/ZZZ Adapter 位于 Player 组合根，
不进入平台 Resource Adapter Registry。

仓库尚无 Character Save Schema。为先验证三套读写链，当前 `.pbcha` 使用
`0.0.0-dev.1` 测试 Profile：

```text
character.pbcha
├── manifest.json  # family=character-save, status=development-only
└── character.json # 临时规范值、卡牌与来源扩展
```

该 Profile 只用于测试引擎，不能写入正式本地/云文档、Market、生产 API 或正式文件导出。
Character Save Contract 发布后必须由权威 Reader/Writer 取代；第三方语义映射仍由 Daggerheart
System Package 的 Character Format Adapter 拥有。

## 损失裁定

默认规则是：未裁定的损失阻断转换，并返回 `conversion.decision-required`。已经完成的
“敌人” Template 裁定如下：

- RinkCX/基德的触发、选择、风味以及 RinkCX 渲染装饰不是匕首之心敌人信息，可静默忽略；
- 原文与特性原名不是必要信息，目标格式不能表达时可静默忽略；
- 位阶、阈值、生命、压力和攻击等战斗字段可在目标格式不能表达时静默忽略；
- 基德来源本身没有的字段在 Contract candidate 中保留为空字符串；
- dhsheet 使用声明了“敌人”类型的 `variant`，ZZZ 使用开放的“敌人”记录，完整携带 Contract 字段。

“武器”使用 `武器@1.0.0-alpha.2`，裁定如下：

- `描述`承载游戏效果，对应基德 `feature`；新增`风味描述`承载基德 `description`；
- 基德 `weapon`/`subweapon` 不提供位阶时允许静默留空或在导出时丢弃；
- 基德 `wheelchair` 不是普通匕首之心武器，保留在临时转换信封，不映射到武器 Template；
- dhsheet 与 ZZZ 完整携带两个描述字段；RinkCX 不支持独立武器资源，转换保持拒绝。

“护甲”暂存于 `护甲@0.0.0-dev.1`，裁定如下：

- 规范字段为名称、类型、护甲值、重度伤害阈值、严重伤害阈值、游戏效果描述、风味描述和位阶；
- 基德 `feature` 映射到`描述`，`description` 映射到`风味描述`，缺少位阶可静默忽略；
- dhsheet 的`重度阈值`与 ZZZ 的`重伤阈值`统一为`重度伤害阈值`，导出时恢复目标原生拼写；
- RinkCX 不支持独立护甲资源，转换保持拒绝；
- 该 Template 只注册开发期 Core 与校验能力，没有生产 Renderer，不进入完整前端支持清单。

“物品”暂存于 `物品@0.0.0-dev.1`，裁定如下：

- 普通物品与消耗品共用 Template，由`类型`的`物品`/`消耗品`枚举区分；
- 基德 `loot.feature` 与 `consumable.effect` 映射到游戏效果`描述`，其 `description` 映射到`风味描述`；
- dhsheet/ZZZ 的`掷骰`完整保留，基德不提供该字段时可静默留空或在导出时丢弃；
- 来源中的`战利品`类型规范为`物品`；RinkCX 不支持独立物品资源，转换保持拒绝；
- 该 Template 只注册开发期 Core 与校验能力，没有生产 Renderer，不进入完整前端支持清单。

“职业”暂存于 `职业@0.0.0-dev.1`，裁定如下：

- 领域、背景问题和关系问题使用字符串数组，推荐初始属性使用属性名到数值字符串的对象；
- dhsheet 的领域分隔字符串、格式化推荐属性与编号问题在导入时结构化，导出时同时提供其原生字段；
- ZZZ 的领域字符串、属性对象和问题数组可逆转换；
- 基德支持领域、生命、闪避、职业物品、希望/职业特性与施法属性，不提供的推荐项和问题可静默忽略；
- RinkCX 不支持职业资源，转换保持拒绝；该临时 Template 不进入完整前端支持清单。

“子职业”暂存于 `子职业@0.0.0-dev.1`，裁定如下：

- 规范模型按基础、进阶、精通三个等级各存一条资源，字段为名称、主职、等级、施法属性、
  游戏效果描述和风味描述；
- 基德一张 `subclass` 卡按实际存在的 `foundationFeature`、`advancedFeature`、
  `masteryFeature` 拆成最多三条资源；反向导出按相同名称与主职合并，缺失等级保持空字段；
- 基德的公共 `description` 复制到各等级的`风味描述`，同来源未知字段仍由来源 DTO 保留；
- dhsheet 的基石、专精、大师与规范等级双向映射；ZZZ 的名称等级后缀在导入时归一化，
  导出时恢复；
- RinkCX 不支持子职业资源，转换保持拒绝；该临时 Template 不进入完整前端支持清单。

“种族”暂存于 `种族@0.0.0-dev.1`，裁定如下：

- 规范字段为名称、简介，以及最多两项由名称和描述组成的结构化特性数组；其顺序对应
  PbDH_Sheet 的`特性A`、`特性B`；
- 基德一张 `ancestry` 卡的两组 `featureName/featureDesc` 与规范特性逐项映射，缺失第二项时
  保持空字段，不补造内容；
- dhsheet 按相同`种族 + 简介`合并类别 1/2 卡，导出时按数组顺序拆回原生卡；没有特性时
  仅生成一条空效果载体以保留种族名称与简介，不生成第二项占位内容；
- ZZZ 的两行“名称：描述”可逆转换；不能可靠识别边界的原生`描述`完整存入一项无名称特性，
  不丢弃原文；
- RinkCX 不支持种族资源，转换保持拒绝；该临时 Template 不进入完整前端支持清单。

“社群”暂存于 `社群@0.0.0-dev.1`，裁定如下：

- 规范字段为名称、简介、性格，以及由名称和描述组成的单个游戏特性；风味信息不与游戏效果混用；
- 基德的 `description`、`demeanor`、`featureName/featureDesc` 分别精确映射到上述字段；
- dhsheet 的`特性`字段表示性格，ZZZ 优先读取`性格`并兼容`特性`；两者的合并`描述`按
  “名称：描述”解析与写出；
- 无法可靠识别名称边界的原生描述完整存入无名称特性的`描述`，不丢弃原文；
- RinkCX 不支持社群资源，转换保持拒绝；该临时 Template 不进入完整前端支持清单。

“领域卡”暂存于 `领域卡@0.0.0-dev.1`，裁定如下：

- 规范字段为名称、领域、等级、属性、回想、游戏效果描述和风味描述；
- 等级与回想保存无展示后缀的十进制字符串，导入时统一 `1级/1` 与 `0⚡/0`，PbDH_Sheet
  展示时再添加`级`和`⚡`；
- 基德 `ability` 映射到游戏效果`描述`，基础 `description` 映射到`风味描述`；
- dhsheet/ZZZ 的等级和回想导出为数字，目标格式没有独立风味字段时静默丢弃风味描述；
- RinkCX 不支持领域卡资源，转换保持拒绝；该临时 Template 不进入完整前端支持清单。

“环境”暂存于 `环境@0.0.0-dev.1`，裁定如下：

- 规范字段为名称、位阶、种类、简介、趋向、难度、潜在敌人，以及结构化特性数组；
- 每项特性只保留名称、类型、描述和引导问题；恐惧标记与恐惧花费不是规范环境信息，
  RinkCX 的 `fear/cost` 和基德的 `isFear/fearCost` 均静默丢弃；
- RinkCX 场景卡与基德 `environment` 的其余环境及特性字段完整映射；导出时不生成恐惧字段；
- dhsheet 使用已声明中文“环境”类型的 `variant`，ZZZ 使用开放的“环境”记录，两者完整携带规范字段；
- RinkCX 英文原名按既有裁定静默忽略；该临时 Template 不进入完整前端支持清单。

“自由模板”使用 `自由@1.0.0`，裁定如下：

- 规范字段固定为`名称`、`类型`、`简介`与有序`内容`块；每个内容块只含`标题`与`正文`；
- 基德的 `story`、`calamity`、`ingredient`、`meal`、`transformation`、`material`、
  `vehicle`、`madness`、`clue`、`prophecy`、`question`、`quest`、`wheelchair`、
  `anomaly`、`stronghold`、`landmark` 暂不建立专用 Template，显式映射到自由模板；
- 基德结构化数组按原顺序格式化为可见文本行；所有卡面可见业务字段均进入内容块，不把
  creator、owner、来源 ID、来源 DTO 或未知隐藏字段写入游戏资源；
- 同一转换会话内依靠来源 DTO 可无损导回原基德格式；持久化为自由资源后不承诺重新构造
  基德原始结构；
- dhsheet 使用 `variant` 自定义类型，ZZZ 使用开放记录，两者完整携带自由模板字段；RinkCX
  不支持自由资源，转换保持拒绝；
- 未在上述清单中的未知类型必须继续返回未映射或稳定失败，不能自动进入自由模板。

当前仍需逐 Template 或人物模块裁定的项目包括：

- 基德已专用映射的类型、自由映射的 16 类、dhsheet 六分组与 ZZZ 开放类型之间存在拆分、合并和扁平化；
- ZZZ `{data, position}` 与 dhsheet `StandardCard[20]` 的卡牌身份、布局和槽位不等价。

同来源往返必须保留未识别的未来字段。跨来源转换只有在对应决策已编码并有目标引擎测试
后才能成功。
