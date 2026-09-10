# dhsheet 人物互通

本文保留已确认的兼容边界、来源和复验入口，不维护逐轮进度。旧测试计数、个人样本路径和已被后续实现取代的待裁定列表已移除。

## 兼容边界

- 只转换最终数值，不同步自动计算来源、手动修正来源或幂等版本记录；不修改 PBCHA 合同，不隐藏保留无法解析的第三方字段。
- 导出遵守 dhsheet 的 15 个普通配置槽和 20 个宝库槽。超量停止导出，不截断卡牌；配置、宝库及重复实例分别保留。
- 导出优先读取 PBCHA 中的 `embeddedResourceEntries`，不要求原资源库仍已安装。
- 匕首之心纯血且资源匹配唯一时复制原规范资源；混血、未知或歧义组合通过现有组合流程保留特性文字。名称相近不作为认定同一卡的证据。
- 已确认的官方卡使用原生身份及来源；其他包的同名卡不冒充官方内置卡。支持已映射的 24 张野兽形态，未知卡或歧义匹配仍需看转换报告。
- 缺少兼职子职卡时不猜身份。导出职业特性读取当前职业资源，不保证手工汇总文本可逆，也不自动补加角色等级或伤害加值。
- TTTRI 的 T4X/Y 对应 `selectedModule: x/y`；`branchUpgradeCount` 由阶段生成，不作为新字段写入 PBCHA。新旧升级奖励与双格消耗不等价，保留 `TTTRI_DHSHEET_ADVANCEMENT_NOT_EQUIVALENT` 提示。
- 属性勾选、施法标记、额外结构化笔记及没有对应组件的文字不等价；超过 5 组经历或 5 行库存、TTTRI 伙伴页与备用武器等不保证保真。
- 不搬运外部 IndexedDB 卡图。头像与伙伴图片走既有图片入口，未穷尽跨浏览器媒体往返。
- 坐标、旋转、翻面、指示物等桌面状态没有 StandardCard 等价字段；不塞入卡牌说明。原始装备文本中的分隔符也不保证无歧义往返。

转换报告不是逐字段穷尽的损失报告；`skippedFields=0` 不等于无损。上游可能重新计算数值和规则文字，源码校验通过也不代表浏览器完整往返已验收。

## 来源记录

- 外部仓库：`dqqql/DaggerHeart-CharacterSheet`，最近核对 commit 为 `de4c1e5f9db96c873908876dae6cfe183f34b51d`；早期对照为 `fdc1f9e1423a5e044fc547b84f4dbe02af6a5b38`。不作为 App 运行时依赖。
- 结构依据：`lib/sheet-data.ts`、`lib/storage.ts`、`lib/character-data-validator.ts`、`card/card-types.ts` 和各卡类型的 `convert.ts`。
- 原生卡身份表来自 `data/cards/builtin-base.json` 与 `card/*-card/convert.ts`，复制身份和显示元数据，不复制另一套规则正文权威。生成区在基础系统包 `adapters/scripts/character-export.js` 内保留来源 commit。
- TTTRI 五组背面修复来源：`PbDH_sheet@fe1de3ff248e27f577e281f2a3318aff47723412`，原路径 `public/system-packages/tttri/resources/domain-cards.json` 的 `卡背` 字段及 `assets/cards/domain-cards/` 图片；正文逐张对照 600×840 WebP 转录。
- 五组关系为：归乡邀约 / 归乡邀约·洗礼、霜白摇篮曲 / 摇篮曲·终、大地的慈悲 / 大地的慈悲·昭示、反击炮火 / 召唤：炮台、号令巨兵 / 召唤：巨兵。独立资源通过 `alternate-form` 双向关联；“恶魇吞日”和“遁入阇那”的改名保留原 ID。一次性修复脚本已移除，正式 PBRES 与回归测试保留。

## 验证入口

日常 `npm run verify` 已包含自包含人物互通回归，不依赖 `.scratch` 样本或外部仓库。

```powershell
npx vitest run tests/player/dhsheet-interop.test.ts
npm run check:dhsheet-interop -- --source "D:\path\to\DaggerHeart-CharacterSheet"
```

第二条是可选的上游源码联调：执行对方真实校验、清理、默认值合并与迁移，再回导 PbDH；可用 `--character` 指定自有 PBCHA，`--reference`、`--original` 指定对照。上游依赖应由其自身安装提供。输出在 `.scratch/dhsheet-interop/`，原始输入不覆盖，回导副本不能直接覆盖原档。

审阅并接受上游卡表变化后，才重新生成原生身份查询表：

```powershell
node scripts/sync-dhsheet-native-cards.mjs "D:\path\to\DaggerHeart-CharacterSheet"
```

生成后重新运行互通测试和完整验证；源码联调不替代用户实际导入、图片和自动重算验收。
