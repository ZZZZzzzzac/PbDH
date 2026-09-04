# Daggerheart SRD 2.0 Source Rules

- `DH_SRD_2_2026_08_25.paratranz.json` 是 Daggerheart Core 两个资源包的仓库内构建权威，必须进入 Git；不得依赖开发机上的外部绝对路径复现资源包。
- 文件保存 ParaTranz 导出的原始 JSON 字节，不手工格式化或改写。文本修订必须先在上游翻译工程完成，再以完整的新导出替换本快照。
- 收到新导出后，先运行 `npx tsx scripts/diff-daggerheart-srd2-source.ts --source <新导出>`，按记录 `key` 审阅新增、删除及 `original`、`translation`、`stage` 的变化。
- 确认差异后，先用 `npx tsx scripts/extract-daggerheart-srd2-resources.ts --source <新导出>` 执行完整提取与 fail-closed 校验；成功后再运行差异命令并追加 `--accept`，将同一份导出保存为新快照。
- 最后运行 `npx tsx scripts/extract-daggerheart-srd2-resources.ts` 从仓库快照复现资源 JSON，再运行 `npx tsx scripts/generate-daggerheart-core-system-package.ts` 更新玩家与 GM 资源包。
- `source-provenance.json` 必须记录快照的仓库相对路径、SHA-256、记录数和提取数量；不得记录本机绝对路径。

