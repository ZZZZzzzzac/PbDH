import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import { describe, expect, test } from "vitest";

import {
  ContractRuntime,
  loadPbcha,
  validateCharacterSaveSemantics,
  writePbcha,
  type AnyCharacterSaveDocument,
  type CharacterSaveAlpha1Document,
  type CharacterSaveDocument,
  type CharacterSaveMedia,
  type ContractCatalog,
  type ContractDiagnostic,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();
const fixtureRoot = "contracts/conformance/character-save/1.0.0";

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
const fixture = readJson<CharacterSaveDocument>(`${fixtureRoot}/valid/module-state.json`);

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

async function validate(document: AnyCharacterSaveDocument, media: CharacterSaveMedia = new Map()) {
  const diagnostics = runtime.validate({
    family: "character-save",
    version: document.contractVersion,
    mode: "development",
    candidate: document,
  });
  return diagnostics.length > 0
    ? diagnostics
    : validateCharacterSaveSemantics(document, media);
}

describe("Character Save 1.0.0 conformance", () => {
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

  test("round-trips one Character Save through .pbcha", async () => {
    const bytes = writePbcha(fixture, new Map(), { exportTime: new Date("2026-08-26T00:00:00Z") });
    const result = await loadPbcha(bytes, validate);
    expect(result.diagnostics).toEqual([]);
    expect(result.candidate?.document).toEqual(fixture);
    expect(result.candidate?.media.size).toBe(0);
  });

  test(".pbcha only carries media referenced by imageField module state", async () => {
    const playerBytes = new Uint8Array([1, 2, 3, 4]);
    const digest = await crypto.subtle.digest("SHA-256", playerBytes);
    const playerAssetId = `sha256:${Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, "0")).join("")}`;
    const document: CharacterSaveDocument = {
      ...structuredClone(fixture),
      characterData: { ...structuredClone(fixture.characterData), "character-avatar": { assetId: playerAssetId } },
    };
    const bytes = writePbcha(document, new Map([
      [playerAssetId, playerBytes],
      [`sha256:${"f".repeat(64)}`, new Uint8Array([9])],
    ]));

    const result = await loadPbcha(bytes, validate);

    expect(result.diagnostics).toEqual([]);
    expect([...result.candidate!.media.keys()]).toEqual([playerAssetId]);
  });

  test("rejects a bad .pbcha without producing a candidate", async () => {
    const result = await loadPbcha(new Uint8Array([1, 2, 3]), validate);
    expect(result.candidate).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("character-save.archive.zip.invalid");
  });

  test("reads and deterministically converts the development alpha shape", async () => {
    const alpha = readJson<CharacterSaveAlpha1Document>(
      "contracts/conformance/character-save/1.0.0-alpha.1/valid/weapon-and-tabletop.json",
    );
    alpha.characterData.tabletop.instances[0]!.state = {
      ...alpha.characterData.tabletop.instances[0]!.state,
      tableModuleId: "character-card-table",
      sheetState: "配置",
      indicators: "[]",
    };
    const bytes = writePbcha(alpha as unknown as CharacterSaveDocument, new Map());
    const result = await loadPbcha(bytes, validate);
    expect(result.diagnostics).toEqual([]);
    expect(result.candidate?.document).toMatchObject({
      contractVersion: "1.0.0",
      characterDataVersion: "1.0.0",
      characterData: {
        "primary-weapon-name": "**长弓**｜敏捷｜远距离｜d8+2 物理｜双手",
        "character-card-table": { instances: [expect.objectContaining({
          instanceId: "01989f4e-7b2c-7000-8000-000000000045",
          state: expect.objectContaining({ value: "配置", indicators: "[]" }),
        })] },
      },
    });
  });
});
