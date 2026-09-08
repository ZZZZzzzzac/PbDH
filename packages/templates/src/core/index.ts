import { adversaryTemplate } from "./adversary/1.0.0/capability.ts";
import { ancestryTemplate } from "./ancestry/1.0.0/capability.ts";
import { armorTemplate } from "./armor/1.0.0/capability.ts";
import { communityTemplate } from "./community/1.0.0/capability.ts";
import { domainTemplate } from "./domain/1.0.0/capability.ts";
import { environmentTemplate } from "./environment/1.0.0/capability.ts";
import { freeTemplate } from "./free/1.0.0/capability.ts";
import { itemTemplate } from "./item/1.0.0/capability.ts";
import { professionTemplate } from "./profession/1.0.0/capability.ts";
import { subclassTemplate } from "./subclass/1.0.0/capability.ts";
import { TemplateRegistry } from "./registry.ts";
import { weaponTemplate } from "./weapon/1.0.0/capability.ts";
import { adversaryTemplate as adversaryTemplate101 } from "./adversary/1.0.1/capability.ts";
import { adversaryTemplate as adversaryTemplate102 } from "./adversary/1.0.2/capability.ts";
import { adversaryTemplate as adversaryTemplate104 } from "./adversary/1.0.4/capability.ts";
import { adversaryTemplate as adversaryTemplate105 } from "./adversary/1.0.5/capability.ts";
import { adversaryTemplate as adversaryTemplate103 } from "./adversary/1.0.3/capability.ts";
import { ancestryTemplate as ancestryTemplate101 } from "./ancestry/1.0.1/capability.ts";
import { armorTemplate as armorTemplate101 } from "./armor/1.0.1/capability.ts";
import { communityTemplate as communityTemplate101 } from "./community/1.0.1/capability.ts";
import { domainTemplate as domainTemplate101 } from "./domain/1.0.1/capability.ts";
import { environmentTemplate as environmentTemplate101 } from "./environment/1.0.1/capability.ts";
import { environmentTemplate as environmentTemplate103 } from "./environment/1.0.3/capability.ts";
import { environmentTemplate as environmentTemplate102 } from "./environment/1.0.2/capability.ts";
import { freeTemplate as freeTemplate101 } from "./free/1.0.1/capability.ts";
import { freeTemplate as freeTemplate102 } from "./free/1.0.2/capability.ts";
import { itemTemplate as itemTemplate101 } from "./item/1.0.1/capability.ts";
import { professionTemplate as professionTemplate101 } from "./profession/1.0.1/capability.ts";
import { subclassTemplate as subclassTemplate101 } from "./subclass/1.0.1/capability.ts";
import { weaponTemplate as weaponTemplate101 } from "./weapon/1.0.1/capability.ts";

import { adversaryTemplate as adversaryTemplate110 } from "./adversary/1.1.0/capability.ts";
import { ancestryTemplate as ancestryTemplate110 } from "./ancestry/1.1.0/capability.ts";
import { armorTemplate as armorTemplate110 } from "./armor/1.1.0/capability.ts";
import { communityTemplate as communityTemplate110 } from "./community/1.1.0/capability.ts";
import { domainTemplate as domainTemplate110 } from "./domain/1.1.0/capability.ts";
import { environmentTemplate as environmentTemplate110 } from "./environment/1.1.0/capability.ts";
import { freeTemplate as freeTemplate110 } from "./free/1.1.0/capability.ts";
import { itemTemplate as itemTemplate110 } from "./item/1.1.0/capability.ts";
import { professionTemplate as professionTemplate110 } from "./profession/1.1.0/capability.ts";
import { subclassTemplate as subclassTemplate110 } from "./subclass/1.1.0/capability.ts";
import { weaponTemplate as weaponTemplate110 } from "./weapon/1.1.0/capability.ts";

export { adversaryTemplate } from "./adversary/1.0.0/capability.ts";
export type {
  AdversaryData,
  AdversaryFeature,
} from "./adversary/1.0.0/capability.ts";
export { ancestryTemplate } from "./ancestry/1.0.0/capability.ts";
export type { AncestryData, AncestryFeature } from "./ancestry/1.0.0/capability.ts";
export { armorTemplate } from "./armor/1.0.0/capability.ts";
export type { ArmorData } from "./armor/1.0.0/capability.ts";
export { communityTemplate } from "./community/1.0.0/capability.ts";
export type { CommunityData } from "./community/1.0.0/capability.ts";
export { domainTemplate } from "./domain/1.0.0/capability.ts";
export type { DomainData } from "./domain/1.0.0/capability.ts";
export { environmentTemplate } from "./environment/1.0.0/capability.ts";
export type { EnvironmentData, EnvironmentFeature } from "./environment/1.0.0/capability.ts";
export { freeTemplate } from "./free/1.0.0/capability.ts";
export type { FreeContentBlock, FreeData } from "./free/1.0.0/capability.ts";
export { itemTemplate } from "./item/1.0.0/capability.ts";
export type { ItemData } from "./item/1.0.0/capability.ts";
export { professionTemplate } from "./profession/1.0.0/capability.ts";
export type { ProfessionData } from "./profession/1.0.0/capability.ts";
export { subclassTemplate } from "./subclass/1.0.0/capability.ts";
export type { SubclassData } from "./subclass/1.0.0/capability.ts";
export { weaponTemplate } from "./weapon/1.0.0/capability.ts";
export type { WeaponData } from "./weapon/1.0.0/capability.ts";
export { TemplateRegistry } from "./registry.ts";
export type {
  MediaSlot,
  TabletopCommand,
  TabletopReplacement,
  TemplateCoreCapability,
  TemplateLifecycleState,
  TemplateProjection,
  TemplateUpgrade,
} from "./types.ts";

export const currentTemplates = Object.freeze([
  adversaryTemplate110,
  ancestryTemplate110,
  armorTemplate110,
  communityTemplate110,
  domainTemplate110,
  environmentTemplate110,
  freeTemplate110,
  itemTemplate110,
  professionTemplate110,
  subclassTemplate110,
  weaponTemplate110,
]);

export {
  adversaryTemplate110 as currentAdversaryTemplate,
  ancestryTemplate110 as currentAncestryTemplate,
  armorTemplate110 as currentArmorTemplate,
  communityTemplate110 as currentCommunityTemplate,
  domainTemplate110 as currentDomainTemplate,
  environmentTemplate110 as currentEnvironmentTemplate,
  freeTemplate110 as currentFreeTemplate,
  itemTemplate110 as currentItemTemplate,
  professionTemplate110 as currentProfessionTemplate,
  subclassTemplate110 as currentSubclassTemplate,
  weaponTemplate110 as currentWeaponTemplate,
};

export function currentTemplateFor(id: string) {
  return currentTemplates.find((template) => template.id === id);
}

export type TemplateUpgradeRow = {
  templateId: string;
  currentVersion: string;
  count: number;
  targetVersions: readonly string[];
};

export type TemplateUpgradeSelection = {
  templateId: string;
  currentVersion: string;
  targetVersion: string;
};

export function listTemplateUpgradeRows(resources: readonly {
  template: { id: string; version: string };
}[]): readonly TemplateUpgradeRow[] {
  const counts = new Map<string, { templateId: string; currentVersion: string; count: number }>();
  for (const resource of resources) {
    const key = `${resource.template.id}@${resource.template.version}`;
    const current = counts.get(key);
    counts.set(key, {
      templateId: resource.template.id,
      currentVersion: resource.template.version,
      count: (current?.count ?? 0) + 1,
    });
  }
  return [...counts.values()].map((row) => ({
    ...row,
    targetVersions: templateRegistry.upgradeTargets(row.templateId, row.currentVersion),
  })).filter((row) => row.targetVersions.length > 0);
}

export function upgradeTemplateResources<T extends {
  template: { id: string; version: string };
  data: unknown;
}>(resources: readonly T[], selections: readonly TemplateUpgradeSelection[]): T[] {
  const targets = new Map(selections.map((selection) => [
    `${selection.templateId}@${selection.currentVersion}`,
    selection.targetVersion,
  ]));
  return resources.map((resource) => {
    const targetVersion = targets.get(`${resource.template.id}@${resource.template.version}`);
    if (!targetVersion || targetVersion === resource.template.version) return resource;
    if (!templateRegistry.upgradeTargets(resource.template.id, resource.template.version).includes(targetVersion)) {
      throw new Error(`Invalid Template upgrade: ${resource.template.id}@${resource.template.version} -> ${targetVersion}`);
    }
    if (!resource.data || typeof resource.data !== "object" || Array.isArray(resource.data)) {
      throw new Error(`Template data must be an object: ${resource.template.id}@${resource.template.version}`);
    }
    return {
      ...resource,
      template: { ...resource.template, version: targetVersion },
      data: templateRegistry.upgradeData(
        resource.template.id,
        resource.template.version,
        targetVersion,
        resource.data as Record<string, unknown>,
      ),
    } as T;
  });
}

export const supportedTemplates = Object.freeze([
  adversaryTemplate110,
  ancestryTemplate110,
  armorTemplate110,
  communityTemplate110,
  domainTemplate110,
  environmentTemplate110,
  freeTemplate110,
  itemTemplate110,
  professionTemplate110,
  subclassTemplate110,
  weaponTemplate110,
  adversaryTemplate,
  ancestryTemplate,
  armorTemplate,
  communityTemplate,
  domainTemplate,
  environmentTemplate,
  freeTemplate,
  itemTemplate,
  professionTemplate,
  subclassTemplate,
  weaponTemplate,
  adversaryTemplate101,
  adversaryTemplate102,
  adversaryTemplate103,
  adversaryTemplate104,
  adversaryTemplate105,
  ancestryTemplate101,
  armorTemplate101,
  communityTemplate101,
  domainTemplate101,
  environmentTemplate101,
  environmentTemplate102,
  environmentTemplate103,
  freeTemplate101,
  freeTemplate102,
  itemTemplate101,
  professionTemplate101,
  subclassTemplate101,
  weaponTemplate101,
]);

export const templateRegistry = new TemplateRegistry(supportedTemplates);
