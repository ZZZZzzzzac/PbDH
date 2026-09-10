import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { rinkcxAdapter } from "@pbdh/resource-conversion";
import { materializeCreatorResourceConversion } from "../../apps/creator/src/workspace-prototype/materialize-resource-conversion.ts";
import { validateResourcePackageCandidate } from "../../apps/creator/src/workspace-prototype/resource-package-validator.ts";
import { materializePlayerResourceConversion } from "../../apps/player/src/resources/materialize-resource-conversion.ts";
import systemJson from "../../apps/player/src/daggerheart-core-system.generated.json";
import type { SystemPackageDocument } from "@pbdh/contract-runtime";

const enemy = strToU8(JSON.stringify({ name: "守卫", health: "3", threshold: "5/10", rank: "1", type: "标准" }));
const scene = strToU8(JSON.stringify({ name: "风暴", rank: "1", type: "事件" }));

describe("Rink ZIP import", () => {
  it("preserves nested filenames and independent resources with the same name, ignoring images", async () => {
    const imported = await rinkcxAdapter.import({
      bytes: zipSync({ "包/敌人/守卫.json": enemy, "包/另一组/守卫.json": enemy, "风暴.JSON": scene, "图片.png": strToU8("not an image") }),
      fileName: "资源.zip",
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    expect(imported.report.diagnostics).toEqual([]);
    expect(imported.batch.media.size).toBe(0);
    expect(new Set(imported.batch.resources.map((resource) => resource.sourceId)).size).toBe(3);
    const converted = await materializeCreatorResourceConversion(imported.batch);
    expect(converted.diagnostics).toEqual([]);
    expect(converted.candidate?.document.resources.map((resource) => resource.path)).toEqual([
      "包/敌人/守卫.json", "包/另一组/守卫.json", "风暴.JSON",
    ]);
    if (!converted.candidate) throw new Error("materialization failed");
    expect(await validateResourcePackageCandidate(converted.candidate.document, converted.candidate.media)).toEqual([]);
    const player = await materializePlayerResourceConversion(imported.batch, systemJson as SystemPackageDocument);
    expect(player.candidate?.document.resources.map((resource) => resource.path)).toEqual(
      converted.candidate.document.resources.map((resource) => resource.path),
    );
  });

  it("decodes legacy GBK filenames without changing UTF-8 filenames", async () => {
    const bytes = zipSync({ "xx.json": enemy, "é.json": scene });
    const view = new DataView(bytes.buffer);
    // 将等长占位文件名改成 GBK 的“卡”，同时清除该成员的 UTF-8 标记。
    for (let offset = 0; offset <= bytes.length - 30; offset += 1) {
      const signature = view.getUint32(offset, true);
      const central = signature === 0x02014b50;
      if (!central && signature !== 0x04034b50) continue;
      const start = offset + (central ? 46 : 30);
      if (bytes[start] !== 0x78 || bytes[start + 1] !== 0x78) continue;
      const flags = offset + (central ? 8 : 6);
      view.setUint16(flags, view.getUint16(flags, true) & ~0x800, true);
      bytes[start] = 0xbf;
      bytes[start + 1] = 0xa8;
    }
    const result = await rinkcxAdapter.import({ bytes, fileName: "legacy.zip" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("import failed");
    expect(result.batch.resources.map((resource) => resource.source.path)).toEqual(["卡.json", "é.json"]);
  });

  it("reports bad JSON and multi-resource JSON members by filename while retaining valid resources", async () => {
    const result = await rinkcxAdapter.import({
      bytes: zipSync({ "valid.json": enemy, "broken.json": strToU8("{"), "array.json": strToU8("[]") }),
      fileName: "partial.zip",
    });
    expect(result.ok).toBe(true);
    expect(result.report.converted).toBe(1);
    expect(result.report.diagnostics.map((item) => item.path)).toEqual(["broken.json", "array.json"]);
  });

  it.each(["../enemy.json", "/enemy.json", "C:/enemy.json", "folder/../enemy.json", "CON.json"])("rejects unsafe path %s", async (path) => {
    const result = await rinkcxAdapter.import({ bytes: zipSync({ [path]: enemy }), fileName: "unsafe.zip" });
    expect(result.ok).toBe(false);
    expect(result.report.diagnostics[0]?.code).toBe("rinkcx.zip.invalid");
  });

  it("rejects case-insensitive collisions", async () => {
    const result = await rinkcxAdapter.import({ bytes: zipSync({ "a.json": enemy, "A.json": scene }), fileName: "duplicate.zip" });
    expect(result.ok).toBe(false);
  });

  it("rejects empty and corrupt archives", async () => {
    for (const bytes of [zipSync({ "card.png": enemy }), new Uint8Array([1, 2, 3])]) {
      expect((await rinkcxAdapter.import({ bytes, fileName: "empty.zip" })).ok).toBe(false);
    }
  });
});
