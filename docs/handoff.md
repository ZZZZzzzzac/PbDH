# PbDH 开发交接

更新时间：2026-08-26

## 当前落点

- 分支：`main`
- 当前代码检查点：本文件所在提交；已合并 Web 功能线与格式转换器工作线。
- 路线状态：阶段 5 已完成；阶段 6 的 #38—#41 已完成，#42 已完成自动化验证并等待人工验收，详见 `docs/roadmap.md`。
- 资源转换核心阶段已告一段落；下一转换工作是 Creator 产品接入。人物格式 `.pbcha`、dhsheet、ZZZ
  保持开发期测试 Profile，等待正式 Character Save Contract 后再继续。

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
- `武器@1.0.0-alpha.2` 新增游戏`描述`与`风味描述`分离及对应前端 Renderer；护甲、物品、职业、
  子职业、种族、社群、领域卡和环境使用 `0.0.0-dev.1` 临时 Core Template，不进入生产前端支持清单。
- `.pbres` 读取现可恢复所有上述 Template 的具体资源种类。
- 新增内置 `自由@1.0.0` Template、Authoring Layout 与基础 Renderer；数据固定为
  `名称 + 类型 + 简介 + 内容块[]`。
- 基德 16 个暂不兼容的独有卡型已显式映射到自由模板；不再为它们逐个建立专用 Template，
  也不再伪装成武器、物品等既有资源。

## 已验证

- 本轮 `npm run verify` 通过：41 个 TypeScript 测试文件、281 个测试；69 个 Python 测试；
  依赖边界、设计检查、类型检查与 Platform 构建通过。
- 已知非阻塞警告：Platform 构建 chunk 超过 500 kB；Git 在 Windows 提示部分 LF 将转 CRLF。

## 下一步

1. 人工验收 #42；通过后进入敌人路径的 Creator 与 GM 云恢复 #43。
2. 不再逐个处理基德独有的 `story`、载具、异常、据点、食材等 16 类；它们统一走自由模板。
3. 对真正需要专用语义的新类型继续坚持“一次一个模板”：先从固定 revision 源码确认原生结构，再给用户字段与损失裁定，
   获批后实现 Template、Adapter、目标引擎测试、文档并运行 `npm run verify`。
4. 所有计划中的专用资源模板完成后，再回到人物卡临时 Profile，逐字段对照正式 Character Save Contract；
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
