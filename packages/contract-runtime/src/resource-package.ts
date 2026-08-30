import type { ContractDiagnostic } from "./index.ts";

const FAMILY = "resource-package";
export const RESOURCE_PACKAGE_VERSION = "1.0.0";
export const LEGACY_RESOURCE_PACKAGE_VERSION = "1.0.0-alpha.1";
const DIGEST_DOMAIN = "pbdh-resource-package-digest-v1";
const VERSION_CONTENT_DOMAIN = "pbdh-resource-package-version-content-v1";

type JsonValue = null | boolean | string | JsonValue[] | { [key: string]: JsonValue };

export type ResourceReplacement = {
  replacementId: string;
  targetResourceId: string;
};

export type ResourcePackageLogicalDocument = {
  contractVersion: typeof RESOURCE_PACKAGE_VERSION | typeof LEGACY_RESOURCE_PACKAGE_VERSION;
  package: {
    id: string;
    version: string;
    name: string;
    description: string;
  };
  targets: Array<{ systemPackageId: string; version: string }>;
  license: { label: string; declaration: string };
  publication?: {
    language: string;
    tags: string[];
    coverAssetId: string;
  };
  forkSource: JsonValue;
  assets: Array<{
    id: string;
    mediaType: "image/webp";
    byteLength: string;
    width: string;
    height: string;
  }>;
  resources: Array<{
    id: string;
    path: string;
    template: { id: string; version: string };
    presentation: ResourcePresentation;
    data: JsonValue;
    replacements?: ResourceReplacement[];
    media: Record<string, string>;
  }>;
  emptyDirectories: string[];
  snapshotDigest: string;
};

export type ResourcePresentation = {
  width: string;
  height: string;
  unit: "mm";
  mode: "text" | "split" | "image";
  fixedRatio: boolean;
};

export type ResourcePackageMedia = ReadonlyMap<string, Uint8Array>;

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

function assertValidUnicode(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) throw new Error("Invalid Unicode surrogate");
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new Error("Invalid Unicode surrogate");
    }
  }
}

function canonicalize(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    assertValidUnicode(value);
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const keys = Object.keys(value).sort();
  for (const key of keys) assertValidUnicode(key);
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key]!)}`)
    .join(",")}}`;
}

function normalizedDocument(document: ResourcePackageLogicalDocument): JsonValue {
  const { snapshotDigest: _snapshotDigest, ...content } = structuredClone(document);
  content.targets.sort((left, right) => {
    const idOrder = compareCodePoints(left.systemPackageId, right.systemPackageId);
    return idOrder || compareCodePoints(left.version, right.version);
  });
  content.assets.sort((left, right) => compareCodePoints(left.id, right.id));
  content.resources.sort((left, right) => {
    const pathOrder = compareCodePoints(left.path, right.path);
    return pathOrder || compareCodePoints(left.id, right.id);
  });
  content.resources.forEach((resource) => resource.replacements?.sort((left, right) => {
    const idOrder = compareCodePoints(left.replacementId, right.replacementId);
    return idOrder || compareCodePoints(left.targetResourceId, right.targetResourceId);
  }));
  content.emptyDirectories.sort(compareCodePoints);
  return content as JsonValue;
}

function normalizedVersionContent(document: ResourcePackageLogicalDocument): JsonValue {
  const content = normalizedDocument(document) as Omit<ResourcePackageLogicalDocument, "snapshotDigest">;
  const { version: _version, ...packageIdentity } = content.package;
  content.package = packageIdentity as ResourcePackageLogicalDocument["package"];
  return content as JsonValue;
}

function encodeFrame(type: string, payload: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(type);
  const frame = new Uint8Array(4 + typeBytes.length + 8 + payload.length);
  const view = new DataView(frame.buffer);
  view.setUint32(0, typeBytes.length, false);
  frame.set(typeBytes, 4);
  view.setBigUint64(4 + typeBytes.length, BigInt(payload.length), false);
  frame.set(payload, 4 + typeBytes.length + 8);
  return frame;
}

function concatenate(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  return toHex(await crypto.subtle.digest("SHA-256", input.buffer));
}

export async function computeResourcePackageSnapshotDigest(
  document: ResourcePackageLogicalDocument,
  media: ResourcePackageMedia,
): Promise<string> {
  const encoder = new TextEncoder();
  const parts = [
    encodeFrame("domain", encoder.encode(DIGEST_DOMAIN)),
    encodeFrame("logical-document", encoder.encode(canonicalize(normalizedDocument(document)))),
  ];

  for (const asset of [...document.assets].sort((left, right) => compareCodePoints(left.id, right.id))) {
    const bytes = media.get(asset.id);
    if (!bytes) throw new Error(`Missing media bytes: ${asset.id}`);
    parts.push(encodeFrame("asset-id", encoder.encode(asset.id)));
    parts.push(encodeFrame("asset-bytes", bytes));
  }

  return `sha256:${await sha256(concatenate(parts))}`;
}

export async function computeResourcePackageVersionContentHash(
  document: ResourcePackageLogicalDocument,
): Promise<string> {
  const encoder = new TextEncoder();
  return `sha256:${await sha256(concatenate([
    encodeFrame("domain", encoder.encode(VERSION_CONTENT_DOMAIN)),
    encodeFrame("logical-content", encoder.encode(canonicalize(normalizedVersionContent(document)))),
  ]))}`;
}

function semanticDiagnostic(
  version: ResourcePackageLogicalDocument["contractVersion"],
  code: string,
  location: string,
  params: Record<string, unknown>,
): ContractDiagnostic {
  return { code, severity: "error", family: FAMILY, version, location, params };
}

function sortDiagnostics(diagnostics: ContractDiagnostic[]): ContractDiagnostic[] {
  return diagnostics.sort((left, right) => {
    const locationOrder = compareCodePoints(left.location, right.location);
    if (locationOrder !== 0) return locationOrder;
    return compareCodePoints(left.code, right.code);
  });
}

export async function validateResourcePackageSemantics(
  document: ResourcePackageLogicalDocument,
  media: ResourcePackageMedia,
): Promise<ContractDiagnostic[]> {
  const diagnostics: ContractDiagnostic[] = [];
  const resourceIds = new Set<string>();
  const targets = new Set<string>();
  const assetIds = new Set<string>();

  document.resources.forEach((resource, index) => {
    if (resourceIds.has(resource.id)) {
      diagnostics.push(semanticDiagnostic(document.contractVersion,
        "resource-package.resource-id.duplicate",
        `/resources/${index}/id`,
        { id: resource.id },
      ));
    }
    resourceIds.add(resource.id);
  });

  document.targets.forEach((target, index) => {
    const key = `${target.systemPackageId}@${target.version}`;
    if (targets.has(key)) {
      diagnostics.push(semanticDiagnostic(document.contractVersion,
        "resource-package.target.duplicate",
        `/targets/${index}`,
        { systemPackageId: target.systemPackageId, version: target.version },
      ));
    }
    targets.add(key);
  });

  for (const [index, asset] of document.assets.entries()) {
    if (assetIds.has(asset.id)) {
      diagnostics.push(semanticDiagnostic(document.contractVersion,
        "resource-package.asset-id.duplicate",
        `/assets/${index}/id`,
        { id: asset.id },
      ));
    }
    assetIds.add(asset.id);
    const bytes = media.get(asset.id);
    if (!bytes) {
      diagnostics.push(semanticDiagnostic(document.contractVersion,
        "resource-package.media.bytes-missing",
        `/assets/${index}/id`,
        { assetId: asset.id },
      ));
      continue;
    }
    const actualId = `sha256:${await sha256(bytes)}`;
    if (actualId !== asset.id) {
      diagnostics.push(semanticDiagnostic(document.contractVersion,
        "resource-package.media.digest-mismatch",
        `/assets/${index}/id`,
        { actual: actualId, expected: asset.id },
      ));
    }
    if (String(bytes.byteLength) !== asset.byteLength) {
      diagnostics.push(semanticDiagnostic(document.contractVersion,
        "resource-package.media.byte-length-mismatch",
        `/assets/${index}/byteLength`,
        { actual: String(bytes.byteLength), expected: asset.byteLength },
      ));
    }
  }

  if (document.publication && !assetIds.has(document.publication.coverAssetId)) {
    diagnostics.push(semanticDiagnostic(document.contractVersion,
      "resource-package.publication-cover.asset-undeclared",
      "/publication/coverAssetId",
      { assetId: document.publication.coverAssetId },
    ));
  }

  document.resources.forEach((resource, resourceIndex) => {
    const replacementIds = new Set<string>();
    for (const [replacementIndex, replacement] of (resource.replacements ?? []).entries()) {
      if (replacementIds.has(replacement.replacementId)) {
        diagnostics.push(semanticDiagnostic(document.contractVersion,
          "resource-package.replacement-id.duplicate",
          `/resources/${resourceIndex}/replacements/${replacementIndex}/replacementId`,
          { replacementId: replacement.replacementId },
        ));
      }
      replacementIds.add(replacement.replacementId);
      if (!resourceIds.has(replacement.targetResourceId)) {
        diagnostics.push(semanticDiagnostic(document.contractVersion,
          "resource-package.replacement-target.missing",
          `/resources/${resourceIndex}/replacements/${replacementIndex}/targetResourceId`,
          { targetResourceId: replacement.targetResourceId },
        ));
      }
    }
    for (const [slot, assetId] of Object.entries(resource.media)) {
      if (!assetIds.has(assetId)) {
        diagnostics.push(semanticDiagnostic(document.contractVersion,
          "resource-package.media.asset-undeclared",
          `/resources/${resourceIndex}/media/${slot.replaceAll("~", "~0").replaceAll("/", "~1")}`,
          { assetId },
        ));
      }
    }
  });

  if (diagnostics.length === 0) {
    const actual = await computeResourcePackageSnapshotDigest(document, media);
    if (actual !== document.snapshotDigest) {
      diagnostics.push(semanticDiagnostic(document.contractVersion,
        "resource-package.snapshot-digest.mismatch",
        "/snapshotDigest",
        { actual, expected: document.snapshotDigest },
      ));
    }
  }

  return sortDiagnostics(diagnostics);
}
