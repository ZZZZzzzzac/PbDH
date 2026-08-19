import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import { strToU8, zipSync, type Zippable, type ZipOptions } from "fflate";
import { describe, expect, test } from "vitest";

import {
  ContractRuntime,
  computeResourcePackageSnapshotDigest,
  loadPbres,
  loadResourcePackageDirectory,
  type ContractCatalog,
  type ContractDiagnostic,
  type PortableDirectoryEntry,
  type ResourcePackageCandidateValidator,
  type ResourcePackageLogicalDocument,
  validateResourcePackageSemantics,
  writePbres,
  writeResourcePackageDirectory,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();
const fixtureRoot = "contracts/conformance/resource-package/1.0.0-alpha.1";
const assetId = "sha256:0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034";
const assetPath = "media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp";

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

const document = readJson<ResourcePackageLogicalDocument>(
  `${fixtureRoot}/valid/minotaur-wrecker.json`,
);
const media = new Map([
  [assetId, new Uint8Array(readFileSync(path.join(root, fixtureRoot, assetPath)))],
]);
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
const validate: ResourcePackageCandidateValidator = async (candidate, candidateMedia) => {
  const schemaDiagnostics = runtime.validate({
    family: "resource-package",
    version: "1.0.0-alpha.1",
    mode: "development",
    candidate,
  });
  return schemaDiagnostics.length
    ? schemaDiagnostics
    : validateResourcePackageSemantics(candidate, candidateMedia);
};

type ArchiveCase = {
  name: string;
  mutation: Record<string, string>;
  candidate: boolean;
  expected: ContractDiagnostic[];
};

function mutateEntries(
  source: PortableDirectoryEntry[],
  mutation: Record<string, string>,
): PortableDirectoryEntry[] {
  const entries = structuredClone(source);
  const emptyJson = new TextEncoder().encode("{}");
  switch (mutation.kind) {
    case "add-file":
      entries.push({ path: mutation.path!, kind: "file", bytes: emptyJson });
      break;
    case "add-directory":
      entries.push({ path: mutation.path!, kind: "directory" });
      break;
    case "add-special":
      entries.push({
        path: mutation.path!,
        kind: mutation.entryKind as PortableDirectoryEntry["kind"],
      });
      break;
    case "add-collision":
      entries.push({ path: mutation.first!, kind: "file", bytes: emptyJson });
      entries.push({ path: mutation.second!, kind: "file", bytes: emptyJson });
      break;
    case "duplicate-path": {
      const entry = entries.find((item) => item.path === mutation.path);
      if (!entry) throw new Error(`Missing fixture entry: ${mutation.path}`);
      entries.push(structuredClone(entry));
      break;
    }
    case "remove-path":
      return entries.filter((entry) => entry.path !== mutation.path);
    case "tamper-path": {
      const entry = entries.find((item) => item.path === mutation.path);
      if (!entry?.bytes) throw new Error(`Missing fixture bytes: ${mutation.path}`);
      entry.bytes[0] = entry.bytes[0]! ^ 0xff;
      break;
    }
    default:
      throw new Error(`Unknown archive fixture mutation: ${mutation.kind}`);
  }
  return entries;
}

describe("Resource Package Directory Profile", () => {
  test("round-trips one resource and one unique Asset ID", async () => {
    const entries = writeResourcePackageDirectory(document, media);
    expect(entries.filter((entry) => entry.path.startsWith("assets/"))).toHaveLength(1);
    const result = await loadResourcePackageDirectory(entries, validate);
    expect(result.diagnostics).toEqual([]);
    expect(result.candidate?.document).toEqual(document);
    expect(result.candidate?.media.get(assetId)).toEqual(media.get(assetId));
  });

  test("round-trips the declared empty-directory set", async () => {
    const withEmptyDirectory = structuredClone(document);
    withEmptyDirectory.emptyDirectories = ["敌人/待整理"];
    withEmptyDirectory.snapshotDigest = await computeResourcePackageSnapshotDigest(
      withEmptyDirectory,
      media,
    );
    const entries = writeResourcePackageDirectory(withEmptyDirectory, media);
    expect(entries).toContainEqual({ path: "敌人/待整理/", kind: "directory" });
    const result = await loadResourcePackageDirectory(entries, validate);
    expect(result.diagnostics).toEqual([]);
    expect(result.candidate?.document).toEqual(withEmptyDirectory);
  });

  const cases = readJson<ArchiveCase[]>(`${fixtureRoot}/archive-cases.json`);
  for (const archiveCase of cases) {
    test(archiveCase.name, async () => {
      const entries = mutateEntries(
        writeResourcePackageDirectory(document, media),
        archiveCase.mutation,
      );
      const result = await loadResourcePackageDirectory(entries, validate);
      expect(Boolean(result.candidate)).toBe(archiveCase.candidate);
      expect(result.diagnostics).toEqual(archiveCase.expected);
    });
  }
});

describe("Resource Package .pbres ZIP Profile", () => {
  test("mechanical ZIP differences preserve the logical Snapshot Digest", async () => {
    const stored = writePbres(document, media, {
      compressionLevel: 0,
      exportTime: new Date("2001-01-01T00:00:00Z"),
    });
    const compressed = writePbres(document, media, {
      compressionLevel: 9,
      exportTime: new Date("2026-08-18T12:00:00Z"),
    });
    expect(stored).not.toEqual(compressed);

    for (const archive of [stored, compressed]) {
      const result = await loadPbres(archive, validate);
      expect(result.diagnostics).toEqual([]);
      expect(result.candidate?.document).toEqual(document);
      expect(result.candidate?.document.snapshotDigest).toBe(document.snapshotDigest);
    }

    const reversedFiles: Record<string, [Uint8Array, ZipOptions]> = {};
    for (const entry of writeResourcePackageDirectory(document, media).reverse()) {
      reversedFiles[entry.path] = [
        entry.bytes ?? new Uint8Array(),
        {
          level: 6,
          mtime: new Date("2010-01-01T00:00:00Z"),
          os: 3,
          attrs: (entry.kind === "directory" ? 0o40755 : 0o100644) * 65536,
        },
      ];
    }
    const reordered = zipSync(reversedFiles as Zippable);
    const reorderedResult = await loadPbres(reordered, validate);
    expect(reorderedResult.diagnostics).toEqual([]);
    expect(reorderedResult.candidate?.document.snapshotDigest).toBe(document.snapshotDigest);
  });

  test("rejects ZIP traversal, links, and excessive compression ratio", async () => {
    const cases: Array<[Uint8Array, string]> = [
      [
        zipSync({ "../evil.json": strToU8("{}") }),
        "resource-package.archive.path.invalid",
      ],
      [
        zipSync({
          "link.webp": [
            strToU8("outside"),
            { os: 3, attrs: 0o120777 * 65536 },
          ],
        }),
        "resource-package.archive.entry.special",
      ],
      [
        zipSync({ "bomb.bin": new Uint8Array(256 * 1024) }, { level: 9 }),
        "resource-package.archive.compression-ratio-exceeded",
      ],
    ];
    for (const [archive, code] of cases) {
      const result = await loadPbres(archive, validate);
      expect(result.candidate).toBeNull();
      expect(result.diagnostics.map((item) => item.code)).toContain(code);
    }
  });

  test("invalid ZIP yields zero candidate", async () => {
    const result = await loadPbres(new Uint8Array([0x50, 0x4b]), validate);
    expect(result.candidate).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "resource-package.archive.zip.invalid",
        severity: "error",
        family: "resource-package",
        version: "1.0.0-alpha.1",
        location: "",
        params: {},
      },
    ]);
  });
});
