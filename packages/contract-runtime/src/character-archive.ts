import { strFromU8, strToU8, unzipSync, zipSync, type Zippable, type ZipOptions } from "fflate";

import type { ContractDiagnostic } from "./index.ts";
import {
  CHARACTER_SAVE_VERSION,
  type CharacterSaveCandidate,
  type CharacterSaveCandidateValidator,
  type CharacterSaveDocument,
  type CharacterSaveMedia,
} from "./character-save.ts";

const ROOT_PATH = "character.json";
const ASSET_PATH = /^assets\/([0-9a-f]{64})\.webp$/;
const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;
const MAX_ENTRIES = 1024;
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;

export type PbchaLoadResult = {
  candidate: CharacterSaveCandidate | null;
  diagnostics: ContractDiagnostic[];
};

function diagnostic(
  code: string,
  location: string,
  params: Record<string, unknown> = {},
): ContractDiagnostic {
  return {
    code,
    severity: "error",
    family: "character-save",
    version: CHARACTER_SAVE_VERSION,
    location,
    params,
  };
}

async function sha256AssetId(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return `sha256:${Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0")).join("")}`;
}

export function writePbcha(
  document: CharacterSaveDocument,
  media: CharacterSaveMedia,
  options: { compressionLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; exportTime?: Date } = {},
): Uint8Array {
  const zipOptions: ZipOptions = {
    level: options.compressionLevel ?? 6,
    mtime: options.exportTime ?? new Date("2000-01-01T00:00:00.000Z"),
    os: 3,
    attrs: 0o100644 * 65536,
  };
  const files: Record<string, [Uint8Array, ZipOptions]> = {
    [ROOT_PATH]: [strToU8(`${JSON.stringify(document, null, 2)}\n`), zipOptions],
  };
  for (const asset of document.characterData.assets) {
    const bytes = media.get(asset.id);
    if (!bytes) throw new Error(`Missing media bytes: ${asset.id}`);
    files[`assets/${asset.id.slice("sha256:".length)}.webp`] = [bytes, zipOptions];
  }
  return zipSync(files as Zippable);
}

export async function loadPbcha(
  bytes: Uint8Array,
  validate: CharacterSaveCandidateValidator,
): Promise<PbchaLoadResult> {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) {
    return { candidate: null, diagnostics: [diagnostic(
      "character-save.archive.bytes-exceeded",
      "",
      { actual: bytes.byteLength, limit: MAX_ARCHIVE_BYTES },
    )] };
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { candidate: null, diagnostics: [diagnostic("character-save.archive.zip.invalid", "")] };
  }
  const entries = Object.entries(files);
  if (entries.length > MAX_ENTRIES) {
    return { candidate: null, diagnostics: [diagnostic(
      "character-save.archive.entry-count-exceeded",
      "",
      { actual: entries.length, limit: MAX_ENTRIES },
    )] };
  }
  const expandedBytes = entries.reduce((total, [, entry]) => total + entry.byteLength, 0);
  if (expandedBytes > MAX_EXPANDED_BYTES) {
    return { candidate: null, diagnostics: [diagnostic(
      "character-save.archive.expanded-bytes-exceeded",
      "",
      { actual: expandedBytes, limit: MAX_EXPANDED_BYTES },
    )] };
  }
  const root = files[ROOT_PATH];
  if (!root) {
    return { candidate: null, diagnostics: [diagnostic("character-save.archive.root.missing", `/${ROOT_PATH}`)] };
  }

  let document: CharacterSaveDocument;
  try {
    const parsed = JSON.parse(strFromU8(root)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    document = parsed as CharacterSaveDocument;
  } catch {
    return { candidate: null, diagnostics: [diagnostic("character-save.archive.root.invalid-json", `/${ROOT_PATH}`)] };
  }

  const media = new Map<string, Uint8Array>();
  const archiveDiagnostics: ContractDiagnostic[] = [];
  for (const [path, fileBytes] of entries) {
    if (path === ROOT_PATH) continue;
    const match = ASSET_PATH.exec(path);
    if (!match) {
      archiveDiagnostics.push(diagnostic("character-save.archive.file.unknown", `/${path}`, { path }));
      continue;
    }
    const expected = `sha256:${match[1]}`;
    const actual = await sha256AssetId(fileBytes);
    if (actual !== expected) {
      archiveDiagnostics.push(diagnostic(
        "character-save.media.digest-mismatch",
        `/${path}`,
        { actual, expected },
      ));
    }
    media.set(expected, fileBytes);
  }
  if (archiveDiagnostics.length > 0) return { candidate: null, diagnostics: archiveDiagnostics };

  const diagnostics = await validate(document, media);
  if (diagnostics.some((item) => item.severity === "error")) return { candidate: null, diagnostics };
  return { candidate: { document, media }, diagnostics };
}
