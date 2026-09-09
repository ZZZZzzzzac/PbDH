import type { TemplateCoreCapability } from "./types.ts";
import { TemplateRegistry } from "./registry.ts";
import type { TemplateUpgradeRow, TemplateUpgradeSelection } from "./index.ts";

export type TemplateCoreLoaderEntry = {
  id: string;
  version: string;
  fromVersions?: readonly string[];
  load: () => Promise<TemplateCoreCapability<any>>;
};

export const templateCoreLoaders: readonly TemplateCoreLoaderEntry[] = [
  { id: "敌人", version: "1.0.0", fromVersions: [], load: () => import("./adversary/1.0.0/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.0.1", fromVersions: ["1.0.0"], load: () => import("./adversary/1.0.1/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.0.2", fromVersions: ["1.0.1"], load: () => import("./adversary/1.0.2/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.0.3", fromVersions: ["1.0.2"], load: () => import("./adversary/1.0.3/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.0.4", fromVersions: ["1.0.3"], load: () => import("./adversary/1.0.4/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.0.5", fromVersions: ["1.0.4"], load: () => import("./adversary/1.0.5/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.1.0", fromVersions: ["1.0.5"], load: () => import("./adversary/1.1.0/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "种族", version: "1.0.0", fromVersions: [], load: () => import("./ancestry/1.0.0/capability.ts").then((module) => module.ancestryTemplate) },
  { id: "种族", version: "1.0.1", fromVersions: ["1.0.0"], load: () => import("./ancestry/1.0.1/capability.ts").then((module) => module.ancestryTemplate) },
  { id: "种族", version: "1.1.0", fromVersions: ["1.0.1"], load: () => import("./ancestry/1.1.0/capability.ts").then((module) => module.ancestryTemplate) },
  { id: "护甲", version: "1.0.0", fromVersions: [], load: () => import("./armor/1.0.0/capability.ts").then((module) => module.armorTemplate) },
  { id: "护甲", version: "1.0.1", fromVersions: ["1.0.0"], load: () => import("./armor/1.0.1/capability.ts").then((module) => module.armorTemplate) },
  { id: "护甲", version: "1.1.0", fromVersions: ["1.0.1"], load: () => import("./armor/1.1.0/capability.ts").then((module) => module.armorTemplate) },
  { id: "社群", version: "1.0.0", fromVersions: [], load: () => import("./community/1.0.0/capability.ts").then((module) => module.communityTemplate) },
  { id: "社群", version: "1.0.1", fromVersions: ["1.0.0"], load: () => import("./community/1.0.1/capability.ts").then((module) => module.communityTemplate) },
  { id: "社群", version: "1.1.0", fromVersions: ["1.0.1"], load: () => import("./community/1.1.0/capability.ts").then((module) => module.communityTemplate) },
  { id: "领域卡", version: "1.0.0", fromVersions: [], load: () => import("./domain/1.0.0/capability.ts").then((module) => module.domainTemplate) },
  { id: "领域卡", version: "1.0.1", fromVersions: ["1.0.0"], load: () => import("./domain/1.0.1/capability.ts").then((module) => module.domainTemplate) },
  { id: "领域卡", version: "1.1.0", fromVersions: ["1.0.1"], load: () => import("./domain/1.1.0/capability.ts").then((module) => module.domainTemplate) },
  { id: "环境", version: "1.0.0", fromVersions: [], load: () => import("./environment/1.0.0/capability.ts").then((module) => module.environmentTemplate) },
  { id: "环境", version: "1.0.1", fromVersions: ["1.0.0"], load: () => import("./environment/1.0.1/capability.ts").then((module) => module.environmentTemplate) },
  { id: "环境", version: "1.0.2", fromVersions: ["1.0.1"], load: () => import("./environment/1.0.2/capability.ts").then((module) => module.environmentTemplate) },
  { id: "环境", version: "1.0.3", fromVersions: ["1.0.2"], load: () => import("./environment/1.0.3/capability.ts").then((module) => module.environmentTemplate) },
  { id: "环境", version: "1.1.0", fromVersions: ["1.0.3"], load: () => import("./environment/1.1.0/capability.ts").then((module) => module.environmentTemplate) },
  { id: "自由", version: "1.0.0", fromVersions: [], load: () => import("./free/1.0.0/capability.ts").then((module) => module.freeTemplate) },
  { id: "自由", version: "1.0.1", fromVersions: ["1.0.0"], load: () => import("./free/1.0.1/capability.ts").then((module) => module.freeTemplate) },
  { id: "自由", version: "1.0.2", fromVersions: ["1.0.1"], load: () => import("./free/1.0.2/capability.ts").then((module) => module.freeTemplate) },
  { id: "自由", version: "1.1.0", fromVersions: ["1.0.2"], load: () => import("./free/1.1.0/capability.ts").then((module) => module.freeTemplate) },
  { id: "物品", version: "1.0.0", fromVersions: [], load: () => import("./item/1.0.0/capability.ts").then((module) => module.itemTemplate) },
  { id: "物品", version: "1.0.1", fromVersions: ["1.0.0"], load: () => import("./item/1.0.1/capability.ts").then((module) => module.itemTemplate) },
  { id: "物品", version: "1.1.0", fromVersions: ["1.0.1"], load: () => import("./item/1.1.0/capability.ts").then((module) => module.itemTemplate) },
  { id: "职业", version: "1.0.0", fromVersions: [], load: () => import("./profession/1.0.0/capability.ts").then((module) => module.professionTemplate) },
  { id: "职业", version: "1.0.1", fromVersions: ["1.0.0"], load: () => import("./profession/1.0.1/capability.ts").then((module) => module.professionTemplate) },
  { id: "职业", version: "1.1.0", fromVersions: ["1.0.1"], load: () => import("./profession/1.1.0/capability.ts").then((module) => module.professionTemplate) },
  { id: "子职业", version: "1.0.0", fromVersions: [], load: () => import("./subclass/1.0.0/capability.ts").then((module) => module.subclassTemplate) },
  { id: "子职业", version: "1.0.1", fromVersions: ["1.0.0"], load: () => import("./subclass/1.0.1/capability.ts").then((module) => module.subclassTemplate) },
  { id: "子职业", version: "1.1.0", fromVersions: ["1.0.1"], load: () => import("./subclass/1.1.0/capability.ts").then((module) => module.subclassTemplate) },
  { id: "武器", version: "1.0.0", fromVersions: [], load: () => import("./weapon/1.0.0/capability.ts").then((module) => module.weaponTemplate) },
  { id: "武器", version: "1.0.1", fromVersions: ["1.0.0"], load: () => import("./weapon/1.0.1/capability.ts").then((module) => module.weaponTemplate) },
  { id: "武器", version: "1.1.0", fromVersions: ["1.0.1"], load: () => import("./weapon/1.1.0/capability.ts").then((module) => module.weaponTemplate) },
];

export function createTemplateCoreLoader(entries: readonly TemplateCoreLoaderEntry[]) {
  const loaders = new Map<string, TemplateCoreLoaderEntry>();
  const pending = new Map<string, Promise<TemplateCoreCapability<any>>>();
  const loaded = new Map<string, TemplateCoreCapability<any>>();
  for (const entry of entries) {
    const key = `${entry.id}@${entry.version}`;
    if (loaders.has(key)) throw new Error(`Duplicate Template version: ${key}`);
    loaders.set(key, entry);
  }
  const load = (id: string, version: string): Promise<TemplateCoreCapability<any> | undefined> => {
    const key = `${id}@${version}`;
    const entry = loaders.get(key);
    if (!entry) return Promise.resolve(undefined);
    const existing = pending.get(key);
    if (existing) return existing;
    const result = Promise.resolve().then(entry.load).then((template) => {
      if (template.id !== id || template.version !== version) throw new Error(`Template identity mismatch: ${key}`);
      loaded.set(key, template);
      return template;
    }).catch((error: unknown) => {
      pending.delete(key);
      throw error;
    });
    pending.set(key, result);
    return result;
  };
  return { load, read: (id: string, version: string) => loaded.get(`${id}@${version}`) };
}

const coreLoader = createTemplateCoreLoader(templateCoreLoaders);
export const loadTemplateCore = coreLoader.load;
export const readLoadedTemplateCore = coreLoader.read;

export const currentTemplateReferences = ["敌人", "种族", "护甲", "社群", "领域卡", "环境", "自由", "物品", "职业", "子职业", "武器"]
  .map((id) => ({ id, version: "1.1.0" }));

export function loadCurrentTemplateCore(id: string) {
  const reference = currentTemplateReferences.find((entry) => entry.id === id);
  return reference ? loadTemplateCore(reference.id, reference.version) : Promise.resolve(undefined);
}

const knownTemplateVersions = new Set(templateCoreLoaders.map((entry) => `${entry.id}@${entry.version}`));

export function templateResourceTitle(id: string, version: string, data: unknown): string | undefined {
  if (!knownTemplateVersions.has(`${id}@${version}`)) return undefined;
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const fields = data as Record<string, unknown>;
  const value = fields.名称 || (id === "敌人" ? fields.原文 : undefined)
    || `未命名${id === "自由" ? "自由资源" : id}`;
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function templateUpgradeTargets(id: string, fromVersion: string): readonly string[] {
  const targets: string[] = [];
  const visited = new Set<string>();
  let version = fromVersion;
  while (true) {
    if (visited.has(version)) throw new Error(`Template upgrade cycle: ${id}@${version}`);
    visited.add(version);
    const candidates = templateCoreLoaders.filter((entry) => entry.id === id && entry.fromVersions?.includes(version));
    if (!candidates.length) return targets;
    if (candidates.length !== 1) throw new Error(`Ambiguous Template upgrade: ${id}@${version}`);
    version = candidates[0]!.version;
    targets.push(version);
  }
}

export function listTemplateUpgradeRows(resources: readonly { template: { id: string; version: string } }[]): readonly TemplateUpgradeRow[] {
  const counts = new Map<string, { templateId: string; currentVersion: string; count: number }>();
  for (const resource of resources) {
    const key = `${resource.template.id}@${resource.template.version}`;
    const current = counts.get(key);
    counts.set(key, { templateId: resource.template.id, currentVersion: resource.template.version, count: (current?.count ?? 0) + 1 });
  }
  return [...counts.values()].map((row) => ({ ...row, targetVersions: templateUpgradeTargets(row.templateId, row.currentVersion) }))
    .filter((row) => row.targetVersions.length > 0);
}

export async function upgradeTemplateResources<T extends { template: { id: string; version: string }; data: unknown }>(
  resources: readonly T[], selections: readonly TemplateUpgradeSelection[],
): Promise<T[]> {
  const targets = new Map(selections.map((selection) => [`${selection.templateId}@${selection.currentVersion}`, selection.targetVersion]));
  const result: T[] = [];
  for (const resource of resources) {
    const target = targets.get(`${resource.template.id}@${resource.template.version}`);
    if (!target || target === resource.template.version) { result.push(resource); continue; }
    const path = templateUpgradeTargets(resource.template.id, resource.template.version);
    const end = path.indexOf(target);
    if (end < 0) throw new Error(`Invalid Template upgrade: ${resource.template.id}@${resource.template.version} -> ${target}`);
    if (!resource.data || typeof resource.data !== "object" || Array.isArray(resource.data)) {
      throw new Error(`Template data must be an object: ${resource.template.id}@${resource.template.version}`);
    }
    const capabilities = await Promise.all(path.slice(0, end + 1).map(async (version) => {
      const capability = await loadTemplateCore(resource.template.id, version);
      if (!capability) throw new Error(`Missing Template upgrade: ${resource.template.id}@${version}`);
      return capability;
    }));
    const registry = new TemplateRegistry(capabilities);
    result.push({ ...resource, template: { ...resource.template, version: target },
      data: registry.upgradeData(resource.template.id, resource.template.version, target, resource.data as Record<string, unknown>) });
  }
  return result;
}
