# Daggerheart SRD 2.0 Source Rules

- `DH_SRD_2_2026_08_25.paratranz.json` 是 Daggerheart Core 两个资源包的仓库内构建权威，必须进入 Git；不得依赖开发机上的外部绝对路径复现资源包。
- 默认玩家包的资源 ID 范围由 `docs/third/daggerheart-core-book.pbres` 定义，该范围文件同样随仓库维护；只有核心书成员进入默认包，其他 SRD 资源不因重新生成而自动纳入。内容仍由本目录的 ParaTranz 快照提供。
- 文件保存 ParaTranz 导出的原始 JSON 字节，不手工格式化或改写。文本修订必须先在上游翻译工程完成，再以完整的新导出替换本快照。
- 收到新导出后，先运行 `npx tsx scripts/diff-daggerheart-srd2-source.ts --source <新导出>`，按记录 `key` 审阅新增、删除及 `original`、`translation`、`stage` 的变化。
- 确认差异后，用 `npm run check:daggerheart-core -- <新导出>` 在临时目录执行完整提取与 fail-closed 校验，不改写正式 PBRES；成功后再运行差异命令并追加 `--accept`，将同一份导出保存为新快照。
- 接受快照后再运行 `npm run build:daggerheart-core` 更新玩家与 GM 资源包。中间提取 JSON 只存在于临时目录，不得提交。
