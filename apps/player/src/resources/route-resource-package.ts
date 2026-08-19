import {
  isSemVerInRange,
  parseSemVer,
  type ResourcePackageLogicalDocument,
  type SystemPackageDocument,
} from "@pbdh/contract-runtime";

type Resource = ResourcePackageLogicalDocument["resources"][number];

export type RoutedResource = {
  resource: Resource;
  destination: "native" | "other-resources";
  nativeEntry?: { id: string; label: string };
  reason?: "no-targets" | "target-mismatch" | "template-incompatible";
};

export function routeResourcePackage(input: {
  currentSystem: SystemPackageDocument;
  resourcePackage: ResourcePackageLogicalDocument;
}): RoutedResource[] {
  const currentVersion = parseSemVer(input.currentSystem.package.version);
  if (!currentVersion) throw new Error(`Invalid current System Package version: ${input.currentSystem.package.version}`);
  const targets = input.resourcePackage.targets;
  const targetMatches = targets.some((target) => {
    const targetVersion = parseSemVer(target.version);
    return target.systemPackageId === input.currentSystem.package.id
      && targetVersion?.major === currentVersion.major;
  });
  if (!targetMatches) {
    const reason = targets.length === 0 ? "no-targets" : "target-mismatch";
    return input.resourcePackage.resources.map((resource) => ({
      resource,
      destination: "other-resources",
      reason,
    }));
  }

  return input.resourcePackage.resources.map((resource) => {
    const compatibility = input.currentSystem.resourceCompatibility.find((candidate) =>
      candidate.templateId === resource.template.id
      && isSemVerInRange(resource.template.version, candidate.versionRange));
    return compatibility
      ? {
        resource,
        destination: "native",
        nativeEntry: compatibility.nativeEntry,
      }
      : {
        resource,
        destination: "other-resources",
        reason: "template-incompatible",
      };
  });
}
