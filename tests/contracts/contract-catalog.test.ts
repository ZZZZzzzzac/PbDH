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
const schemas = Object.fromEntries(catalog.families.flatMap((family) =>
  family.versions.map((version) => [
    version.schema,
    readJson(`contracts/${version.schema}`) as AnySchema,
  ])));

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
      "Duplicate Contract version: resource-package@1.0.0",
    );
  });

  test("queries exact version state", () => {
    const runtime = new ContractRuntime(catalog, schemas);
    expect(runtime.getVersionState("resource-package", "0.9.0")).toBeUndefined();
    expect(runtime.getVersionState("resource-package", "1.0.0")).toBe("published");
    expect(runtime.getVersionState("resource-package", "1.1.0")).toBe("published");
  });

  test("accepts the reviewed Resource Package in production mode", () => {
    const runtime = new ContractRuntime(catalog, schemas);
    expect(runtime.validate({
      family: "resource-package",
      version: "1.0.0",
      mode: "production",
      candidate: readJson("contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json"),
    })).toEqual([]);
  });

  test("accepts Resource Package 1.1.0 in production mode", () => {
    const runtime = new ContractRuntime(catalog, schemas);
    expect(runtime.validate({
      family: "resource-package",
      version: "1.1.0",
      mode: "production",
      candidate: readJson("contracts/conformance/resource-package/1.1.0/valid/minimal.json"),
    })).toEqual([]);
  });

  test("tracks Backend API lifecycle without treating OpenAPI as JSON Schema", () => {
    const runtime = new ContractRuntime(catalog, schemas);
    expect(runtime.getVersionState("backend-api", "1.0.0")).toBe("published");
    expect(runtime.validate({
      family: "backend-api",
      version: "1.0.0",
      mode: "production",
      candidate: {},
    })).toEqual([{
      code: "contract.validation.not-applicable",
      severity: "error",
      family: "backend-api",
      version: "1.0.0",
      location: "",
      params: {},
    }]);
  });
});

describe("stable Contract Diagnostic conformance", () => {
  const runtime = new ContractRuntime(catalog, schemas);
  const cases = [
    ...readJson("contracts/conformance/contract-catalog/cases.json") as ConformanceCase[],
    ...readJson("contracts/conformance/resource-package/1.1.0/cases.json") as ConformanceCase[],
    ...readJson("contracts/conformance/system-package/1.0.0/cases.json") as ConformanceCase[],
  ];

  for (const conformanceCase of cases) {
    test(conformanceCase.name, () => {
      expect(runtime.validate(conformanceCase.request)).toEqual(conformanceCase.expected);
    });
  }
});
