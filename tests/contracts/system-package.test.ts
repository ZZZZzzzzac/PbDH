import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import { describe, expect, test } from "vitest";

import {
  ContractRuntime,
  loadPbsys,
  loadSystemPackageDirectory,
  normalizeSystemPackageDocument,
  type ContractCatalog,
  type ContractDiagnostic,
  type PortableDirectoryEntry,
  type ResourcePackageLogicalDocument,
  type SystemPackageDocument,
  type SystemPackageSourceDocument,
  validateResourcePackageSemantics,
  validateSystemPackageSemantics,
  writePbsys,
  writeSystemPackageDirectory,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();
const resourceFixtureRoot = "contracts/conformance/resource-package/1.0.0";

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

const catalog = readJson<ContractCatalog>("contracts/catalog.json");
const schemas = Object.fromEntries(
  catalog.families.flatMap((family) => family.versions.map((version) => [
    version.schema,
    readJson<AnySchema>(`contracts/${version.schema}`),
  ])),
);
const runtime = new ContractRuntime(catalog, schemas);
const sourceDocument: SystemPackageSourceDocument = {
  contractVersion: "1.0.0",
  package: {
    id: "0198e155-04d2-7ccd-98f1-8a09a177dc2a",
    version: "1.0.0",
    name: "Daggerheart Test",
    description: "System Package archive fixture",
  },
  runtime: { pages: "pages.json", modules: "modules.json", characterDataVersion: "1.0.0" },
  resourceCompatibility: [{
    templateId: "武器",
    versionRange: { minimumInclusive: "1.0.0", maximumExclusive: "2.0.0" },
    nativeEntry: { id: "weapons", label: "武器" },
  }],
  embeddedResources: [{ path: "resources/daggerheart-core-primary-weapon.pbres" }],
};
const document = normalizeSystemPackageDocument(sourceDocument);
const embeddedDocument = readJson<ResourcePackageLogicalDocument>(
  `${resourceFixtureRoot}/valid/daggerheart-core-primary-weapon.json`,
);
const embeddedPath = document.embeddedResources[0]!.path;
const embeddedBytes = new Uint8Array(readFileSync(
  path.join(root, resourceFixtureRoot, "valid/daggerheart-core-primary-weapon.pbres"),
));

function validateSystem(candidate: SystemPackageSourceDocument): ContractDiagnostic[] {
  const schemaDiagnostics = runtime.validate({
    family: "system-package",
    version: candidate.contractVersion,
    mode: "development",
    candidate,
  });
  return schemaDiagnostics.length
    ? schemaDiagnostics
    : validateSystemPackageSemantics(normalizeSystemPackageDocument(candidate));
}

async function validateResource(
  candidate: ResourcePackageLogicalDocument,
  media: ReadonlyMap<string, Uint8Array>,
): Promise<ContractDiagnostic[]> {
  const schemaDiagnostics = runtime.validate({
    family: "resource-package",
    version: "1.0.0",
    mode: "development",
    candidate,
  });
  return schemaDiagnostics.length
    ? schemaDiagnostics
    : validateResourcePackageSemantics(candidate, media);
}

const options = { validateSystem, validateResource };

function fixtureDirectoryEntries(): PortableDirectoryEntry[] {
  return [
    {
      path: "system.json",
      kind: "file",
      bytes: new TextEncoder().encode(`${JSON.stringify(document, null, 2)}\n`),
    },
    ...["pages.json", "modules.json"].map((relativePath): PortableDirectoryEntry => ({
      path: relativePath,
      kind: "file",
      bytes: new TextEncoder().encode("[]"),
    })),
    { path: embeddedPath, kind: "file", bytes: embeddedBytes.slice() },
  ];
}

describe("System Package directory and .pbsys", () => {
  test("normalizes omitted resource collections to empty arrays", async () => {
    const minimal: SystemPackageSourceDocument = {
      contractVersion: "1.0.0",
      package: {
        id: "0198e155-04d2-7ccd-98f1-8a09a177dc2a",
        version: "1.0.0",
        name: "Minimal",
        description: "",
      },
      runtime: { pages: "pages.json", modules: "modules.json", characterDataVersion: "1.0.0" },
    };
    const entries: PortableDirectoryEntry[] = [
      { path: "system.json", kind: "file", bytes: new TextEncoder().encode(JSON.stringify(minimal)) },
      { path: "pages.json", kind: "file", bytes: new TextEncoder().encode("[]") },
      { path: "modules.json", kind: "file", bytes: new TextEncoder().encode("[]") },
    ];

    const result = await loadSystemPackageDirectory(entries, options);

    expect(result.diagnostics).toEqual([]);
    expect(result.candidate?.document.resourceCompatibility).toEqual([]);
    expect(result.candidate?.document.embeddedResources).toEqual([]);
  });

  test("produce the same normalized offline candidate", async () => {
    const directory = await loadSystemPackageDirectory(fixtureDirectoryEntries(), options);
    const archive = await loadPbsys(writePbsys(fixtureDirectoryEntries()), options);
    expect(directory.diagnostics).toEqual([]);
    expect(archive.diagnostics).toEqual([]);
    expect(directory.candidate?.document).toEqual(document);
    expect(archive.candidate?.document).toEqual(document);
    const directoryEmbedded = directory.candidate?.embeddedResources.get(embeddedPath)?.document;
    const archiveEmbedded = archive.candidate?.embeddedResources.get(embeddedPath)?.document;
    expect(directoryEmbedded).toEqual(archiveEmbedded);
    expect(directoryEmbedded?.package.id).toBe(embeddedDocument.package.id);
    expect(directoryEmbedded?.package.version).toBe(embeddedDocument.package.version);
    expect(directoryEmbedded?.snapshotDigest).toBe(embeddedDocument.snapshotDigest);
  });

  test("writer round-trips across ZIP mechanics", async () => {
    const entries = writeSystemPackageDirectory(
      document,
      new Map([[embeddedPath, embeddedBytes]]),
    );
    for (const archive of [
      writePbsys(entries, { compressionLevel: 0, exportTime: new Date("2001-01-01") }),
      writePbsys(entries, { compressionLevel: 9, exportTime: new Date("2026-08-18") }),
    ]) {
      const result = await loadPbsys(archive, options);
      expect(result.diagnostics).toEqual([]);
      expect(result.candidate?.document).toEqual(document);
    }
  });

  test("nested corruption yields zero candidate", async () => {
    const corrupt = fixtureDirectoryEntries();
    corrupt[3]!.bytes = new Uint8Array([0x50, 0x4b]);
    const corruptResult = await loadSystemPackageDirectory(corrupt, options);
    expect(corruptResult.candidate).toBeNull();
    expect(corruptResult.diagnostics.some((item) => item.code === "resource-package.archive.zip.invalid")).toBe(true);
  });

  test("distinguishes unknown files from invalid portable paths", async () => {
    const entries = fixtureDirectoryEntries();
    entries.push({ path: "notes.txt", kind: "file", bytes: new TextEncoder().encode("no") });
    const unknown = await loadSystemPackageDirectory(entries, options);
    expect(unknown.candidate).toBeNull();
    expect(unknown.diagnostics).toEqual([{
      code: "system-package.archive.file.unknown",
      severity: "error",
      family: "system-package",
      version: "1.0.0",
      location: "/notes.txt",
      params: { path: "notes.txt" },
    }]);

    const traversal = fixtureDirectoryEntries();
    traversal.push({ path: "../evil.json", kind: "file", bytes: new TextEncoder().encode("{}") });
    const invalid = await loadSystemPackageDirectory(traversal, options);
    expect(invalid.candidate).toBeNull();
    expect(invalid.diagnostics[0]?.code).toBe("system-package.archive.path.invalid");
  });

  test("rejects duplicate declarations with zero candidate", () => {
    const duplicate = structuredClone(document);
    duplicate.resourceCompatibility.push(structuredClone(duplicate.resourceCompatibility[0]!));
    expect(validateSystemPackageSemantics(duplicate).map((item) => item.code)).toEqual([
      "system-package.resource-compatibility.duplicate",
      "system-package.native-entry.duplicate",
    ]);
  });

  test("rejects empty or reversed Resource Compatibility ranges", () => {
    const empty = structuredClone(document);
    empty.resourceCompatibility[0]!.versionRange = {
      minimumInclusive: "1.0.0",
      maximumExclusive: "1.0.0",
    };
    expect(validateSystemPackageSemantics(empty)).toContainEqual({
      code: "system-package.resource-compatibility.range-empty",
      severity: "error",
      family: "system-package",
      version: "1.0.0",
      location: "/resourceCompatibility/0/versionRange",
      params: {},
    });

    const reversed = structuredClone(document);
    reversed.resourceCompatibility[0]!.versionRange = {
      minimumInclusive: "2.0.0",
      maximumExclusive: "1.0.0",
    };
    expect(validateSystemPackageSemantics(reversed).map((item) => item.code))
      .toContain("system-package.resource-compatibility.range-empty");
  });

  test("rejects invalid Runtime skin and validation declarations", () => {
    const invalid = structuredClone(document);
    invalid.runtime.skins = [
      { id: "ink", name: "纸墨", css: "ink.css", frameworkColorScheme: "light" },
      { id: "ink", name: "纸墨副本", css: "ink-copy.css", frameworkColorScheme: "light" },
    ];
    invalid.runtime.defaultSkin = "missing";
    invalid.runtime.validationChecks = [
      { id: "check", script: "check.js" },
      { id: "check", script: "check-copy.js" },
    ];

    expect(validateSystemPackageSemantics(invalid).map((item) => item.code)).toEqual([
      "system-package.runtime.default-skin.missing",
      "system-package.runtime.skin.duplicate",
      "system-package.runtime.validation-check.duplicate",
    ]);
  });

  test("accepts one complete Character Data migration chain and rejects broken chains", () => {
    const valid = structuredClone(document);
    valid.runtime.characterDataVersion = "2.0.0";
    valid.runtime.characterDataMigrations = [
      { fromVersion: "1.0.0", toVersion: "1.1.0", script: "migrations/1.0.0-1.1.0.js" },
      { fromVersion: "1.1.0", toVersion: "2.0.0", script: "migrations/1.1.0-2.0.0.js" },
    ];
    expect(validateSystemPackageSemantics(valid)).toEqual([]);

    const broken = structuredClone(valid);
    broken.runtime.characterDataMigrations = [
      ...valid.runtime.characterDataMigrations,
      { fromVersion: "1.0.0", toVersion: "0.9.0", script: "migrations/bad.js" },
    ];
    expect(validateSystemPackageSemantics(broken).map((item) => item.code)).toEqual(expect.arrayContaining([
      "system-package.runtime.character-data-migration.branch",
      "system-package.runtime.character-data-migration.not-forward",
    ]));
  });
});

