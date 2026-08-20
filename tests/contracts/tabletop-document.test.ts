import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import { describe, expect, test } from "vitest";

import {
  ContractRuntime,
  loadPbtab,
  validateTabletopDocumentSemantics,
  writePbtab,
  type ContractCatalog,
  type ContractDiagnostic,
  type TabletopDocument,
  type TabletopMedia,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();
const fixtureRoot = "contracts/conformance/tabletop-document/1.0.0-alpha.1";

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

const catalog = readJson<ContractCatalog>("contracts/catalog.json");
const schemas = Object.fromEntries(catalog.families.flatMap((family) =>
  family.versions.map((version) => [
    version.schema,
    readJson<AnySchema>(`contracts/${version.schema}`),
  ])));
const runtime = new ContractRuntime(catalog, schemas);
const fixture = readJson<TabletopDocument>(`${fixtureRoot}/valid/basic.json`);

type Mutation =
  | null
  | { op: "delete"; path: Array<string | number> }
  | { op: "set"; path: Array<string | number>; value: unknown };

function mutate(source: TabletopDocument, mutation: Mutation): TabletopDocument {
  const result = structuredClone(source) as unknown as Record<string | number, unknown>;
  if (!mutation) return result as unknown as TabletopDocument;
  let parent = result;
  for (const segment of mutation.path.slice(0, -1)) {
    parent = parent[segment] as Record<string | number, unknown>;
  }
  const key = mutation.path.at(-1)!;
  if (mutation.op === "delete") delete parent[key];
  else parent[key] = mutation.value;
  return result as unknown as TabletopDocument;
}

async function validate(document: TabletopDocument, media: TabletopMedia = new Map()) {
  const diagnostics = runtime.validate({
    family: "tabletop-document",
    version: "1.0.0-alpha.1",
    mode: "development",
    candidate: document,
  });
  return diagnostics.length > 0
    ? diagnostics
    : validateTabletopDocumentSemantics(document, media);
}

describe("Tabletop Document 1.0.0-alpha.1 conformance", () => {
  const cases = readJson<Array<{
    name: string;
    mutation: Mutation;
    expected: ContractDiagnostic[];
  }>>(`${fixtureRoot}/cases.json`);

  for (const conformanceCase of cases) {
    test(conformanceCase.name, async () => {
      expect(await validate(mutate(fixture, conformanceCase.mutation)))
        .toEqual(conformanceCase.expected);
    });
  }

  test("round-trips one tabletop through .pbtab", async () => {
    const bytes = writePbtab(fixture, new Map(), { exportTime: new Date("2026-08-20T00:00:00Z") });
    const result = await loadPbtab(bytes, validate);
    expect(result.diagnostics).toEqual([]);
    expect(result.candidate?.document).toEqual(fixture);
    expect(result.candidate?.media.size).toBe(0);
  });

  test("rejects a bad .pbtab without producing a candidate", async () => {
    const result = await loadPbtab(new Uint8Array([1, 2, 3]), validate);
    expect(result.candidate).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("tabletop-document.archive.zip.invalid");
  });
});
