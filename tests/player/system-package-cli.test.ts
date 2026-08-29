import { zipSync } from "fflate";
import { describe, expect, test } from "vitest";

import {
  createVirtualFileSystem,
  createVirtualFileSystemFromZipBytes,
} from "../../apps/player/src/sheet-runtime/loaders/packageVfs.ts";
import {
  buildSystemPackageScaffold,
  validateSystemPackageVfs,
} from "../../scripts/system-package-cli.ts";
import { deriveCharacterDataJsonSchema } from "../../apps/player/src/sheet-runtime/domain/characterDataJsonSchema.ts";

describe("System Package CLI", () => {
  test("生成可由正式 Contract 与 Player Runtime 共同读取的最小骨架", async () => {
    const files = await buildSystemPackageScaffold("测试规则系统");
    const report = await validateSystemPackageVfs(createVirtualFileSystem(files));

    expect(report).toEqual({ ok: true, packageName: "测试规则系统", issues: [] });
    expect(files.has("resources/starter.pbres")).toBe(true);
    expect(new TextDecoder().decode(files.get("README.md"))).toContain("外部编辑");
    const firstDocument = JSON.parse(new TextDecoder().decode(files.get("system.json"))) as { package: { id: string } };
    const secondDocument = JSON.parse(new TextDecoder().decode(
      (await buildSystemPackageScaffold("另一个规则系统")).get("system.json"),
    )) as { package: { id: string } };
    expect(firstDocument.package.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(secondDocument.package.id).not.toBe(firstDocument.package.id);
  });

  test("目录与 .pbsys 使用同一验证结果", async () => {
    const files = await buildSystemPackageScaffold();
    const directoryReport = await validateSystemPackageVfs(createVirtualFileSystem(files));
    const zipped = createVirtualFileSystemFromZipBytes(zipSync(Object.fromEntries(files)));
    expect(zipped.ok).toBe(true);
    if (!zipped.ok) return;

    await expect(validateSystemPackageVfs(zipped.vfs)).resolves.toEqual(directoryReport);
  });

  test("无效文件返回可定位诊断且不进入 Runtime", async () => {
    const files = await buildSystemPackageScaffold();
    files.set("modules.json", new TextEncoder().encode("[{}]"));
    const report = await validateSystemPackageVfs(createVirtualFileSystem(files));

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: expect.any(String), path: expect.any(String) }),
    ]));
  });

  test("从有状态 Modules 推导只读 Character Data JSON Schema", () => {
    const schema = deriveCharacterDataJsonSchema({ modules: [
      { ID: "name", 类型: "freeText", 标签: "姓名" },
      { ID: "notes", 类型: "longText", 标签: "备注" },
      { ID: "derived", 类型: "readOnlyDisplay", 标签: "派生", 内容: "固定" },
      { ID: "stress", 类型: "countableResource", 标签: "压力", 最大值: 6 },
      { ID: "flags", 类型: "checkboxResource", 标签: "标记", 选项: [{ ID: "ready", 标签: "就绪" }] },
      { ID: "portrait", 类型: "imageField", 标签: "头像" },
      { ID: "cards", 类型: "cardTable", 标签: "卡牌", 资源来源: [] },
    ] as never[] }) as { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean };

    expect(schema.required).toEqual(["name", "notes", "stress", "flags", "portrait", "cards"]);
    expect(schema.properties).not.toHaveProperty("derived");
    expect(schema.additionalProperties).toBe(false);
  });
});
