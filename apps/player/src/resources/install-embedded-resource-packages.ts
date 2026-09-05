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

export async function installMissingEmbeddedResourcePackages(input: {
  systemPackage: SystemPackageDocument;
  embeddedResourceIndex: Array<{
    path: string;
    packageId: string;
  }>;
  systemPackageBaseUrl: string;
  repository: ResourcePackageRepository;
  fetchFile?: typeof fetch;
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
  for (const embedded of input.embeddedResourceIndex) {
    if (!declaredPaths.has(embedded.path)) {
      throw new Error(`内嵌资源索引引用了未声明路径：${embedded.path}`);
    }
    const local = localById.get(embedded.packageId);
    if (local && local.source !== "bundled") {
      result.unchangedPackageIds.push(embedded.packageId);
      continue;
    }
    const response = await fetchFile(resolvePackageUrl(input.systemPackageBaseUrl, embedded.path));
    if (!response.ok) {
      throw new Error(`无法读取系统包内置资源 ${embedded.path}（HTTP ${response.status}）`);
    }
    const loaded = await loadPbres(
      new Uint8Array(await response.arrayBuffer()),
      validateResourcePackageCandidate,
    );
    if (!loaded.candidate) {
      throw new Error(loaded.diagnostics.map((diagnostic) => diagnostic.code).join("\n"));
    }
    const document = loaded.candidate.document;
    if (local?.document.snapshotDigest === document.snapshotDigest) {
      result.unchangedPackageIds.push(document.package.id);
      continue;
    }
    await input.repository.replace(systemPackageId, loaded.candidate, "bundled");
    result.installedPackageIds.push(document.package.id);
  }

  return result;
}

function resolvePackageUrl(baseUrl: string, relativePath: string): string {
  return `${baseUrl.replace(/\/$/u, "")}/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}
