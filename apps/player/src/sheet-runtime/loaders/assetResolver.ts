import type { PackageIssue } from "../domain/systemPackage";
import type { PackageVirtualFileSystem } from "./packageVfs";
import { inferMimeType } from "../utils";

interface RuntimePackageAssetBase {
  路径: string;
  类型: string;
  sourceType?: "systemPackage" | "resourceExtension";
  sourceId?: string;
}

export type RuntimePackageAsset = RuntimePackageAssetBase & (
  | { bytes: Uint8Array; staticUrl?: never }
  | { bytes?: never; staticUrl: string }
);

export type AssetResolveResult =
  | {
      ok: true;
      path: string;
      bytes: Uint8Array;
      mimeType: string;
      objectUrl: string | null;
    }
  | { ok: false; issue: PackageIssue };

export interface AssetResolver {
  resolveAsset: (assetRef: string, mimeType?: string) => AssetResolveResult;
  revokeAll: () => void;
}

export function createAssetResolver(vfs: PackageVirtualFileSystem): AssetResolver {
  const objectUrls = new Set<string>();

  return {
    resolveAsset(assetRef, mimeType = inferMimeType(assetRef)) {
      const read = vfs.readBytes(assetRef);
      if (!read.ok) {
        return { ok: false, issue: read.issue };
      }

      const objectUrl = createObjectUrl(read.value, mimeType);
      if (objectUrl) {
        objectUrls.add(objectUrl);
      }

      return {
        ok: true,
        path: read.path,
        bytes: read.value,
        mimeType,
        objectUrl,
      };
    },

    revokeAll() {
      for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrls.clear();
    },
  };
}

export interface RuntimeAssetResolver {
  urls: Record<string, string>;
  revokeAll: () => void;
}

export function createRuntimeAssetResolver(assets: RuntimePackageAsset[]): RuntimeAssetResolver {
  const objectUrls = new Set<string>();
  const urls: Record<string, string> = {};

  for (const asset of assets) {
    if (asset.staticUrl) {
      urls[resourceAssetUrlKey(asset.sourceType, asset.sourceId, asset.路径)] = asset.staticUrl;
      continue;
    }
    if (!asset.bytes) continue;
    const objectUrl = createObjectUrl(asset.bytes, asset.类型);
    if (!objectUrl) {
      continue;
    }

    objectUrls.add(objectUrl);
    urls[resourceAssetUrlKey(asset.sourceType, asset.sourceId, asset.路径)] = objectUrl;
  }

  return {
    urls,
    revokeAll() {
      for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrls.clear();
    },
  };
}

export function resourceAssetUrlKey(sourceType: RuntimePackageAsset["sourceType"], sourceId: string | undefined, path: string): string {
  return sourceType === "resourceExtension" && sourceId
    ? `resource-extension:${encodeURIComponent(sourceId)}:${path}`
    : path;
}

function createObjectUrl(bytes: Uint8Array, mimeType: string): string | null {
  try {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  } catch {
    return null;
  }
}
