import {
  loadSystemPackageDirectory,
  type NormalizedSystemPackage,
  type PortableDirectoryEntry,
} from "@pbdh/contract-runtime";

import { validateResourcePackageCandidate } from "./resources/resource-package-validator.ts";
import type { PackageIssue } from "./sheet-runtime/domain/systemPackage.ts";
import type { PackageVirtualFileSystem } from "./sheet-runtime/loaders/packageVfs.ts";
import { validateSystemPackageDocument } from "./system-package-validator.ts";

export type PlatformSystemPackageIngressResult =
  | { ok: true; package: NormalizedSystemPackage }
  | { ok: false; issues: PackageIssue[] };

export async function loadPlatformSystemPackageFromVfs(
  vfs: PackageVirtualFileSystem,
): Promise<PlatformSystemPackageIngressResult> {
  const entries: PortableDirectoryEntry[] = [];
  for (const path of vfs.listFiles()) {
    if (path !== "system.json" && !/^resources\/[a-z0-9][a-z0-9-]*\.pbres$/u.test(path)) continue;
    const read = vfs.readBytes(path);
    if (!read.ok) return { ok: false, issues: [read.issue] };
    entries.push({ path, kind: "file", bytes: read.value });
  }

  const result = await loadSystemPackageDirectory(entries, {
    validateSystem: validateSystemPackageDocument,
    validateResource: validateResourcePackageCandidate,
  });
  if (!result.candidate) {
    return {
      ok: false,
      issues: result.diagnostics.map((diagnostic) => ({
        level: diagnostic.severity === "error" ? "fatal" : "warning",
        code: diagnostic.code,
        text: formatDiagnostic(diagnostic.code, diagnostic.location),
        ...(diagnostic.location ? { path: diagnostic.location } : {}),
      })),
    };
  }
  return { ok: true, package: result.candidate };
}

function formatDiagnostic(code: string, location: string): string {
  if (code === "system-package.archive.root.missing") {
    return "System Package 缺少当前 Contract 所需的 system.json。";
  }
  return `System Package Contract 校验失败：${code}${location ? ` (${location})` : ""}`;
}
