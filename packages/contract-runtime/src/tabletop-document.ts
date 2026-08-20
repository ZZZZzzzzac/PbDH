import type { ContractDiagnostic } from "./index.ts";

export const TABLETOP_DOCUMENT_VERSION = "1.0.0-alpha.1";

export type TabletopAsset = {
  id: string;
  mediaType: "image/webp";
  byteLength: string;
  width: string;
  height: string;
};

export type TabletopResourceCopy = {
  source: { packageId: string; resourceId: string };
  template: { id: string; version: string };
  presentation: {
    width: string;
    height: string;
    unit: "mm";
    mode: "text" | "split" | "image";
    fixedRatio: boolean;
  };
  data: Record<string, unknown>;
  labels: string[];
  media: Record<string, string>;
};

export type TabletopDocument = {
  contractVersion: typeof TABLETOP_DOCUMENT_VERSION;
  documentId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  instances: Array<{
    instanceId: string;
    resourceCopy: TabletopResourceCopy;
    state: Record<string, string>;
    geometry: {
      x: number;
      y: number;
      layer: number;
      rotation: number;
      flipped: boolean;
      scale: number;
    };
  }>;
  assets: TabletopAsset[];
};

export type TabletopMedia = ReadonlyMap<string, Uint8Array>;

function diagnostic(
  code: string,
  location: string,
  params: Record<string, unknown> = {},
): ContractDiagnostic {
  return {
    code,
    severity: "error",
    family: "tabletop-document",
    version: TABLETOP_DOCUMENT_VERSION,
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

export async function validateTabletopDocumentSemantics(
  document: TabletopDocument,
  media: TabletopMedia,
): Promise<ContractDiagnostic[]> {
  const diagnostics: ContractDiagnostic[] = [];
  const instanceIds = new Set<string>();
  document.instances.forEach((instance, index) => {
    if (instanceIds.has(instance.instanceId)) {
      diagnostics.push(diagnostic(
        "tabletop-document.instance-id.duplicate",
        `/instances/${index}/instanceId`,
        { instanceId: instance.instanceId },
      ));
    }
    instanceIds.add(instance.instanceId);
  });

  const assets = new Map<string, TabletopAsset>();
  document.assets.forEach((asset, index) => {
    if (assets.has(asset.id)) {
      diagnostics.push(diagnostic(
        "tabletop-document.asset-id.duplicate",
        `/assets/${index}/id`,
        { assetId: asset.id },
      ));
    }
    assets.set(asset.id, asset);
  });

  const referenced = new Set(document.instances.flatMap((instance) =>
    Object.values(instance.resourceCopy.media)));
  for (const assetId of referenced) {
    if (!assets.has(assetId)) {
      diagnostics.push(diagnostic(
        "tabletop-document.asset-reference.missing",
        "/instances",
        { assetId },
      ));
    }
  }

  for (const [index, asset] of document.assets.entries()) {
    const bytes = media.get(asset.id);
    if (!bytes) {
      diagnostics.push(diagnostic(
        "tabletop-document.media.missing",
        `/assets/${index}`,
        { assetId: asset.id },
      ));
      continue;
    }
    if (String(bytes.byteLength) !== asset.byteLength) {
      diagnostics.push(diagnostic(
        "tabletop-document.media.byte-length-mismatch",
        `/assets/${index}/byteLength`,
        { actual: String(bytes.byteLength), expected: asset.byteLength },
      ));
      continue;
    }
    const actual = await sha256AssetId(bytes);
    if (actual !== asset.id) {
      diagnostics.push(diagnostic(
        "tabletop-document.media.digest-mismatch",
        `/assets/${index}/id`,
        { actual, expected: asset.id },
      ));
    }
  }
  return diagnostics.sort((left, right) => left.location.localeCompare(right.location)
    || left.code.localeCompare(right.code));
}
