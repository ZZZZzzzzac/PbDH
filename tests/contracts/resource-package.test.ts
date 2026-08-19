import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import { describe, expect, test } from "vitest";

import {
  computeResourcePackageSnapshotDigest,
  ContractRuntime,
  type ContractCatalog,
  type ContractDiagnostic,
  type ResourcePackageLogicalDocument,
  type ResourcePackageMedia,
  validateResourcePackageSemantics,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();
const fixtureRoot = "contracts/conformance/resource-package/1.0.0-alpha.1";
const schemaPath = "resource-package/1.0.0-alpha.1/schema.json";

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

type MediaFixture = { assetId: string; path: string };
type Mutation =
  | { kind: "none" }
  | { kind: "duplicate-resource"; sourceIndex: number }
  | { kind: "add-root-property"; property: string; value: string }
  | { kind: "set-target-version"; targetIndex: number; value: string };
type ConformanceCase = {
  name: string;
  document: string;
  media: MediaFixture[];
  mutation: Mutation;
  expected: ContractDiagnostic[];
};
type DigestCase = {
  name: string;
  document: string;
  media: MediaFixture[];
  targets: ResourcePackageLogicalDocument["targets"] | null;
  expected: string;
};

const catalog = readJson<ContractCatalog>("contracts/catalog.json");
const schemas = Object.fromEntries(
  catalog.families.flatMap((family) =>
    family.versions.map((version) => [
      version.schema,
      readJson<AnySchema>(`contracts/${version.schema}`),
    ]),
  ),
);
const runtime = new ContractRuntime(catalog, schemas);

function loadMedia(fixtures: MediaFixture[]): ResourcePackageMedia {
  return new Map(
    fixtures.map((fixture) => [
      fixture.assetId,
      new Uint8Array(readFileSync(path.join(root, fixtureRoot, fixture.path))),
    ]),
  );
}

function applyMutation(
  document: ResourcePackageLogicalDocument,
  mutation: Mutation,
): ResourcePackageLogicalDocument {
  const candidate = structuredClone(document);
  switch (mutation.kind) {
    case "none":
      break;
    case "duplicate-resource":
      candidate.resources.push(structuredClone(candidate.resources[mutation.sourceIndex]!));
      break;
    case "add-root-property":
      (candidate as unknown as Record<string, unknown>)[mutation.property] = mutation.value;
      break;
    case "set-target-version":
      candidate.targets[mutation.targetIndex]!.version = mutation.value;
      break;
  }
  return candidate;
}

describe("Resource Package 1.0.0-alpha.1 conformance", () => {
  const cases = readJson<ConformanceCase[]>(`${fixtureRoot}/cases.json`);

  for (const conformanceCase of cases) {
    test(conformanceCase.name, async () => {
      const source = readJson<ResourcePackageLogicalDocument>(
        `${fixtureRoot}/${conformanceCase.document}`,
      );
      const candidate = applyMutation(source, conformanceCase.mutation);
      const schemaDiagnostics = runtime.validate({
        family: "resource-package",
        version: "1.0.0-alpha.1",
        mode: "development",
        candidate,
      });
      const diagnostics = schemaDiagnostics.length
        ? schemaDiagnostics
        : await validateResourcePackageSemantics(candidate, loadMedia(conformanceCase.media));
      expect(diagnostics).toEqual(conformanceCase.expected);
    });
  }
});

describe("Resource Package Snapshot Digest", () => {
  const cases = readJson<DigestCase[]>(`${fixtureRoot}/digest-cases.json`);

  for (const digestCase of cases) {
    test(digestCase.name, async () => {
      const document = readJson<ResourcePackageLogicalDocument>(
        `${fixtureRoot}/${digestCase.document}`,
      );
      if (digestCase.targets) document.targets = structuredClone(digestCase.targets);
      const media = loadMedia(digestCase.media);
      expect(await computeResourcePackageSnapshotDigest(document, media)).toBe(
        digestCase.expected,
      );

      document.targets.reverse();
      expect(await computeResourcePackageSnapshotDigest(document, media)).toBe(
        digestCase.expected,
      );
    });
  }
});
