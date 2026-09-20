import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

// 预置 System Package 的「运行时元数据内容摘要」。
// 输入是与 .pbdh-runtime-files.json 完全一致的运行时文件清单；
// 摘要按路径排序逐文件取内容 sha256，再汇总为单个 sha256，
// 因此它能唯一标识「这套预置文件的内容」，与发布版本号无关。
// 运行时用它与本地缓存记录比对，判断缓存是否仍是当前内容。
export async function computeRuntimeMetadataDigest(
  root: string,
  files: readonly string[],
): Promise<string> {
  const digest = createHash("sha256");
  for (const file of [...files].sort()) {
    const bytes = await readFile(path.join(root, file));
    digest.update(`${file}\n${createHash("sha256").update(bytes).digest("hex")}\n`);
  }
  return `sha256:${digest.digest("hex")}`;
}
