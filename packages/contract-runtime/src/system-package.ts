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
export const SYSTEM_PACKAGE_VERSION = "1.0.0";
const VERSION = SYSTEM_PACKAGE_VERSION;
const ROOT_PATH = "system.json";
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export type SystemPackageRuntime = {
  loadingPresentation?: {
    tagline: string;
    accentColor: string;
  };
  pages: string;
  shell?: { html: string; css?: string };
  skins?: Array<{
    id: string;
    name: string;
    css: string;
    frameworkColorScheme: "light" | "dark";
    layoutOverrides?: {
      shell?: { html: string };
      pages?: Array<{ id: string; html: string }>;
    };
  }>;
  defaultSkin?: string;
  modules: string;
  dependencies?: string;
  characterCreationGuide?: string;
  questionnaireCharacterCreation?: { id: string; name: string; html: string };
  characterFormatAdapters?: string;
  characterTextExports?: string;
  validationChecks?: Array<{ id: string; script: string }>;
};

export type SystemPackageResourceCompatibility = {
  templateId: string;
  versionRange: {
    minimumInclusive: string;
    maximumExclusive: string;
  };
  nativeEntry: { id: string; label: string };
};

type SystemPackageIdentity = {
  id: string;
  version: string;
  name: string;
  description: string;
};

export type SystemPackageSourceDocument = {
  contractVersion: typeof VERSION;
  package: SystemPackageIdentity;
  runtime: SystemPackageRuntime;
  resourceCompatibility?: SystemPackageResourceCompatibility[];
  embeddedResources?: Array<{ path: string }>;
};

export type SystemPackageAlpha2Document = {
  contractVersion: "1.0.0-alpha.2";
  package: SystemPackageIdentity;
  runtime: SystemPackageRuntime;
  resourceCompatibility: SystemPackageResourceCompatibility[];
  embeddedResources: Array<{
    path: string;
    packageId: string;
    version: string;
    minimumVersion: string;
    snapshotDigest: string;
  }>;
};

export type AnySystemPackageDocument = SystemPackageSourceDocument | SystemPackageAlpha2Document;

export type SystemPackageDocument = {
  contractVersion: typeof VERSION;
  package: {
    id: string;
    version: string;
    name: string;
    description: string;
  };
  runtime: SystemPackageRuntime;
  resourceCompatibility: SystemPackageResourceCompatibility[];
  embeddedResources: Array<{ path: string }>;
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
  document: AnySystemPackageDocument,
) => ContractDiagnostic[];

export type EmbeddedResourceAdmission =
  | { action: "install" }
  | { action: "no-op" }
  | { action: "keep-local" }
  | { action: "required-update" }
  | { action: "reject"; code: string };

export type EmbeddedResourceIdentity = {
  package: { version: string };
  snapshotDigest: string;
};

export function normalizeSystemPackageDocument(
  document: AnySystemPackageDocument,
): SystemPackageDocument {
  return {
    contractVersion: VERSION,
    package: structuredClone(document.package),
    runtime: structuredClone(document.runtime),
    resourceCompatibility: structuredClone(document.resourceCompatibility ?? []),
    embeddedResources: document.embeddedResources?.map(({ path }) => ({ path })) ?? [],
  };
}

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
  if (!path || path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:/.test(path)) return false;
  if (path.includes("\\")) return false;
  return !path.split("/").some((part) =>
    !part
    || part === "."
    || part === ".."
    || /\p{Cc}/u.test(part)
    || part.endsWith(" ")
    || part.endsWith(".")
    || WINDOWS_RESERVED.test(part));
}

export function validateSystemPackageSemantics(
  document: SystemPackageDocument,
): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const compatibilityKeys = new Set<string>();
  const nativeEntries = new Set<string>();
  const embeddedPaths = new Set<string>();
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
  const skinIds = new Set<string>();
  document.runtime.skins?.forEach((skin, index) => {
    if (skinIds.has(skin.id)) {
      diagnostics.push(diagnostic(
        "system-package.runtime.skin.duplicate",
        `/runtime/skins/${index}/id`,
        { id: skin.id },
      ));
    }
    skinIds.add(skin.id);
    const pageIds = new Set<string>();
    skin.layoutOverrides?.pages?.forEach((page, pageIndex) => {
      if (pageIds.has(page.id)) {
        diagnostics.push(diagnostic(
          "system-package.runtime.skin.page-override.duplicate",
          `/runtime/skins/${index}/layoutOverrides/pages/${pageIndex}/id`,
          { id: page.id },
        ));
      }
      pageIds.add(page.id);
    });
  });
  if (document.runtime.defaultSkin && !skinIds.has(document.runtime.defaultSkin)) {
    diagnostics.push(diagnostic(
      "system-package.runtime.default-skin.missing",
      "/runtime/defaultSkin",
      { id: document.runtime.defaultSkin },
    ));
  }
  const validationCheckIds = new Set<string>();
  document.runtime.validationChecks?.forEach((check, index) => {
    if (validationCheckIds.has(check.id)) {
      diagnostics.push(diagnostic(
        "system-package.runtime.validation-check.duplicate",
        `/runtime/validationChecks/${index}/id`,
        { id: check.id },
      ));
    }
    validationCheckIds.add(check.id);
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
  let sourceDocument: AnySystemPackageDocument;
  try {
    sourceDocument = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(root.bytes)) as AnySystemPackageDocument;
  } catch {
    return { candidate: null, diagnostics: [diagnostic("system-package.archive.root.invalid-json", `/${ROOT_PATH}`)] };
  }
  diagnostics.push(...options.validateSystem(sourceDocument));
  if (diagnostics.length) return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };
  const document = normalizeSystemPackageDocument(sourceDocument);

  const declaredPaths = collectRuntimePaths(document.runtime);
  document.embeddedResources.forEach((item) => declaredPaths.add(item.path));
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
    if (sourceDocument.contractVersion === "1.0.0-alpha.2") {
      const declared = sourceDocument.embeddedResources[index];
      const actual = result.candidate.document;
      const mismatches = [
        ["packageId", declared?.packageId, actual.package.id],
        ["version", declared?.version, actual.package.version],
        ["snapshotDigest", declared?.snapshotDigest, actual.snapshotDigest],
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
    }
    embeddedResources.set(embedded.path, result.candidate);
  }
  if (diagnostics.some((item) => item.severity === "error")) {
    return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };
  }
  return { candidate: { document, embeddedResources }, diagnostics: sortDiagnostics(diagnostics) };
}

function collectRuntimePaths(runtime: SystemPackageDocument["runtime"]): Set<string> {
  const paths = new Set([runtime.pages, runtime.modules]);
  const add = (path?: string) => {
    if (path) paths.add(path);
  };
  add(runtime.shell?.html);
  add(runtime.shell?.css);
  add(runtime.dependencies);
  add(runtime.characterCreationGuide);
  add(runtime.questionnaireCharacterCreation?.html);
  add(runtime.characterFormatAdapters);
  add(runtime.characterTextExports);
  runtime.skins?.forEach((skin) => {
    add(skin.css);
    add(skin.layoutOverrides?.shell?.html);
    skin.layoutOverrides?.pages?.forEach((page) => add(page.html));
  });
  runtime.validationChecks?.forEach((check) => add(check.script));
  return paths;
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
  embedded: EmbeddedResourceIdentity;
  local?: { version: string; snapshotDigest: string };
}): EmbeddedResourceAdmission {
  if (!input.local) return { action: "install" };
  const order = compareSemVer(input.local.version, input.embedded.package.version);
  if (order === 0) {
    return input.local.snapshotDigest === input.embedded.snapshotDigest
      ? { action: "no-op" }
      : { action: "reject", code: "system-package.embedded-resource.same-version-different-digest" };
  }
  if (order > 0) return { action: "keep-local" };
  return { action: "required-update" };
}
