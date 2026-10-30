# PBRES 批量编辑

PBRES 本身采用可移植目录结构：根 `package.json` 保存包级元数据，资源 JSON 保持原有目录，图片位于 `assets/`。批量文本修改时使用仓库工具展开和重新封包，不维护第二份长期 JSON 源。

## 解包

```powershell
npm run pbres:unpack -- apps/player/public/system-packages/witchy/resources/witchy.pbres .scratch/witchy-edit
```

命令先通过正式 `loadPbres` 入口校验原包，然后把内容写入指定目录。目标目录必须不存在，避免覆盖手工内容。

## 修改

直接编辑 `.scratch/witchy-edit` 内的资源 JSON。可以使用编辑器的查找替换，也可以让 AI 或一次性脚本批量修改。不要向目录加入说明文件；所有 JSON 和图片都会按 PBRES 目录规则参与校验。

以批量替换为例，修改范围应限定在资源的 `data`，不要全局替换 ID、模板版本或媒体摘要。

## 封包

```powershell
npm run pbres:pack -- .scratch/witchy-edit .scratch/witchy-updated.pbres
```

默认自动升级 patch 版本，例如 `1.2.2` 变为 `1.2.3`，并完成：

- 重新计算 `snapshotDigest`；
- Contract、语义和模板引用校验；
- 使用正式 `writePbres` 写出；
- 对产物再次执行 `loadPbres` 回读校验；
- 把新版本与摘要写回工作目录的 `package.json`，防止重复封包时从旧版本开始。

可通过 `--bump minor`、`--bump major` 或 `--bump none` 改变版本策略。输出文件已存在时默认拒绝覆盖；确认目标后增加 `--force`。

图片不适合直接覆盖原有哈希文件。若媒体发生变化，优先在卡牌工坊中更换图片；直接修改图片字节会因 asset SHA-256 不匹配而被封包工具拒绝。

## 手工改包后重新导入

解压 `.pbres`、改 JSON、换卡图、再压缩回去都是允许的。这类包在本地加载入口会按当前内容重算派生字段后继续：

- Creator 导入 `.pbres`；
- Player 从本地文件安装资源包；
- Player 加载系统包时的内嵌 `.pbres`。

重算的内容包括：图片按字节重新命名（`assets/<sha256>.webp` 与资源槽位一起更新）、`byteLength`、`snapshotDigest`。发布时服务器还会按实际像素更新 `width` / `height`。

剩下的校验只针对结构和语法：zip 与 JSON 能否解析、`package.json` 字段、资源 ID 重复、替换项指向、资源引用的图片是否存在、图片能否解码为 WebP。发布封面仍然要求 630×880。

在需要与外部权威比对的入口按原值校验：市场交接（与服务器记录的快照摘要比对）、云端文档回读、后端发布。这些场合请走 `pbres:unpack` / `pbres:pack`，或者让 Creator 重新导出一次。

版本号是另一条独立要求：内容变了就要升版本，否则市场返回 `PUBLICATION_VERSION_CONFLICT` 并给出最低版本号。Creator 发布会按内容自动建议版本，`pbres:pack` 默认升 patch。

## 替换内置包

审阅后直接替换权威 PBRES，再运行 `npm run verify`。预设系统包不固定 PBRES 的版本与摘要，修改资源内容不需要同步代码索引。

解包目录只是临时编辑工作区，不应提交到仓库。
