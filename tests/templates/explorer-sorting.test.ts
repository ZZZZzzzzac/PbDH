import { build } from "esbuild";
import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { supportedTemplates } from "@pbdh/templates/core";
import { getTemplateSortingFields } from "@pbdh/templates/core/explorer-sorting";
import { describe, expect, test } from "vitest";

describe("Template explorer sorting metadata", () => {
  test("covers exact supported versions with real, unique data fields", () => {
    for (const core of supportedTemplates) {
      const fields = getTemplateSortingFields(core.id, core.version);
      expect(fields[0]).toEqual({ key: "名称", label: "名称", kind: "text" });
      expect(new Set(fields.map((field) => field.key)).size).toBe(fields.length);
      for (const field of fields) expect(Object.hasOwn(core.defaultData, field.key)).toBe(true);
      expect(Object.isFrozen(fields)).toBe(true);
      expect(fields.every(Object.isFrozen)).toBe(true);
      expect(core).not.toHaveProperty("sortingFields");
    }
  });

  test("does not infer support for unknown templates or versions", () => {
    for (const [id, version] of [["未知", "1.0.0"], ["敌人", "1.0.6"], ["领域卡", "1.0.2"], ["领域卡", "2.0.0"]]) {
      expect(getTemplateSortingFields(id, version)).toEqual([]);
    }
  });

  test("all versions of a template share declarations, and fields and enum values match schema", () => {
    for (const core of supportedTemplates) {
      const fields = getTemplateSortingFields(core.id, core.version);
      expect(fields).toBe(getTemplateSortingFields(core.id, "1.0.0"));
      const properties = core.schema.properties as Record<string, unknown>;
      const validate = new Ajv2020({ allErrors: true, strict: true }).compile(core.schema as AnySchema);
      for (const field of fields) {
        expect(Object.hasOwn(properties, field.key), `${core.id}@${core.version}: ${field.key}`).toBe(true);
        if (field.kind !== "enum") continue;
        expect(field.values?.length).toBeGreaterThan(0);
        expect(new Set(field.values).size).toBe(field.values!.length);
        for (const value of field.values!) {
          expect(validate({ ...core.defaultData, [field.key]: value }), JSON.stringify(validate.errors)).toBe(true);
        }
      }
    }
  });

  test("declares numeric levels and actual adversary fields in priority order", () => {
    expect(getTemplateSortingFields("领域卡", "1.1.0")).toEqual([
      { key: "名称", label: "名称", kind: "text" },
      { key: "领域", label: "领域", kind: "text" },
      { key: "等级", label: "等级", kind: "number" },
      { key: "回想", label: "回想", kind: "number" },
    ]);
    expect(getTemplateSortingFields("敌人", "1.1.0")).toEqual([
      { key: "名称", label: "名称", kind: "text" },
      { key: "种类", label: "种类", kind: "text" },
      { key: "位阶", label: "位阶", kind: "number" },
    ]);
    expect(getTemplateSortingFields("环境", "1.1.0")).toEqual([
      { key: "名称", label: "名称", kind: "text" },
      { key: "位阶", label: "位阶", kind: "number" },
      { key: "种类", label: "种类", kind: "text" },
    ]);
  });

  test("the lightweight subpath does not bundle template implementations", async () => {
    const result = await build({
      stdin: { contents: 'export * from "@pbdh/templates/core/explorer-sorting";', resolveDir: process.cwd() },
      bundle: true, write: false, metafile: true, platform: "browser", format: "esm",
    });
    expect(Object.keys(result.metafile!.inputs).filter((input) => input !== "<stdin>").sort()).toEqual([
      "packages/templates/src/core/explorer-sorting.ts",
      "packages/templates/src/core/types.ts",
    ]);
  });
});
