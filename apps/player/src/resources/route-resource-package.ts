import {
  isSemVerInRange,
  type ResourcePackageLogicalDocument,
  type SystemPackageDocument,
} from "@pbdh/contract-runtime";

type Resource = ResourcePackageLogicalDocument["resources"][number];

export type RoutedResource = {
  resource: Resource;
  destination: "native" | "other-resources";
  nativeEntry?: { id: string; label: string };
  reason?: "template-incompatible";
};

export function routeResourcePackage(input: {
  currentSystem: SystemPackageDocument;
  resourcePackage: ResourcePackageLogicalDocument;
}): RoutedResource[] {
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
