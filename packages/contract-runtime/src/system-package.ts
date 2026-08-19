import { strToU8, unzipSync, zipSync, type Zippable, type ZipOptions } from "fflate";

import type { ContractDiagnostic } from "./index.ts";
import {
  loadPbres,
  type PortableDirectoryEntry,
  type ResourcePackageCandidate,
  type ResourcePackageCandidateValidator,
} from "./portable-archive.ts";
import { compareSemVer } from "./semver.ts";

const FAMILY = "system-package";
const VERSION = "1.0.0-alpha.1";
const ROOT_PATH = "system.json";
const EMBEDDED_PATH = /^resources\/[a-z0-9][a-z0-9-]*\.pbres$/;

export type SystemPackageDocument = {
  contractVersion: typeof VERSION;
  package: {
    id: string;
    version: string;
    name: string;
    description: string;
  };
  resourceCompatibility: Array<{
    templateId: string;
    versionRange: {
      minimumInclusive: string;
      maximumExclusive: string;
    };
    nativeEntry: { id: string; label: string };
  }>;
  embeddedResources: Array<{
    path: string;
    packageId: string;
    version: string;
    minimumVersion: string;
    snapshotDigest: string;
  }>;
};

export type NormalizedSystemPackage = {
  document: SystemPackageDocument;
  embeddedResources: ReadonlyMap<string, ResourcePackageCandidate>;
};

export type SystemPackageLoadResult = {
  candidate: NormalizedSystemPackage | null;
  diagnostics: ContractDiagnostic[];
};

export type SystemPackageDocumentValidator = (
  document: SystemPackageDocument,
) => ContractDiagnostic[];

export type EmbeddedResourceAdmission =
  | { action: "install" }
  | { action: "no-op" }
  | { action: "keep-local" }
  | { action: "prompt-update" }
  | { action: "required-update" }
  | { action: "reject"; code: string };

function diagnostic(
  code: string,
  location: string,
  params: Record<string, unknown> = {},
): ContractDiagnostic {
  return { code, severity: "error", family: FAMILY, version: VERSION, location, params };
}

function sortDiagnostics(items: ContractDiagnostic[]): ContractDiagnostic[] {
  return items.sort((left, right) =>
    left.location.localeCompare(right.location) || left.code.localeCompare(right.code));
}

function encodeJson(value: unknown): Uint8Array {
  return strToU8(`${JSON.stringify(value, null, 2)}\n`);
}

function validPath(path: string): boolean {
  return path === ROOT_PATH || (
    EMBEDDED_PATH.test(path)
    && !path.includes("\\")
    && !path.split("/").some((part) => part === "." || part === ".." || part === "")
  );
}

export function validateSystemPackageSemantics(
  document: SystemPackageDocument,
): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const compatibilityKeys = new Set<string>();
  const nativeEntries = new Set<string>();
  const embeddedPaths = new Set<string>();
  const embeddedIds = new Set<string>();
  document.resourceCompatibility.forEach((compatibility, index) => {
    const key = `${compatibility.templateId}@${compatibility.versionRange.minimumInclusive}:${compatibility.versionRange.maximumExclusive}`;
    if (compatibilityKeys.has(key)) {
      diagnostics.push(diagnostic(
        "system-package.resource-compatibility.duplicate",
        `/resourceCompatibility/${index}`,
        { key },
      ));
    }
    compatibilityKeys.add(key);
    if (nativeEntries.has(compatibility.nativeEntry.id)) {
      diagnostics.push(diagnostic(
        "system-package.native-entry.duplicate",
        `/resourceCompatibility/${index}/nativeEntry/id`,
        { id: compatibility.nativeEntry.id },
      ));
    }
    nativeEntries.add(compatibility.nativeEntry.id);
    if (compareSemVer(
      compatibility.versionRange.minimumInclusive,
      compatibility.versionRange.maximumExclusive,
    ) >= 0) {
      diagnostics.push(diagnostic(
        "system-package.resource-compatibility.range-empty",
        `/resourceCompatibility/${index}/versionRange`,
      ));
    }
  });
  document.embeddedResources.forEach((embedded, index) => {
    if (embeddedPaths.has(embedded.path)) {
      diagnostics.push(diagnostic(
        "system-package.embedded-resource.path-duplicate",
        `/embeddedResources/${index}/path`,
        { path: embedded.path },
      ));
    }
    embeddedPaths.add(embedded.path);
    if (embeddedIds.has(embedded.packageId)) {
      diagnostics.push(diagnostic(
        "system-package.embedded-resource.package-id-duplicate",
        `/embeddedResources/${index}/packageId`,
        { packageId: embedded.packageId },
      ));
    }
    embeddedIds.add(embedded.packageId);
    if (compareSemVer(embedded.minimumVersion, embedded.version) > 0) {
      diagnostics.push(diagnostic(
        "system-package.embedded-resource.minimum-above-embedded",
        `/embeddedResources/${index}/minimumVersion`,
      ));
    }
  });
  return sortDiagnostics(diagnostics);
}

export function writeSystemPackageDirectory(
  document: SystemPackageDocument,
  embeddedArchives: ReadonlyMap<string, Uint8Array>,
): PortableDirectoryEntry[] {
  const entries: PortableDirectoryEntry[] = [
    { path: ROOT_PATH, kind: "file", bytes: encodeJson(document) },
  ];
  for (const embedded of document.embeddedResources) {
    const bytes = embeddedArchives.get(embedded.path);
    if (!bytes) throw new Error(`Missing embedded Resource Package: ${embedded.path}`);
    entries.push({ path: embedded.path, kind: "file", bytes });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export async function loadSystemPackageDirectory(
  entries: PortableDirectoryEntry[],
  options: {
    validateSystem: SystemPackageDocumentValidator;
    validateResource: ResourcePackageCandidateValidator;
  },
): Promise<SystemPackageLoadResult> {
  const diagnostics: ContractDiagnostic[] = [];
  const paths = new Set<string>();
  entries.forEach((entry, index) => {
    if (entry.kind !== "file") {
      diagnostics.push(diagnostic(
        "system-package.archive.entry.special",
        `/entries/${index}`,
        { kind: entry.kind, path: entry.path },
      ));
    }
    if (!validPath(entry.path)) {
      diagnostics.push(diagnostic(
        "system-package.archive.path.invalid",
        `/entries/${index}/path`,
        { path: entry.path },
      ));
    }
    if (paths.has(entry.path)) {
      diagnostics.push(diagnostic(
        "system-package.archive.entry.duplicate",
        `/entries/${index}/path`,
        { path: entry.path },
      ));
    }
    paths.add(entry.path);
  });
  if (diagnostics.length) return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };

  const root = entries.find((entry) => entry.path === ROOT_PATH);
  if (!root?.bytes) {
    return { candidate: null, diagnostics: [diagnostic("system-package.archive.root.missing", `/${ROOT_PATH}`)] };
  }
  let document: SystemPackageDocument;
  try {
    document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(root.bytes)) as SystemPackageDocument;
  } catch {
    return { candidate: null, diagnostics: [diagnostic("system-package.archive.root.invalid-json", `/${ROOT_PATH}`)] };
  }
  diagnostics.push(...options.validateSystem(document));
  if (diagnostics.length) return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };

  const declaredPaths = new Set(document.embeddedResources.map((item) => item.path));
  for (const entry of entries) {
    if (entry.path !== ROOT_PATH && !declaredPaths.has(entry.path)) {
      diagnostics.push(diagnostic(
        "system-package.archive.file.unknown",
        `/${entry.path}`,
        { path: entry.path },
      ));
    }
  }
  const embeddedResources = new Map<string, ResourcePackageCandidate>();
  for (const [index, embedded] of document.embeddedResources.entries()) {
    const archive = entries.find((entry) => entry.path === embedded.path);
    if (!archive?.bytes) {
      diagnostics.push(diagnostic(
        "system-package.embedded-resource.missing",
        `/embeddedResources/${index}/path`,
        { path: embedded.path },
      ));
      continue;
    }
    const result = await loadPbres(archive.bytes, options.validateResource);
    for (const nested of result.diagnostics) {
      diagnostics.push({
        ...nested,
        location: `/embeddedResources/${index}${nested.location}`,
      });
    }
    if (!result.candidate) continue;
    const actual = result.candidate.document;
    const mismatches = [
      ["packageId", embedded.packageId, actual.package.id],
      ["version", embedded.version, actual.package.version],
      ["snapshotDigest", embedded.snapshotDigest, actual.snapshotDigest],
    ] as const;
    for (const [field, expected, actualValue] of mismatches) {
      if (expected !== actualValue) {
        diagnostics.push(diagnostic(
          "system-package.embedded-resource.identity-mismatch",
          `/embeddedResources/${index}/${field}`,
          { actual: actualValue, expected },
        ));
      }
    }
    embeddedResources.set(embedded.path, result.candidate);
  }
  if (diagnostics.some((item) => item.severity === "error")) {
    return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };
  }
  return { candidate: { document, embeddedResources }, diagnostics: sortDiagnostics(diagnostics) };
}

export function writePbsys(
  entries: PortableDirectoryEntry[],
  options: { compressionLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; exportTime?: Date } = {},
): Uint8Array {
  const files: Record<string, [Uint8Array, ZipOptions]> = {};
  for (const entry of entries) {
    if (entry.kind !== "file" || !entry.bytes) throw new Error(`Invalid .pbsys entry: ${entry.path}`);
    files[entry.path] = [entry.bytes, {
      level: options.compressionLevel ?? 6,
      mtime: options.exportTime ?? new Date("2000-01-01T00:00:00Z"),
      os: 3,
      attrs: 0o100644 * 65536,
    }];
  }
  return zipSync(files as Zippable);
}

export async function loadPbsys(
  bytes: Uint8Array,
  options: {
    validateSystem: SystemPackageDocumentValidator;
    validateResource: ResourcePackageCandidateValidator;
  },
): Promise<SystemPackageLoadResult> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { candidate: null, diagnostics: [diagnostic("system-package.archive.zip.invalid", "")] };
  }
  const entries = Object.entries(files).map<PortableDirectoryEntry>(([path, fileBytes]) => ({
    path,
    kind: "file",
    bytes: fileBytes,
  }));
  return loadSystemPackageDirectory(entries, options);
}

export function planEmbeddedResourceAdmission(input: {
  embedded: SystemPackageDocument["embeddedResources"][number];
  local?: { version: string; snapshotDigest: string };
}): EmbeddedResourceAdmission {
  if (!input.local) return { action: "install" };
  const order = compareSemVer(input.local.version, input.embedded.version);
  if (order === 0) {
    return input.local.snapshotDigest === input.embedded.snapshotDigest
      ? { action: "no-op" }
      : { action: "reject", code: "system-package.embedded-resource.same-version-different-digest" };
  }
  if (order > 0) return { action: "keep-local" };
  return compareSemVer(input.local.version, input.embedded.minimumVersion) < 0
    ? { action: "required-update" }
    : { action: "prompt-update" };
}
