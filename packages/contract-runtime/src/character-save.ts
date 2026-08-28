import type { ContractDiagnostic } from "./index.ts";
import type { TabletopAsset, TabletopDocument } from "./tabletop-document.ts";

export const CHARACTER_SAVE_VERSION = "1.0.0";
export const CHARACTER_SAVE_ALPHA1_VERSION = "1.0.0-alpha.1";

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

export type CharacterSaveAlpha1Document = {
  contractVersion: typeof CHARACTER_SAVE_ALPHA1_VERSION;
  documentId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  systemPackage: {
    id: string;
    version: string;
  };
  characterData: {
    values: Readonly<Record<string, unknown>>;
    tabletop: {
      instances: TabletopDocument["instances"];
    };
    assets: TabletopAsset[];
  };
};

export type AnyCharacterSaveDocument = CharacterSaveDocument | CharacterSaveAlpha1Document;
export type CharacterSaveMedia = ReadonlyMap<string, Uint8Array>;

export type CharacterSaveCandidate = {
  document: CharacterSaveDocument;
  media: CharacterSaveMedia;
};

export type CharacterSaveCandidateValidator = (
  document: AnyCharacterSaveDocument,
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
  document: AnyCharacterSaveDocument,
  media: CharacterSaveMedia,
): Promise<ContractDiagnostic[]> {
  const diagnostics: ContractDiagnostic[] = [];
  if (document.contractVersion === CHARACTER_SAVE_VERSION) {
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

export type CharacterSaveMigrationResult = {
  document: CharacterSaveDocument | null;
  diagnostics: ContractDiagnostic[];
};

export function migrateCharacterSaveAlpha1(
  source: CharacterSaveAlpha1Document,
): CharacterSaveMigrationResult {
  const characterData: Record<string, unknown> = structuredClone(source.characterData.values);
  for (const [moduleId, value] of Object.entries(characterData)) {
    if (isLegacyPlayerImageValue(value)) characterData[moduleId] = { assetId: value.imageId };
  }

  const tables = new Map<string, TabletopDocument["instances"]>();
  const diagnostics: ContractDiagnostic[] = [];
  source.characterData.tabletop.instances.forEach((instance, index) => {
    const tableModuleId = instance.state.tableModuleId;
    if (!tableModuleId) {
      diagnostics.push(diagnostic(
        "character-save.migration.table-module-id.missing",
        `/characterData/tabletop/instances/${index}/state/tableModuleId`,
        { instanceId: instance.instanceId },
        CHARACTER_SAVE_ALPHA1_VERSION,
      ));
      return;
    }
    if (Object.prototype.hasOwnProperty.call(characterData, tableModuleId)) {
      diagnostics.push(diagnostic(
        "character-save.migration.module-state.collision",
        `/characterData/${tableModuleId}`,
        { moduleId: tableModuleId },
        CHARACTER_SAVE_ALPHA1_VERSION,
      ));
      return;
    }
    const state = { ...instance.state };
    delete state.tableModuleId;
    if (state.sheetState !== undefined) {
      state.value = state.sheetState;
      delete state.sheetState;
    }
    const migrated = { ...structuredClone(instance), state };
    const instances = tables.get(tableModuleId) ?? [];
    instances.push(migrated);
    tables.set(tableModuleId, instances);
  });
  if (diagnostics.length > 0) return { document: null, diagnostics };
  for (const [moduleId, instances] of tables) characterData[moduleId] = { instances };

  return {
    document: {
      contractVersion: CHARACTER_SAVE_VERSION,
      documentId: source.documentId,
      name: source.name,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      systemPackage: structuredClone(source.systemPackage),
      characterDataVersion: "1.0.0",
      characterData,
    },
    diagnostics: [],
  };
}

function isLegacyPlayerImageValue(value: unknown): value is { kind: "player-image"; imageId: string } {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && (value as Record<string, unknown>).kind === "player-image"
    && typeof (value as Record<string, unknown>).imageId === "string";
}

function isAssetReference(value: unknown): value is { assetId: string } {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.keys(value).length === 1
    && typeof (value as Record<string, unknown>).assetId === "string";
}
