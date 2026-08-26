# PbDH 开发交接

更新时间：2026-08-26

## 当前落点

- 分支：`main`
- Web 功能线本地检查点：`147a2c1`（`开发中`）；格式转换器远程检查点：`6302109`（`feat: add third-party conversion engines`）。
- 路线状态：阶段 5 已完成；阶段 6 的 #38—#41 已完成，#42 已完成自动化验证并等待人工验收，详见 `docs/roadmap.md`。
- 目标：继续逐 Template 完成第三方资源转换；资源格式为 `.pbres`、RinkCX、基德、dhsheet、ZZZ，人物格式为 `.pbcha`、dhsheet、ZZZ。

## 权威上下文

- 上游仓库、固定 revision、最小目标测试引擎、已批准字段损失和每个已完成 Template 的映射见
  [`docs/conversion-source-engines.md`](conversion-source-engines.md)。不要在本文件复制这些内容。
- 架构边界见 `CONTEXT.md` 的“资源转换”领域语言，以及 ADR 0025、0026、0027、0040。
- 实现入口：`packages/resource-conversion/src/`；临时人物转换入口：
  `apps/player/src/character-conversion/`；目标引擎验收：`tests/resource-conversion/` 与
  `tests/character-conversion/`。

## 本轮完成

- 建立无 UI、无持久化的资源转换核心、Adapter Registry、短生命周期来源信封与稳定诊断。
- 固定并抽取 RinkCX、基德、dhsheet、ZZZ 的最小读取测试引擎；`.pbres` 使用本仓库权威 Reader/Writer。
- 建立 `.pbcha`、dhsheet、ZZZ 的临时人物卡双向转换测试链；正式 Character Save Schema 尚未建立。
- 已完成资源 Template：敌人、武器、护甲、物品、职业、子职业、种族、社群、领域卡、环境。
- `武器@1.0.0-alpha.2` 新增游戏`描述`与`风味描述`分离及对应前端 Renderer；其余新增类型使用
  `0.0.0-dev.1` 临时 Core Template，不进入生产前端支持清单。
- `.pbres` 读取现可恢复所有上述 Template 的具体资源种类。
- 未裁定的基德 `ingredient/meal/material` 已恢复为未映射资源，避免伪装成合法“物品”。

## 已验证

- 提交前 `npm run verify` 通过：31 个 TypeScript 测试文件、225 个测试；43 个 Python 测试；
  类型检查与 Creator、Player、Market 构建通过。
- 已知非阻塞警告：Creator 构建 chunk 超过 500 kB；Git 在 Windows 提示部分 LF 将转 CRLF。

## 下一步

1. 人工验收 #42；通过后进入敌人路径的 Creator 与 GM 云恢复 #43。
2. 用户尚未批准下一个转换模板。上次给出的建议是基德“专属卡（`story`）”：规范字段为名称、
   触发、游戏效果`描述`、`风味描述`；基德精确映射，dhsheet/ZZZ 使用开放扩展记录，RinkCX 拒绝。
   先取得用户确认再实现。
3. 继续坚持“一次一个模板”：先从固定 revision 源码确认原生结构，再给用户字段与损失裁定，
   获批后实现 Template、Adapter、目标引擎测试、文档并运行 `npm run verify`。
4. 基德尚未裁定的扩展类型包括 `calamity`、`ingredient`、`meal`、`transformation`、`material`、
   `vehicle`、`madness`、`clue`、`prophecy`、`question`、`quest`、`wheelchair`、`anomaly`、
   `stronghold`、`landmark` 等；不得仅因字段相近就映射到现有 Template。
5. 所有资源模板完成后，再回到人物卡临时 Profile，逐字段对照正式 Character Save Contract；
   当前临时 Profile 不得进入生产持久化或正式导出。

## 用户已确认的总规则

- 用户逐 Template 判断允许遗漏；第三方格式本身没有的字段无需补齐或负责。
- 尚未裁定的数据先留在短生命周期来源信封，不伪造合法 Contract。
- RinkCX 渲染装饰静默丢弃；原文、特性原名、目标格式缺失的战斗字段可静默丢弃。
- `描述`默认承载游戏效果，`风味描述`承载风味；具体例外以转换基线文档为准。
- 不处理第三方许可或 license 问题。

## 建议 skills

- `$code-review`：全部扩展模板完成或准备 PR 前，审查这次大范围转换改动与来源证据一致性。
- `$diagnose`：仅在目标引擎 fixture、跨格式往返或统一验证出现难以定位的失败时使用。
- `$handoff`：下次跨设备暂停前更新本文件，并提交但不要自行 push。
