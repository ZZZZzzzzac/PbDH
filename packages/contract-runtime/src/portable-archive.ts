import {
  strToU8,
  unzipSync,
  zipSync,
  type Zippable,
  type ZipOptions,
} from "fflate";

import type { ContractDiagnostic } from "./index.ts";
import type {
  ResourcePackageLogicalDocument,
  ResourcePackageMedia,
} from "./resource-package.ts";

const FAMILY = "resource-package";
const VERSION = "1.0.0";
const ROOT_PATH = "package.json";
const MAX_ENTRIES = 1024;
const MAX_PATH_BYTES = 512;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const ASSET_PATH = /^assets\/([0-9a-f]{64})\.webp$/;

export type PortableEntryKind =
  | "file"
  | "directory"
  | "symlink"
  | "hardlink"
  | "junction"
  | "device"
  | "socket";

export type PortableDirectoryEntry = {
  path: string;
  kind: PortableEntryKind;
  bytes?: Uint8Array;
};

export type ResourcePackageCandidate = {
  document: ResourcePackageLogicalDocument;
  media: Map<string, Uint8Array>;
};

export type ResourcePackageCandidateValidator = (
  document: ResourcePackageLogicalDocument,
  media: ResourcePackageMedia,
) => Promise<ContractDiagnostic[]>;

export type PortableArchiveResult = {
  candidate: ResourcePackageCandidate | null;
  diagnostics: ContractDiagnostic[];
};

type ZipEntryMetadata = {
  path: string;
  kind: "file" | "directory";
  compressedSize: number;
  expandedSize: number;
};

function diagnostic(
  code: string,
  location: string,
  params: Record<string, unknown> = {},
  severity: ContractDiagnostic["severity"] = "error",
): ContractDiagnostic {
  return { code, severity, family: FAMILY, version: VERSION, location, params };
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0)!);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0)!);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function sortDiagnostics(diagnostics: ContractDiagnostic[]): ContractDiagnostic[] {
  return diagnostics.sort((left, right) => {
    const locationOrder = compareCodePoints(left.location, right.location);
    if (locationOrder !== 0) return locationOrder;
    return compareCodePoints(left.code, right.code);
  });
}

function hasErrors(diagnostics: ContractDiagnostic[]): boolean {
  return diagnostics.some((item) => item.severity === "error");
}

function pathProblem(path: string, directory: boolean): string | undefined {
  const candidate = directory && path.endsWith("/") ? path.slice(0, -1) : path;
  if (!candidate) return "empty";
  if (new TextEncoder().encode(candidate).byteLength > MAX_PATH_BYTES) return "too-long";
  if (candidate.startsWith("/") || candidate.startsWith("\\") || /^[A-Za-z]:/.test(candidate)) {
    return "absolute";
  }
  if (candidate.includes("\\")) return "backslash";
  for (const segment of candidate.split("/")) {
    if (!segment) return "empty-segment";
    if (segment === "." || segment === "..") return "traversal";
    if (/\p{Cc}/u.test(segment)) return "control-character";
    if (segment.endsWith(" ") || segment.endsWith(".")) return "trailing-space-or-dot";
    if (WINDOWS_RESERVED.test(segment)) return "windows-reserved";
  }
  return undefined;
}

function collisionKey(path: string): string {
  return path.replace(/\/$/, "").normalize("NFC").toLowerCase();
}

function encodeJson(value: unknown): Uint8Array {
  return strToU8(`${JSON.stringify(value, null, 2)}\n`);
}

function parseJson(bytes: Uint8Array): unknown {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(text) as unknown;
}

async function sha256AssetId(bytes: Uint8Array): Promise<string> {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input.buffer);
  return `sha256:${Array.from(
    new Uint8Array(digest),
    (value) => value.toString(16).padStart(2, "0"),
  ).join("")}`;
}

function portableEntriesFor(
  document: ResourcePackageLogicalDocument,
  media: ResourcePackageMedia,
): PortableDirectoryEntry[] {
  const { resources, ...root } = structuredClone(document);
  const entries: PortableDirectoryEntry[] = [
    { path: ROOT_PATH, kind: "file", bytes: encodeJson(root) },
  ];

  for (const resource of resources) {
    const problem = pathProblem(resource.path, false);
    if (problem || resource.path === ROOT_PATH || resource.path.startsWith("assets/")) {
      throw new Error(`Invalid Resource path: ${resource.path}`);
    }
    const { path: _path, ...payload } = resource;
    entries.push({ path: resource.path, kind: "file", bytes: encodeJson(payload) });
  }

  for (const asset of document.assets) {
    const bytes = media.get(asset.id);
    if (!bytes) throw new Error(`Missing media bytes: ${asset.id}`);
    entries.push({
      path: `assets/${asset.id.slice("sha256:".length)}.webp`,
      kind: "file",
      bytes,
    });
  }

  for (const path of document.emptyDirectories) {
    if (pathProblem(path, true)) throw new Error(`Invalid empty directory path: ${path}`);
    entries.push({ path: `${path.replace(/\/$/, "")}/`, kind: "directory" });
  }

  return entries.sort((left, right) => compareCodePoints(left.path, right.path));
}

export function writeResourcePackageDirectory(
  document: ResourcePackageLogicalDocument,
  media: ResourcePackageMedia,
): PortableDirectoryEntry[] {
  return portableEntriesFor(document, media);
}

function validateEntrySet(
  entries: PortableDirectoryEntry[],
  requireFileBytes = true,
): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const exactPaths = new Set<string>();
  const collisionPaths = new Map<string, { path: string; kind: "file" | "directory" }>();
  let expandedBytes = 0;

  if (entries.length > MAX_ENTRIES) {
    diagnostics.push(diagnostic(
      "resource-package.archive.entry-count-exceeded",
      "",
      { actual: entries.length, limit: MAX_ENTRIES },
    ));
  }

  entries.forEach((entry, index) => {
    const location = `/entries/${index}`;
    const isDirectory = entry.kind === "directory";
    const problem = pathProblem(entry.path, isDirectory);
    if (problem) {
      diagnostics.push(diagnostic(
        "resource-package.archive.path.invalid",
        `${location}/path`,
        { path: entry.path, reason: problem },
      ));
    }
    if (entry.kind !== "file" && entry.kind !== "directory") {
      diagnostics.push(diagnostic(
        "resource-package.archive.entry.special",
        location,
        { kind: entry.kind, path: entry.path },
      ));
    }
    if (requireFileBytes && entry.kind === "file" && !entry.bytes) {
      diagnostics.push(diagnostic(
        "resource-package.archive.file.bytes-missing",
        location,
        { path: entry.path },
      ));
    }
    if (entry.bytes) {
      expandedBytes += entry.bytes.byteLength;
      if (entry.bytes.byteLength > MAX_FILE_BYTES) {
        diagnostics.push(diagnostic(
          "resource-package.archive.file-too-large",
          location,
          { actual: entry.bytes.byteLength, limit: MAX_FILE_BYTES, path: entry.path },
        ));
      }
    }
    if (exactPaths.has(entry.path)) {
      diagnostics.push(diagnostic(
        "resource-package.archive.entry.duplicate",
        `${location}/path`,
        { path: entry.path },
      ));
    }
    exactPaths.add(entry.path);

    if (!problem && (entry.kind === "file" || entry.kind === "directory")) {
      const key = collisionKey(entry.path);
      const previous = collisionPaths.get(key);
      if (previous && (previous.path !== entry.path || previous.kind !== entry.kind)) {
        diagnostics.push(diagnostic(
          "resource-package.archive.path.collision",
          `${location}/path`,
          { first: previous.path, second: entry.path },
        ));
      } else if (!previous) {
        collisionPaths.set(key, { path: entry.path, kind: entry.kind });
      }

      const candidate = entry.path.replace(/\/$/, "");
      const segments = candidate.split("/");
      for (let length = 1; length < segments.length; length += 1) {
        const parent = segments.slice(0, length).join("/");
        const parentKey = collisionKey(parent);
        const parentEntry = collisionPaths.get(parentKey);
        if (parentEntry?.kind === "file") {
          diagnostics.push(diagnostic(
            "resource-package.archive.path.collision",
            `${location}/path`,
            { first: parentEntry.path, second: entry.path },
          ));
        } else if (!parentEntry) {
          collisionPaths.set(parentKey, { path: parent, kind: "directory" });
        }
      }
    }
  });

  if (expandedBytes > MAX_EXPANDED_BYTES) {
    diagnostics.push(diagnostic(
      "resource-package.archive.expanded-bytes-exceeded",
      "",
      { actual: expandedBytes, limit: MAX_EXPANDED_BYTES },
    ));
  }
  return diagnostics;
}

export async function loadResourcePackageDirectory(
  entries: PortableDirectoryEntry[],
  validate: ResourcePackageCandidateValidator,
): Promise<PortableArchiveResult> {
  const diagnostics = validateEntrySet(entries);
  if (hasErrors(diagnostics)) return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };

  const rootEntries = entries.filter((entry) => entry.kind === "file" && entry.path === ROOT_PATH);
  if (rootEntries.length === 0) {
    diagnostics.push(diagnostic("resource-package.archive.root.missing", `/${ROOT_PATH}`));
    return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };
  }

  let root: Record<string, unknown>;
  try {
    const parsed = parseJson(rootEntries[0]!.bytes!);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    root = parsed as Record<string, unknown>;
  } catch {
    diagnostics.push(diagnostic("resource-package.archive.root.invalid-json", `/${ROOT_PATH}`));
    return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };
  }
  if (Object.hasOwn(root, "resources")) {
    diagnostics.push(diagnostic(
      "resource-package.archive.root.resources-forbidden",
      `/${ROOT_PATH}/resources`,
    ));
  }

  const actualEmptyDirectories = entries
    .filter((entry) => entry.kind === "directory")
    .map((entry) => entry.path.replace(/\/$/, ""))
    .filter((directory) => !entries.some((entry) =>
      entry.kind === "file" && entry.path.startsWith(`${directory}/`)))
    .sort(compareCodePoints);
  const declaredEmptyDirectories = Array.isArray(root.emptyDirectories)
    ? root.emptyDirectories.filter((item): item is string => typeof item === "string").sort(compareCodePoints)
    : [];
  if (JSON.stringify(actualEmptyDirectories) !== JSON.stringify(declaredEmptyDirectories)) {
    diagnostics.push(diagnostic(
      "resource-package.archive.empty-directories.mismatch",
      `/${ROOT_PATH}/emptyDirectories`,
      { actual: actualEmptyDirectories, expected: declaredEmptyDirectories },
    ));
  }

  const resources: ResourcePackageLogicalDocument["resources"] = [];
  const media = new Map<string, Uint8Array>();
  const resourceFiles = entries.filter((entry) =>
    entry.kind === "file"
    && entry.path !== ROOT_PATH
    && !entry.path.startsWith("assets/"),
  );

  for (const entry of resourceFiles) {
    if (!entry.path.endsWith(".json")) {
      diagnostics.push(diagnostic(
        "resource-package.archive.file.unknown",
        `/${entry.path}`,
        { path: entry.path },
      ));
      continue;
    }
    try {
      const parsed = parseJson(entry.bytes!);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      if (Object.hasOwn(parsed, "path")) {
        diagnostics.push(diagnostic(
          "resource-package.archive.resource.path-forbidden",
          `/${entry.path}/path`,
        ));
      }
      resources.push({ ...(parsed as Omit<ResourcePackageLogicalDocument["resources"][number], "path">), path: entry.path });
    } catch {
      diagnostics.push(diagnostic(
        "resource-package.archive.resource.invalid-json",
        `/${entry.path}`,
      ));
    }
  }

  const declaredAssets = new Set(
    Array.isArray(root.assets)
      ? root.assets.flatMap((asset) =>
        asset && typeof asset === "object" && "id" in asset && typeof asset.id === "string"
          ? [asset.id]
          : [])
      : [],
  );
  for (const entry of entries.filter((item) => item.kind === "file" && item.path.startsWith("assets/"))) {
    const match = ASSET_PATH.exec(entry.path);
    if (!match) {
      diagnostics.push(diagnostic(
        "resource-package.archive.file.unknown",
        `/${entry.path}`,
        { path: entry.path },
      ));
      continue;
    }
    const assetId = `sha256:${match[1]}`;
    media.set(assetId, entry.bytes!);
    if (!declaredAssets.has(assetId)) {
      const actualId = await sha256AssetId(entry.bytes!);
      diagnostics.push(actualId === assetId
        ? diagnostic(
          "resource-package.archive.media.orphan",
          `/${entry.path}`,
          { assetId },
          "warning",
        )
        : diagnostic(
          "resource-package.media.digest-mismatch",
          `/${entry.path}`,
          { actual: actualId, expected: assetId },
        ));
    }
  }

  const document = { ...root, resources } as ResourcePackageLogicalDocument;
  const validationDiagnostics = hasErrors(diagnostics)
    ? []
    : await validate(document, media);
  diagnostics.push(...validationDiagnostics);
  if (hasErrors(diagnostics)) return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };
  return { candidate: { document, media }, diagnostics: sortDiagnostics(diagnostics) };
}

export type PbresWriteOptions = {
  compressionLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  exportTime?: Date;
};

export function writePbres(
  document: ResourcePackageLogicalDocument,
  media: ResourcePackageMedia,
  options: PbresWriteOptions = {},
): Uint8Array {
  const level = options.compressionLevel ?? 6;
  const mtime = options.exportTime ?? new Date("2000-01-01T00:00:00.000Z");
  const files: Record<string, [Uint8Array, ZipOptions]> = {};
  for (const entry of portableEntriesFor(document, media)) {
    const isDirectory = entry.kind === "directory";
    files[entry.path] = [
      entry.bytes ?? new Uint8Array(),
      {
        level,
        mtime,
        os: 3,
        attrs: (isDirectory ? 0o40755 : 0o100644) * 65536,
      },
    ];
  }
  return zipSync(files as Zippable);
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function inspectZip(bytes: Uint8Array): {
  entries: ZipEntryMetadata[];
  diagnostics: ContractDiagnostic[];
} {
  const diagnostics: ContractDiagnostic[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const minimum = Math.max(0, bytes.byteLength - 65_557);
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (readUint32(view, offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) {
    return { entries: [], diagnostics: [diagnostic("resource-package.archive.zip.invalid", "")] };
  }

  const entryCount = view.getUint16(eocd + 10, true);
  const centralSize = readUint32(view, eocd + 12);
  const centralOffset = readUint32(view, eocd + 16);
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    return { entries: [], diagnostics: [diagnostic("resource-package.archive.zip64.unsupported", "")] };
  }
  if (entryCount > MAX_ENTRIES) {
    diagnostics.push(diagnostic(
      "resource-package.archive.entry-count-exceeded",
      "",
      { actual: entryCount, limit: MAX_ENTRIES },
    ));
  }
  if (centralOffset + centralSize > eocd) {
    diagnostics.push(diagnostic("resource-package.archive.zip.invalid", ""));
    return { entries: [], diagnostics };
  }

  const entries: ZipEntryMetadata[] = [];
  let expandedBytes = 0;
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.byteLength || readUint32(view, offset) !== 0x02014b50) {
      diagnostics.push(diagnostic("resource-package.archive.zip.invalid", ""));
      return { entries: [], diagnostics };
    }
    const os = bytes[offset + 5]!;
    const flags = view.getUint16(offset + 8, true);
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = readUint32(view, offset + 20);
    const expandedSize = readUint32(view, offset + 24);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = readUint32(view, offset + 38);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > bytes.byteLength) {
      diagnostics.push(diagnostic("resource-package.archive.zip.invalid", ""));
      return { entries: [], diagnostics };
    }
    let path: string;
    try {
      const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
      if (!(flags & 0x0800) && nameBytes.some((value) => value > 0x7f)) throw new Error();
      path = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes);
    } catch {
      diagnostics.push(diagnostic(
        "resource-package.archive.path.encoding-invalid",
        `/entries/${index}/path`,
      ));
      offset = nextOffset;
      continue;
    }
    if (flags & 0x0001) {
      diagnostics.push(diagnostic(
        "resource-package.archive.zip.encrypted",
        `/entries/${index}`,
        { path },
      ));
    }
    if (compression !== 0 && compression !== 8) {
      diagnostics.push(diagnostic(
        "resource-package.archive.zip.compression-unsupported",
        `/entries/${index}`,
        { compression, path },
      ));
    }
    const unixMode = os === 3 ? Math.floor(externalAttributes / 65536) & 0xffff : 0;
    const unixType = unixMode & 0xf000;
    const directory = path.endsWith("/");
    if (unixType !== 0 && unixType !== 0x8000 && unixType !== 0x4000) {
      diagnostics.push(diagnostic(
        "resource-package.archive.entry.special",
        `/entries/${index}`,
        { kind: "zip-special", path },
      ));
    }
    if ((directory && unixType === 0x8000) || (!directory && unixType === 0x4000)) {
      diagnostics.push(diagnostic(
        "resource-package.archive.entry.type-mismatch",
        `/entries/${index}`,
        { path },
      ));
    }
    if (expandedSize > MAX_FILE_BYTES) {
      diagnostics.push(diagnostic(
        "resource-package.archive.file-too-large",
        `/entries/${index}`,
        { actual: expandedSize, limit: MAX_FILE_BYTES, path },
      ));
    }
    if (expandedSize > 0 && expandedSize > compressedSize * MAX_COMPRESSION_RATIO) {
      diagnostics.push(diagnostic(
        "resource-package.archive.compression-ratio-exceeded",
        `/entries/${index}`,
        { compressed: compressedSize, expanded: expandedSize, limit: MAX_COMPRESSION_RATIO, path },
      ));
    }
    expandedBytes += expandedSize;
    entries.push({
      path,
      kind: directory ? "directory" : "file",
      compressedSize,
      expandedSize,
    });
    offset = nextOffset;
  }
  if (expandedBytes > MAX_EXPANDED_BYTES) {
    diagnostics.push(diagnostic(
      "resource-package.archive.expanded-bytes-exceeded",
      "",
      { actual: expandedBytes, limit: MAX_EXPANDED_BYTES },
    ));
  }
  return { entries, diagnostics };
}

export async function loadPbres(
  bytes: Uint8Array,
  validate: ResourcePackageCandidateValidator,
): Promise<PortableArchiveResult> {
  const inspected = inspectZip(bytes);
  const metadataEntries: PortableDirectoryEntry[] = inspected.entries.map((entry) => ({
    path: entry.path,
    kind: entry.kind,
  }));
  const diagnostics = [...inspected.diagnostics, ...validateEntrySet(metadataEntries, false)];
  if (hasErrors(diagnostics)) return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes);
  } catch {
    diagnostics.push(diagnostic("resource-package.archive.zip.invalid", ""));
    return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };
  }
  const entries = inspected.entries.map<PortableDirectoryEntry>((entry) => ({
    path: entry.path,
    kind: entry.kind,
    bytes: entry.kind === "file" ? unzipped[entry.path] : undefined,
  }));
  const result = await loadResourcePackageDirectory(entries, validate);
  diagnostics.push(...result.diagnostics);
  if (hasErrors(diagnostics)) return { candidate: null, diagnostics: sortDiagnostics(diagnostics) };
  return { candidate: result.candidate, diagnostics: sortDiagnostics(diagnostics) };
}
