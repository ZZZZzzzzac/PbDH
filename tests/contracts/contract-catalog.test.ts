import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  ContractRuntime,
  type ContractCatalog,
  type ContractDiagnostic,
  type ContractValidationRequest,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

const catalog = readJson("contracts/catalog.json") as ContractCatalog;
const resourcePackageSchemaPath = "resource-package/0.0.0-dev.1/schema.json";
const resourcePackageAlphaSchemaPath = "resource-package/1.0.0-alpha.1/schema.json";
const resourcePackageSchemaPathV1 = "resource-package/1.0.0/schema.json";
const systemPackageAlphaSchemaPath = "system-package/1.0.0-alpha.1/schema.json";
const tabletopDocumentAlphaSchemaPath = "tabletop-document/1.0.0-alpha.1/schema.json";
const schemas = {
  [resourcePackageSchemaPath]: readJson(`contracts/${resourcePackageSchemaPath}`) as AnySchema,
  [resourcePackageAlphaSchemaPath]: readJson(
    `contracts/${resourcePackageAlphaSchemaPath}`,
  ) as AnySchema,
  [resourcePackageSchemaPathV1]: readJson(
    `contracts/${resourcePackageSchemaPathV1}`,
  ) as AnySchema,
  [systemPackageAlphaSchemaPath]: readJson(
    `contracts/${systemPackageAlphaSchemaPath}`,
  ) as AnySchema,
  [tabletopDocumentAlphaSchemaPath]: readJson(
    `contracts/${tabletopDocumentAlphaSchemaPath}`,
  ) as AnySchema,
};

type ConformanceCase = {
  name: string;
  request: ContractValidationRequest;
  expected: ContractDiagnostic[];
};

describe("Contract Catalog", () => {
  test("matches its language-neutral schema and declares each family once", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validate = ajv.compile(readJson("contracts/catalog.schema.json") as AnySchema);
    expect(validate(catalog), JSON.stringify(validate.errors)).toBe(true);
    expect(catalog.families.map((family) => family.id)).toEqual([
      "resource-package",
      "system-package",
      "character-save",
      "tabletop-document",
      "backend-api",
    ]);
  });

  test("rejects duplicate exact versions", () => {
    const duplicateCatalog = structuredClone(catalog);
    duplicateCatalog.families[0]?.versions.push(
      structuredClone(duplicateCatalog.families[0].versions[0]!),
    );
    expect(() => new ContractRuntime(duplicateCatalog, schemas)).toThrow(
      "Duplicate Contract version: resource-package@0.0.0-dev.1",
    );
  });

  test("queries exact version state", () => {
    const runtime = new ContractRuntime(catalog, schemas);
    expect(runtime.getVersionState("resource-package", "0.0.0-dev.1")).toBe("development");
    expect(runtime.getVersionState("resource-package", "1.0.0")).toBe("development");
  });
});

describe("stable Contract Diagnostic conformance", () => {
  const runtime = new ContractRuntime(catalog, schemas);
  const cases = readJson(
    "contracts/conformance/contract-catalog/cases.json",
  ) as ConformanceCase[];

  for (const conformanceCase of cases) {
    test(conformanceCase.name, () => {
      expect(runtime.validate(conformanceCase.request)).toEqual(conformanceCase.expected);
    });
  }
});
