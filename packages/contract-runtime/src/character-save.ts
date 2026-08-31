import type { ContractDiagnostic } from "./index.ts";

export const CHARACTER_SAVE_VERSION = "1.0.0";

export type CharacterData = Readonly<Record<string, unknown>>;

export type CharacterSaveDocument = {
  contractVersion: typeof CHARACTER_SAVE_VERSION;
  documentId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  systemPackage: {
    id: string;
    version: string;
  };
  characterDataVersion: string;
  characterData: CharacterData;
};

export type CharacterSaveMedia = ReadonlyMap<string, Uint8Array>;

export type CharacterSaveCandidate = {
  document: CharacterSaveDocument;
  media: CharacterSaveMedia;
};

export type CharacterSaveCandidateValidator = (
  document: CharacterSaveDocument,
  media: CharacterSaveMedia,
) => Promise<ContractDiagnostic[]>;

function diagnostic(
  code: string,
  location: string,
  params: Record<string, unknown> = {},
  version = CHARACTER_SAVE_VERSION,
): ContractDiagnostic {
  return {
    code,
    severity: "error",
    family: "character-save",
    version,
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

export async function validateCharacterSaveSemantics(
  document: CharacterSaveDocument,
  media: CharacterSaveMedia,
): Promise<ContractDiagnostic[]> {
  const diagnostics: ContractDiagnostic[] = [];
  const createdAt = timestampMillis(document.createdAt);
  const updatedAt = timestampMillis(document.updatedAt);
  if (createdAt === null) diagnostics.push(diagnostic(
    "character-save.created-at.invalid",
    "/createdAt",
    { value: document.createdAt },
    document.contractVersion,
  ));
  if (updatedAt === null) diagnostics.push(diagnostic(
    "character-save.updated-at.invalid",
    "/updatedAt",
    { value: document.updatedAt },
    document.contractVersion,
  ));
  if (createdAt !== null && updatedAt !== null && updatedAt < createdAt) {
    diagnostics.push(diagnostic(
      "character-save.timestamps.out-of-order",
      "/updatedAt",
      { createdAt: document.createdAt, updatedAt: document.updatedAt },
      document.contractVersion,
    ));
  }
  const referenced = characterSavePlayerAssetIds(document);
  for (const assetId of referenced) {
    if (!media.has(assetId)) diagnostics.push(diagnostic(
      "character-save.media.missing",
      `/characterData`,
      { assetId },
    ));
  }
  for (const assetId of media.keys()) {
    if (!referenced.has(assetId)) diagnostics.push(diagnostic(
      "character-save.media.orphaned",
      `/media/${assetId}`,
      { assetId },
    ));
  }
  for (const [assetId, bytes] of media) {
    const actual = await sha256AssetId(bytes);
    if (actual !== assetId) {
      diagnostics.push(diagnostic(
        "character-save.media.digest-mismatch",
        `/media/${assetId}`,
        { actual, expected: assetId },
      ));
    }
  }
  return diagnostics.sort((left, right) => left.location.localeCompare(right.location)
    || left.code.localeCompare(right.code));
}

function timestampMillis(value: string): number | null {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return null;
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z");
  return new Date(millis).toISOString() === normalized ? millis : null;
}

export function characterSavePlayerAssetIds(document: CharacterSaveDocument): Set<string> {
  return new Set(Object.values(document.characterData).flatMap((value) =>
    isAssetReference(value) ? [value.assetId] : []));
}

export function selectCharacterSavePlayerMedia(
  document: CharacterSaveDocument,
  media: CharacterSaveMedia,
): Map<string, Uint8Array> {
  const assetIds = characterSavePlayerAssetIds(document);
  return new Map([...media].filter(([assetId]) => assetIds.has(assetId)));
}

function isAssetReference(value: unknown): value is { assetId: string } {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.keys(value).length === 1
    && typeof (value as Record<string, unknown>).assetId === "string";
}
