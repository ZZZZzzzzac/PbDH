import type { ContractDiagnostic } from "./index.ts";
import type { TabletopAsset, TabletopDocument } from "./tabletop-document.ts";

export const CHARACTER_SAVE_VERSION = "1.0.0-alpha.1";

export type CharacterValues = Readonly<Record<string, unknown>>;

export type CharacterData = {
  values: CharacterValues;
  tabletop: {
    instances: TabletopDocument["instances"];
  };
  assets: TabletopAsset[];
};

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

export async function validateCharacterSaveSemantics(
  document: CharacterSaveDocument,
  media: CharacterSaveMedia,
): Promise<ContractDiagnostic[]> {
  const diagnostics: ContractDiagnostic[] = [];
  const instanceIds = new Set<string>();
  document.characterData.tabletop.instances.forEach((instance, index) => {
    if (instanceIds.has(instance.instanceId)) {
      diagnostics.push(diagnostic(
        "character-save.tabletop.instance-id.duplicate",
        `/characterData/tabletop/instances/${index}/instanceId`,
        { instanceId: instance.instanceId },
      ));
    }
    instanceIds.add(instance.instanceId);
  });

  const assets = new Map<string, TabletopAsset>();
  document.characterData.assets.forEach((asset, index) => {
    if (assets.has(asset.id)) {
      diagnostics.push(diagnostic(
        "character-save.asset-id.duplicate",
        `/characterData/assets/${index}/id`,
        { assetId: asset.id },
      ));
    }
    assets.set(asset.id, asset);
  });

  const referenced = new Set(document.characterData.tabletop.instances.flatMap((instance) =>
    Object.values(instance.resourceCopy.media)));
  for (const assetId of referenced) {
    if (!assets.has(assetId)) {
      diagnostics.push(diagnostic(
        "character-save.asset-reference.missing",
        "/characterData/tabletop/instances",
        { assetId },
      ));
    }
  }

  for (const [index, asset] of document.characterData.assets.entries()) {
    const bytes = media.get(asset.id);
    if (!bytes) {
      diagnostics.push(diagnostic(
        "character-save.media.missing",
        `/characterData/assets/${index}`,
        { assetId: asset.id },
      ));
      continue;
    }
    if (String(bytes.byteLength) !== asset.byteLength) {
      diagnostics.push(diagnostic(
        "character-save.media.byte-length-mismatch",
        `/characterData/assets/${index}/byteLength`,
        { actual: String(bytes.byteLength), expected: asset.byteLength },
      ));
      continue;
    }
    const actual = await sha256AssetId(bytes);
    if (actual !== asset.id) {
      diagnostics.push(diagnostic(
        "character-save.media.digest-mismatch",
        `/characterData/assets/${index}/id`,
        { actual, expected: asset.id },
      ));
    }
  }
  return diagnostics.sort((left, right) => left.location.localeCompare(right.location)
    || left.code.localeCompare(right.code));
}
