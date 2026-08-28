import {
  computeResourcePackageVersionContentHash,
  type ResourcePackageLogicalDocument,
} from "./resource-package.ts";
import { compareSemVer, parseSemVer } from "./semver.ts";

export type ResourcePackageChangeLevel = "none" | "patch" | "minor" | "major";

export type ResourcePackageVersionReason = {
  code: string;
  level: Exclude<ResourcePackageChangeLevel, "none">;
  subject: string;
};

export type ResourcePackageVersionBaseline = {
  packageId: string;
  version: string;
  snapshotDigest: string;
  contentHash: string;
  contractVersion: string;
  resources: Array<{
    id: string;
    template: { id: string; version: string };
  }>;
  targets: Array<{ systemPackageId: string; version: string }>;
};

export type ResourcePackageVersionClassification = {
  level: ResourcePackageChangeLevel;
  minimumVersion: string;
  reasons: ResourcePackageVersionReason[];
};

const levelRank: Record<ResourcePackageChangeLevel, number> = {
  none: 0,
  patch: 1,
  minor: 2,
  major: 3,
};

export async function createResourcePackageVersionBaseline(
  document: ResourcePackageLogicalDocument,
): Promise<ResourcePackageVersionBaseline> {
  return {
    packageId: document.package.id,
    version: document.package.version,
    snapshotDigest: document.snapshotDigest,
    contentHash: await computeResourcePackageVersionContentHash(document),
    contractVersion: document.contractVersion,
    resources: document.resources.map((resource) => ({
      id: resource.id,
      template: { ...resource.template },
    })),
    targets: document.targets.map((target) => ({ ...target })),
  };
}

export async function classifyResourcePackageVersionChange(
  baseline: ResourcePackageVersionBaseline,
  document: ResourcePackageLogicalDocument,
): Promise<ResourcePackageVersionClassification> {
  if (document.package.id !== baseline.packageId) {
    throw new Error("Resource Package version comparison requires the same Package ID");
  }
  if (await computeResourcePackageVersionContentHash(document) === baseline.contentHash) {
    return { level: "none", minimumVersion: baseline.version, reasons: [] };
  }

  const reasons: ResourcePackageVersionReason[] = [];
  const addReason = (
    level: Exclude<ResourcePackageChangeLevel, "none">,
    code: string,
    subject: string,
  ) => reasons.push({ code, level, subject });

  if (semverMajor(document.contractVersion) !== semverMajor(baseline.contractVersion)) {
    addReason("major", "resource-package.version.contract-major-changed", document.contractVersion);
  }

  const currentResources = new Map(document.resources.map((resource) => [resource.id, resource]));
  const baselineResourceIds = new Set(baseline.resources.map((resource) => resource.id));
  for (const previous of baseline.resources) {
    const current = currentResources.get(previous.id);
    if (!current) {
      addReason("major", "resource-package.version.resource-removed", previous.id);
      continue;
    }
    if (current.template.id !== previous.template.id
      || semverMajor(current.template.version) !== semverMajor(previous.template.version)) {
      addReason("major", "resource-package.version.resource-template-incompatible", previous.id);
    } else if (current.template.version !== previous.template.version) {
      addReason("patch", "resource-package.version.resource-template-compatible", previous.id);
    }
  }
  for (const resource of document.resources) {
    if (!baselineResourceIds.has(resource.id)) {
      addReason("minor", "resource-package.version.resource-added", resource.id);
    }
  }

  classifyTargetChanges(baseline.targets, document.targets, addReason);
  if (reasons.length === 0) {
    addReason("patch", "resource-package.version.content-changed", baseline.packageId);
  }
  reasons.sort((left, right) =>
    levelRank[right.level] - levelRank[left.level]
    || compareText(left.code, right.code)
    || compareText(left.subject, right.subject));
  const level = reasons.reduce<Exclude<ResourcePackageChangeLevel, "none">>(
    (highest, reason) => levelRank[reason.level] > levelRank[highest] ? reason.level : highest,
    "patch",
  );
  return {
    level,
    minimumVersion: bumpVersion(baseline.version, level),
    reasons,
  };
}

export function resourcePackageVersionMeetsMinimum(
  selectedVersion: string,
  minimumVersion: string,
): boolean {
  if (!parseSemVer(selectedVersion) || !parseSemVer(minimumVersion)) return false;
  return compareSemVer(selectedVersion, minimumVersion) >= 0;
}

function classifyTargetChanges(
  previousTargets: ResourcePackageVersionBaseline["targets"],
  currentTargets: ResourcePackageLogicalDocument["targets"],
  addReason: (
    level: Exclude<ResourcePackageChangeLevel, "none">,
    code: string,
    subject: string,
  ) => void,
): void {
  const matchedPrevious = new Set<number>();
  const matchedCurrent = new Set<number>();
  previousTargets.forEach((previous, previousIndex) => {
    const exact = currentTargets.findIndex((current, index) =>
      !matchedCurrent.has(index)
      && current.systemPackageId === previous.systemPackageId
      && current.version === previous.version);
    if (exact >= 0) {
      matchedPrevious.add(previousIndex);
      matchedCurrent.add(exact);
    }
  });
  previousTargets.forEach((previous, previousIndex) => {
    if (matchedPrevious.has(previousIndex)) return;
    const compatible = currentTargets.findIndex((current, index) =>
      !matchedCurrent.has(index)
      && current.systemPackageId === previous.systemPackageId
      && semverMajor(current.version) === semverMajor(previous.version));
    if (compatible >= 0) {
      matchedPrevious.add(previousIndex);
      matchedCurrent.add(compatible);
      addReason("patch", "resource-package.version.target-compatible-changed", previous.systemPackageId);
    }
  });
  previousTargets.forEach((previous, previousIndex) => {
    if (matchedPrevious.has(previousIndex)) return;
    const sameSystem = currentTargets.findIndex((current, index) =>
      !matchedCurrent.has(index) && current.systemPackageId === previous.systemPackageId);
    if (sameSystem >= 0) {
      matchedPrevious.add(previousIndex);
      matchedCurrent.add(sameSystem);
      addReason("major", "resource-package.version.target-major-changed", previous.systemPackageId);
    }
  });
  previousTargets.forEach((previous, previousIndex) => {
    if (!matchedPrevious.has(previousIndex)) {
      addReason("major", "resource-package.version.target-removed", previous.systemPackageId);
    }
  });
  currentTargets.forEach((target, index) => {
    if (!matchedCurrent.has(index)) {
      addReason("minor", "resource-package.version.target-added", `${target.systemPackageId}@${target.version}`);
    }
  });
}

function semverMajor(version: string): number {
  const parsed = parseSemVer(version);
  if (!parsed) throw new Error(`Invalid SemVer in Resource Package version comparison: ${version}`);
  return parsed.major;
}

function bumpVersion(
  version: string,
  level: Exclude<ResourcePackageChangeLevel, "none">,
): string {
  const parsed = parseSemVer(version);
  if (!parsed) throw new Error(`Invalid Resource Package version: ${version}`);
  if (level === "major") return `${parsed.major + 1}.0.0`;
  if (level === "minor") return `${parsed.major}.${parsed.minor + 1}.0`;
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
