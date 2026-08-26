import {
  loadPbres,
  planEmbeddedResourceAdmission,
  type SystemPackageDocument,
} from "@pbdh/contract-runtime";

import type { ResourcePackageRepository } from "./resource-package-repository.ts";
import { validateResourcePackageCandidate } from "./resource-package-validator.ts";

export type EmbeddedResourceInstallResult = {
  installedPackageIds: string[];
  unchangedPackageIds: string[];
  pendingUpdates: Array<{
    packageId: string;
    action: "required-update" | "prompt-update";
  }>;
  rejected: Array<{ packageId: string; code: string }>;
};

export async function installMissingEmbeddedResourcePackages(input: {
  systemPackage: SystemPackageDocument;
  systemPackageBaseUrl: string;
  repository: ResourcePackageRepository;
  fetchFile?: typeof fetch;
}): Promise<EmbeddedResourceInstallResult> {
  const fetchFile = input.fetchFile ?? fetch;
  const stored = await input.repository.list();
  const localById = new Map(stored.map((candidate) => [candidate.document.package.id, candidate]));
  const result: EmbeddedResourceInstallResult = {
    installedPackageIds: [],
    unchangedPackageIds: [],
    pendingUpdates: [],
    rejected: [],
  };

  for (const embedded of input.systemPackage.embeddedResources) {
    const local = localById.get(embedded.packageId);
    const admission = planEmbeddedResourceAdmission({
      embedded,
      local: local && {
        version: local.document.package.version,
        snapshotDigest: local.document.snapshotDigest,
      },
    });
    if (admission.action === "no-op" || admission.action === "keep-local") {
      result.unchangedPackageIds.push(embedded.packageId);
      continue;
    }
    if (admission.action === "reject") {
      result.rejected.push({ packageId: embedded.packageId, code: admission.code });
      continue;
    }
    if (admission.action === "required-update" || admission.action === "prompt-update") {
      result.pendingUpdates.push({ packageId: embedded.packageId, action: admission.action });
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
    if (
      document.package.id !== embedded.packageId
      || document.package.version !== embedded.version
      || document.snapshotDigest !== embedded.snapshotDigest
    ) {
      throw new Error(`系统包内置资源身份不匹配：${embedded.path}`);
    }
    await input.repository.replace(loaded.candidate, "bundled");
    result.installedPackageIds.push(embedded.packageId);
  }

  return result;
}

function resolvePackageUrl(baseUrl: string, relativePath: string): string {
  return `${baseUrl.replace(/\/$/u, "")}/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}
