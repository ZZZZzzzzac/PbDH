import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { computeRuntimeMetadataDigest } from "../../scripts/system-package-metadata-digest.ts";

const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test("运行文件摘要只反映内容：CRLF 与 LF 同摘要，内容变化必改摘要", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pbdh-metadata-digest-"));
  roots.push(root);
  const files = ["modules.json", "layouts/base.css"];
  await mkdir(path.join(root, "layouts"), { recursive: true });
  await writeFile(path.join(root, "modules.json"), '[{"ID":"hp"}]\n', "utf8");
  await writeFile(path.join(root, "layouts/base.css"), ".sheet {\n  color: red;\n}\n", "utf8");
  const contentDigest = await computeRuntimeMetadataDigest(root, files);

  await writeFile(path.join(root, "modules.json"), '[{"ID":"hp"}]\r\n', "utf8");
  await writeFile(path.join(root, "layouts/base.css"), ".sheet {\r\n  color: red;\r\n}\r\n", "utf8");
  expect(await computeRuntimeMetadataDigest(root, files)).toBe(contentDigest);

  await writeFile(path.join(root, "layouts/base.css"), ".sheet {\r\n  color: blue;\r\n}\r\n", "utf8");
  expect(await computeRuntimeMetadataDigest(root, files)).not.toBe(contentDigest);

  expect(await computeRuntimeMetadataDigest(root, [...files].reverse()))
    .toBe(await computeRuntimeMetadataDigest(root, files));
});
