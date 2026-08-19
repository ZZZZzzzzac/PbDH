import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import { describe, expect, test } from "vitest";

import {
  ContractRuntime,
  loadPbsys,
  loadSystemPackageDirectory,
  planEmbeddedResourceAdmission,
  type ContractCatalog,
  type ContractDiagnostic,
  type PortableDirectoryEntry,
  type ResourcePackageLogicalDocument,
  type SystemPackageDocument,
  validateResourcePackageSemantics,
  validateSystemPackageSemantics,
  writePbsys,
  writeSystemPackageDirectory,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();
const fixtureRoot = "contracts/conformance/system-package/1.0.0-alpha.1";

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
const document = readJson<SystemPackageDocument>(`${fixtureRoot}/valid/daggerheart/system.json`);
const embeddedPath = document.embeddedResources[0]!.path;
const embeddedBytes = new Uint8Array(readFileSync(
  path.join(root, fixtureRoot, "valid/daggerheart", embeddedPath),
));

function validateSystem(candidate: SystemPackageDocument): ContractDiagnostic[] {
  const schemaDiagnostics = runtime.validate({
    family: "system-package",
    version: "1.0.0-alpha.1",
    mode: "development",
    candidate,
  });
  return schemaDiagnostics.length ? schemaDiagnostics : validateSystemPackageSemantics(candidate);
}

async function validateResource(
  candidate: ResourcePackageLogicalDocument,
  media: ReadonlyMap<string, Uint8Array>,
): Promise<ContractDiagnostic[]> {
  const schemaDiagnostics = runtime.validate({
    family: "resource-package",
    version: "1.0.0-alpha.1",
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
      bytes: new Uint8Array(readFileSync(
        path.join(root, fixtureRoot, "valid/daggerheart/system.json"),
      )),
    },
    { path: embeddedPath, kind: "file", bytes: embeddedBytes.slice() },
  ];
}

describe("System Package directory and .pbsys", () => {
  test("produce the same normalized offline candidate", async () => {
    const directory = await loadSystemPackageDirectory(fixtureDirectoryEntries(), options);
    const archive = await loadPbsys(
      new Uint8Array(readFileSync(path.join(root, fixtureRoot, "daggerheart.pbsys"))),
      options,
    );
    expect(directory.diagnostics).toEqual([]);
    expect(archive.diagnostics).toEqual([]);
    expect(directory.candidate?.document).toEqual(document);
    expect(archive.candidate?.document).toEqual(document);
    const directoryEmbedded = directory.candidate?.embeddedResources.get(embeddedPath)?.document;
    const archiveEmbedded = archive.candidate?.embeddedResources.get(embeddedPath)?.document;
    expect(directoryEmbedded).toEqual(archiveEmbedded);
    expect(directoryEmbedded?.package.id).toBe(document.embeddedResources[0]!.packageId);
    expect(directoryEmbedded?.package.version).toBe(document.embeddedResources[0]!.version);
    expect(directoryEmbedded?.snapshotDigest).toBe(document.embeddedResources[0]!.snapshotDigest);
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

  test("nested corruption or declared identity mismatch yields zero candidate", async () => {
    const corrupt = fixtureDirectoryEntries();
    corrupt[1]!.bytes = new Uint8Array([0x50, 0x4b]);
    const corruptResult = await loadSystemPackageDirectory(corrupt, options);
    expect(corruptResult.candidate).toBeNull();
    expect(corruptResult.diagnostics.some((item) => item.code === "resource-package.archive.zip.invalid")).toBe(true);

    const mismatch = structuredClone(document);
    mismatch.embeddedResources[0]!.snapshotDigest = `sha256:${"0".repeat(64)}`;
    const mismatchEntries = writeSystemPackageDirectory(
      mismatch,
      new Map([[embeddedPath, embeddedBytes]]),
    );
    const mismatchResult = await loadSystemPackageDirectory(mismatchEntries, options);
    expect(mismatchResult.candidate).toBeNull();
    expect(mismatchResult.diagnostics).toContainEqual({
      code: "system-package.embedded-resource.identity-mismatch",
      severity: "error",
      family: "system-package",
      version: "1.0.0-alpha.1",
      location: "/embeddedResources/0/snapshotDigest",
      params: {
        actual: document.embeddedResources[0]!.snapshotDigest,
        expected: mismatch.embeddedResources[0]!.snapshotDigest,
      },
    });
  });

  test("rejects unknown files and duplicate declarations with zero candidate", async () => {
    const entries = fixtureDirectoryEntries();
    entries.push({ path: "notes.txt", kind: "file", bytes: new TextEncoder().encode("no") });
    const unknown = await loadSystemPackageDirectory(entries, options);
    expect(unknown.candidate).toBeNull();
    expect(unknown.diagnostics[0]?.code).toBe("system-package.archive.path.invalid");

    const duplicate = structuredClone(document);
    duplicate.resourceCompatibility.push(structuredClone(duplicate.resourceCompatibility[0]!));
    expect(validateSystemPackageSemantics(duplicate).map((item) => item.code)).toEqual([
      "system-package.resource-compatibility.duplicate",
      "system-package.native-entry.duplicate",
    ]);
  });
});

describe("embedded official Resource admission", () => {
  const embedded = document.embeddedResources[0]!;

  test("installs, no-ops, preserves newer local, prompts, and enforces baseline", () => {
    expect(planEmbeddedResourceAdmission({ embedded })).toEqual({ action: "install" });
    expect(planEmbeddedResourceAdmission({
      embedded,
      local: { version: embedded.version, snapshotDigest: embedded.snapshotDigest },
    })).toEqual({ action: "no-op" });
    expect(planEmbeddedResourceAdmission({
      embedded,
      local: { version: "2.0.0", snapshotDigest: "sha256:newer" },
    })).toEqual({ action: "keep-local" });

    const optional = { ...embedded, version: "1.1.0", minimumVersion: "1.0.0-alpha.1" };
    expect(planEmbeddedResourceAdmission({
      embedded: optional,
      local: { version: "1.0.0", snapshotDigest: "sha256:local" },
    })).toEqual({ action: "prompt-update" });
    expect(planEmbeddedResourceAdmission({
      embedded,
      local: { version: "0.9.0", snapshotDigest: "sha256:old" },
    })).toEqual({ action: "required-update" });
  });

  test("rejects same ID/version with different digest", () => {
    expect(planEmbeddedResourceAdmission({
      embedded,
      local: { version: embedded.version, snapshotDigest: `sha256:${"f".repeat(64)}` },
    })).toEqual({
      action: "reject",
      code: "system-package.embedded-resource.same-version-different-digest",
    });
  });
});
