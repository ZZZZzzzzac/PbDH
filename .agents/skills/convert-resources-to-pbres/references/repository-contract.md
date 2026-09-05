# 仓库入口与 PBRES 约束

本参考用于每次转换开始时重新定位现行实现。路径是发现入口，不代表可跳过源码和 Schema 检查。

## 先读取的权威内容

- `contracts/resource-package/`：选择当前 Resource Package JSON Schema。
- `packages/templates/src/core/index.ts`：读取 `currentTemplates`，再读取目标模板当前版本的 `capability.ts`、`schema.json` 和必要升级链。
- `packages/resource-conversion/`：读取 Adapter Registry、来源 DTO、模板映射和损失裁定。
- `packages/contract-runtime/`：PBRES 的 `loadPbres` / `writePbres` 与诊断。
- `packages/media-admission/`：图片解码、裁剪、输出宽度、WebP 编码、大小限制和 SHA-256。
- `docs/conversion-source-engines.md`：第三方格式、固定上游证据、显式格式选择和现有语义裁定。
- `docs/pbres-bulk-edit.md`：当前 PBRES 解包、修改、封包和版本策略。
- `docs/adr/0025-require-explicit-source-format-selection.md`、`0026-make-admin-adapters-the-only-resource-ingress.md`、`0027-map-source-dtos-directly-to-template-candidates.md`、`0044-make-resource-package-files-self-contained.md`：格式入口、导入边界、候选映射和媒体自包含决策。

若文档与实现不一致，先查清当前 Contract 和实现，不在转换任务中自行重写架构。

## 第三方卡包入口

调用方必须显式选择来源格式。只使用当前 Adapter Registry 已注册且格式匹配的入口。正式导入报告中的警告、未映射记录和 `decision-required` 都是需要处理的结果，不能只看是否产出了文件。

第三方卡包导入后保留：

- 原始文件不变；
- 转换报告与每条记录的状态；
- 来源身份、顺序和可验证的字段对应；
- 未被裁定的记录为 `pending`，不自动降级为自由模板。

## 原生文本与临时工作区

为每个任务使用独立 `.scratch/<task>/`，建议包含：

- `source-copy/`：来源逐字副本；
- `normalized/`：剥离无关内容且格式统一的可审阅文本；
- `candidate/`：待组装的 PBRES 目录或候选 JSON；
- `reports/`：映射、数量、问题和验收记录；
- 一次性提取脚本（仅大量资源需要）。

不要向待封包目录放说明文件，因为其中内容会参与 PBRES 目录和资源校验。不要提交临时工作区，也不要反向修改原始来源。

## PBRES 写入与批量编辑

对于已存在的 PBRES，使用仓库脚本：

```powershell
npm run pbres:unpack -- <input.pbres> <workspace>
npm run pbres:pack -- <workspace> <output.pbres> --bump patch
```

`pack` 负责版本提升、`snapshotDigest`、Contract/模板校验、正式写出和 `loadPbres` 回读。不要手动计算摘要或用普通 ZIP 工具替代正式写入。用户明确要求保留版本时才使用 `--bump none`；覆盖已存在输出前确认精确目标。

新建包时也必须通过仓库当前正式 Writer/Creator 流程生成包身份、资源 ID、路径、模板引用、presentation、attribution、media 和资产清单，不手写不受校验的 ZIP。

## 图片

PBRES 图片必须自包含，资源图片必须复用 `packages/media-admission` 当前 `resourceImagePolicy`，而不是仅改扩展名或用任意图像命令压缩。使用准入结果的 WebP 字节、尺寸、字节数和 SHA-256 资产 ID。

图片关联的可靠性从高到低：

1. 来源记录中的稳定 ID 或显式路径；
2. 来源 manifest 的映射；
3. 唯一且可证明的规范化名称；
4. 用户确认。

出现重名、多图、多记录共享图、模糊文件名或裁剪意图不明确时，停下来询问用户。不要凭相邻顺序猜图。
