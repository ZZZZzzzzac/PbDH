import {
  loadPbres,
  type SystemPackageDocument,
} from "@pbdh/contract-runtime";

import type { ResourcePackageRepository } from "./resource-package-repository.ts";
import { validateResourcePackageCandidate } from "./resource-package-validator.ts";

export type EmbeddedResourceInstallResult = {
  installedPackageIds: string[];
  unchangedPackageIds: string[];
};

export type EmbeddedResourceInstallProgress = {
  completed: number;
  total: number;
};

export async function installMissingEmbeddedResourcePackages(input: {
  systemPackage: SystemPackageDocument;
  embeddedResourceIndex: Array<{
    path: string;
    packageId: string;
    snapshotDigest?: string;
  }>;
  systemPackageBaseUrl: string;
  releaseVersion?: string;
  repository: ResourcePackageRepository;
  fetchFile?: typeof fetch;
  onProgress?: (progress: EmbeddedResourceInstallProgress) => void;
}): Promise<EmbeddedResourceInstallResult> {
  const fetchFile = input.fetchFile ?? fetch;
  const systemPackageId = input.systemPackage.package.id;
  const stored = await input.repository.list(systemPackageId);
  const localById = new Map(stored.map((candidate) => [candidate.document.package.id, candidate]));
  const result: EmbeddedResourceInstallResult = {
    installedPackageIds: [],
    unchangedPackageIds: [],
  };

  const declaredPaths = new Set(input.systemPackage.embeddedResources.map(({ path }) => path));
  const indexedPaths = new Set(input.embeddedResourceIndex.map(({ path }) => path));
  for (const path of declaredPaths) {
    if (!indexedPaths.has(path)) throw new Error(`内嵌资源缺少构建索引：${path}`);
  }
  const total = input.embeddedResourceIndex.length;
  input.onProgress?.({ completed: 0, total });
  for (const [index, embedded] of input.embeddedResourceIndex.entries()) {
    if (!declaredPaths.has(embedded.path)) {
      throw new Error(`内嵌资源索引引用了未声明路径：${embedded.path}`);
    }
    const local = localById.get(embedded.packageId);
    if (local && local.source !== "bundled") {
      result.unchangedPackageIds.push(embedded.packageId);
      input.onProgress?.({ completed: index + 1, total });
      continue;
    }
    if (local && embedded.snapshotDigest === local.document.snapshotDigest) {
      result.unchangedPackageIds.push(embedded.packageId);
      input.onProgress?.({ completed: index + 1, total });
      continue;
    }
    const response = await fetchFile(resolvePackageUrl(
      input.systemPackageBaseUrl,
      embedded.path,
      input.releaseVersion,
    ));
    if (!response.ok) {
      throw new Error(`无法读取系统包内置资源 ${embedded.path}（HTTP ${response.status}）`);
    }
    const bytes = await readResponseBytes(response, (fraction) => {
      input.onProgress?.({ completed: index + fraction, total });
    });
    const loaded = await loadPbres(
      bytes,
      validateResourcePackageCandidate,
    );
    if (!loaded.candidate) {
      throw new Error(loaded.diagnostics.map((diagnostic) => diagnostic.code).join("\n"));
    }
    const document = loaded.candidate.document;
    if (local?.document.snapshotDigest === document.snapshotDigest) {
      result.unchangedPackageIds.push(document.package.id);
      input.onProgress?.({ completed: index + 1, total });
      continue;
    }
    await input.repository.replace(systemPackageId, loaded.candidate, "bundled");
    result.installedPackageIds.push(document.package.id);
    input.onProgress?.({ completed: index + 1, total });
  }

  return result;
}

async function readResponseBytes(
  response: Response,
  onProgress: (fraction: number) => void,
): Promise<Uint8Array> {
  const expectedBytes = Number(response.headers.get("content-length"));
  if (!response.body || !Number.isFinite(expectedBytes) || expectedBytes <= 0) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onProgress(1);
    return bytes;
  }

  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedBytes += value.byteLength;
    onProgress(Math.min(receivedBytes / expectedBytes, 1));
  }
  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress(1);
  return bytes;
}

function resolvePackageUrl(baseUrl: string, relativePath: string, releaseVersion?: string): string {
  const url = `${baseUrl.replace(/\/$/u, "")}/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
  return releaseVersion ? `${url}?v=${encodeURIComponent(releaseVersion)}` : url;
}
