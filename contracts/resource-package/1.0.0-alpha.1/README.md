# Resource Package Contract 1.0.0-alpha.1

此 prerelease 只定义纯数据逻辑快照；目录、ZIP 与 `.pbres` Profile 留给后续纵切。

## Snapshot Digest v1

算法固定为 SHA-256。输入是下列连续帧；每帧编码为：

1. 4 字节大端无符号整数：UTF-8 帧类型长度；
2. UTF-8 帧类型；
3. 8 字节大端无符号整数：payload 长度；
4. payload 原始字节。

帧顺序：

1. `domain`：`pbdh-resource-package-digest-v1`；
2. `logical-document`：排除 `snapshotDigest` 后的 RFC 8785 JCS 字节；
3. 每个 Asset 依 Asset ID 的 Unicode code point 顺序，各写一帧 `asset-id` 和
   一帧 `asset-bytes`。

进入 JCS 前，`targets` 按 `(systemPackageId, version)`、`assets` 按 Asset ID、
`resources` 按 `(path, id)`、`emptyDirectories` 按路径排序；这些集合的展示顺序
不影响 Digest。Schema 将可摘要标量限制为 string 或 null，避免跨语言数值序列化
差异。`presentation.fixedRatio` 是逻辑文档中唯一新增的 boolean 标量；资源 `data`
仍限制为 string 或 null。普通文本不做 Unicode 规范化；对象键由 JCS 按 UTF-16
code units 排序。

消费者必须先做 Schema 与语义校验，再计算 Digest。媒体缺失、Asset ID 与字节哈希
不一致或声明值不匹配时，快照无效。

## Presentation

每个资源显式声明卡面尺寸、内容模式和内容溢出策略：

- `mode: text`：纯文字卡面，媒体区完全折叠；
- `mode: split`：半图半文字卡面；
- `mode: image`：纯图片卡面；
- `fixedRatio: true`：严格保持声明尺寸并截断溢出内容；
- `fixedRatio: false`：保持声明宽度，允许高度随内容增长。

这些字段属于逻辑快照并进入 Snapshot Digest。所有宿主必须把它们交给同一 Renderer，
不得保存 Creator 私有的卡面表现副本。

## Directory / `.pbres` Profile

Portable Archive 根结构：

- `package.json`：除 `resources` 外的逻辑文档字段；
- `assets/<sha256>.webp`：规范化媒体，每个 Asset ID 恰好一次；
- 其他递归 `*.json`：单个 Game Resource；文件内不保存 `path`，导入时由相对路径恢复；
- `emptyDirectories` 中的目录在 ZIP 内使用显式 `/` directory entry。

目录和 ZIP 仅接受普通文件、普通目录。所有链接、reparse point 与特殊文件均拒绝。
路径使用 `/`、保持相对；碰撞键为 Unicode NFC 后的小写形式。绝对路径、反斜线、
`.`、`..`、空段、控制字符、Windows 保留名、结尾空格/点及文件/目录碰撞非法。

本 prerelease 使用待语料测量后再冻结的开发上限：归档 16 MiB、1024 entries、单路径
512 UTF-8 bytes、单文件 8 MiB、总展开 64 MiB、压缩比 100:1。它们不能作为正式
`1.0.0` Profile 发布依据。
