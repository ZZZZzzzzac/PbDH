# 更新日志

记录已成功部署的版本。时间为北京时间（Asia/Shanghai），以部署工作流完成时间为准。
代码 commit 以 Release tag 指向的提交为准，不以部署工作流的 `headSha` 代替：重新部署旧版本时，工作流可能使用更新的部署脚本。

## v0.1.15 — 2026-09-10 13:48:43

- 状态：已部署，公网版本与 API 健康检查通过。
- 代码 commit：[6939810](https://github.com/ZZZZzzzzac/PbDH/commit/6939810402d748c5eb4a73b377021118de864a16)。
- 上一部署：`v0.1.14` / `bdd755f`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.15) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/34442307872) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/34442535782) · [完整差异](https://github.com/ZZZZzzzzac/PbDH/compare/v0.1.14...v0.1.15)。

### 新增

- 工作区按模板分组与多条件排序。字段按模板声明顺序决定优先级，点击循环切换不排序、升序、降序，本机记忆配置。
- 分级排序菜单仅显示有名称之外排序字段的模板，避免工具区堆叠控件。
- 玩家卡 `1.0.0` 正式模板：角色名、玩家名、生命、压力、希望、护甲槽与备注；资源以图标手动追踪，每张桌面实例独立保存状态，不自动同步人物存档。关联 #69。

### 修复

- 右键菜单按实际尺寸避让窗口边界，超高菜单可滚动，避免工作区容器裁切。
- 点击资源包名称选择根目录；右键资源包及列表空白区后，新建资源和文件夹落在根目录。
- 修复复制工作区时将根目录 `null` 误判为未选择、导致新建资源回到旧目录的问题。
- 人物卡审核修复护甲识别，补齐装备常驻属性、闪避、护甲及阈值调整，并显示“审核仅供参考”。关联 #70。
- 已选装备定义未加载时，明确提示导入对应资源包，暂停依赖装备定义的数值审核，避免旧人物存档误报。

### 调整

- Daggerheart Core 默认包从 980 条恢复为核心书 640 条，采用 `docs/third/daggerheart-core-book.pbres` 的内容；希望与恐惧 340 条作为独立包按需导入。
- 保留默认包 ID，资源包升至 `1.0.25`，系统包升至 `1.0.2`；人物数据版本与资源兼容范围不变，用户自行导入的包不被覆盖。
- 重建默认包时按核心书资源 ID 范围过滤，避免重新混入扩展。

### 验证

- 本地完整 `npm run verify` 通过：1201 项 TypeScript 测试、170 项 Python 测试，以及类型检查、契约检查、依赖检查和构建。
- GitHub Release 与 Deploy Release 工作流均成功。
- 公网核对：应用 `0.1.15`、系统包 `1.0.2`、默认资源包 `1.0.25` / 640 条，API 返回 `ok`。
- 已由用户进行本地验收；自动浏览器连接认证故障，本轮未完成自动化截图验收。

## v0.1.14 — 2026-09-10 00:29:53

- 状态：部署工作流成功，历史交接记录确认线上健康正常。
- 代码 commit：[bdd755f](https://github.com/ZZZZzzzzac/PbDH/commit/bdd755f176d50df7f7a3fd3e9b72747ff93cea56)。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.14) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/34376707799) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/34377035761)。

### 修复

- dhsheet 导出声明完整的职业、种族、社群及领域名称，包含子职业与职业引用。
- 空施法值输出“不可施法”；变体卡从现有正文补齐效果，自由卡重新导入不重复添加摘要。
- 补充 JSON/dhcb 严格导入兼容回归；使用真实上游校验器验证 1004 张卡，零错误、零警告。

## 历史记录与追溯

- 更早部署记录见 [开发交接](docs/handoff.md)，本文件暂从 `v0.1.14` 开始整理。
- [GitHub Releases](https://github.com/ZZZZzzzzac/PbDH/releases) 保存版本标签和发布制品。
- [Deploy Release 历史](https://github.com/ZZZZzzzzac/PbDH/actions/workflows/deploy.yml) 保存部署执行结果；部署版本可从运行输入或下载、激活步骤核对。
- 查询 tag 对应代码：`git rev-parse 'v0.1.15^{commit}'`。
- 比较两个已部署版本：`git log --oneline v0.1.14..v0.1.15` 或查看对应 GitHub compare 页面。

后续记录同样包含版本、代码 commit、上一部署版本、成功部署时间、变更摘要与部署链接；仅发布制品但未部署成功的版本不标记为已部署。
