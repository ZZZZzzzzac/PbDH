import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import { describe, expect, test } from "vitest";

import {
  ContractRuntime,
  loadPbcha,
  validateCharacterSaveSemantics,
  writePbcha,
  type CharacterSaveDocument,
  type CharacterSaveMedia,
  type ContractCatalog,
  type ContractDiagnostic,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();
const fixtureRoot = "contracts/conformance/character-save/1.0.0-alpha.1";

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
const fixture = readJson<CharacterSaveDocument>(`${fixtureRoot}/valid/weapon-and-tabletop.json`);

type Mutation =
  | null
  | { op: "delete"; path: Array<string | number> }
  | { op: "set"; path: Array<string | number>; value: unknown };

function mutate(source: CharacterSaveDocument, mutation: Mutation): CharacterSaveDocument {
  const result = structuredClone(source) as unknown as Record<string | number, unknown>;
  if (!mutation) return result as unknown as CharacterSaveDocument;
  let parent = result;
  for (const segment of mutation.path.slice(0, -1)) {
    parent = parent[segment] as Record<string | number, unknown>;
  }
  const key = mutation.path.at(-1)!;
  if (mutation.op === "delete") delete parent[key];
  else parent[key] = mutation.value;
  return result as unknown as CharacterSaveDocument;
}

async function validate(document: CharacterSaveDocument, media: CharacterSaveMedia = new Map()) {
  const diagnostics = runtime.validate({
    family: "character-save",
    version: "1.0.0-alpha.1",
    mode: "development",
    candidate: document,
  });
  return diagnostics.length > 0
    ? diagnostics
    : validateCharacterSaveSemantics(document, media);
}

describe("Character Save 1.0.0-alpha.1 conformance", () => {
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

  test("rejects duplicate player tabletop instance IDs", async () => {
    const duplicate = structuredClone(fixture);
    duplicate.characterData.tabletop.instances.push(
      structuredClone(duplicate.characterData.tabletop.instances[0]!),
    );
    expect(await validate(duplicate)).toContainEqual({
      code: "character-save.tabletop.instance-id.duplicate",
      severity: "error",
      family: "character-save",
      version: "1.0.0-alpha.1",
      location: "/characterData/tabletop/instances/1/instanceId",
      params: { instanceId: "01989f4e-7b2c-7000-8000-000000000045" },
    });
  });

  test("round-trips one Character Save through .pbcha", async () => {
    const bytes = writePbcha(fixture, new Map(), { exportTime: new Date("2026-08-26T00:00:00Z") });
    const result = await loadPbcha(bytes, validate);
    expect(result.diagnostics).toEqual([]);
    expect(result.candidate?.document).toEqual(fixture);
    expect(result.candidate?.media.size).toBe(0);
  });

  test("rejects a bad .pbcha without producing a candidate", async () => {
    const result = await loadPbcha(new Uint8Array([1, 2, 3]), validate);
    expect(result.candidate).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("character-save.archive.zip.invalid");
  });
});
