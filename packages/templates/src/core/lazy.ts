import type { TemplateCoreCapability } from "./types.ts";

export type TemplateCoreLoaderEntry = {
  id: string;
  version: string;
  load: () => Promise<TemplateCoreCapability<any>>;
};

export const templateCoreLoaders: readonly TemplateCoreLoaderEntry[] = [
  { id: "敌人", version: "1.0.0", load: () => import("./adversary/1.0.0/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.0.1", load: () => import("./adversary/1.0.1/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.0.2", load: () => import("./adversary/1.0.2/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.0.3", load: () => import("./adversary/1.0.3/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.0.4", load: () => import("./adversary/1.0.4/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.0.5", load: () => import("./adversary/1.0.5/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "敌人", version: "1.1.0", load: () => import("./adversary/1.1.0/capability.ts").then((module) => module.adversaryTemplate) },
  { id: "种族", version: "1.0.0", load: () => import("./ancestry/1.0.0/capability.ts").then((module) => module.ancestryTemplate) },
  { id: "种族", version: "1.0.1", load: () => import("./ancestry/1.0.1/capability.ts").then((module) => module.ancestryTemplate) },
  { id: "种族", version: "1.1.0", load: () => import("./ancestry/1.1.0/capability.ts").then((module) => module.ancestryTemplate) },
  { id: "护甲", version: "1.0.0", load: () => import("./armor/1.0.0/capability.ts").then((module) => module.armorTemplate) },
  { id: "护甲", version: "1.0.1", load: () => import("./armor/1.0.1/capability.ts").then((module) => module.armorTemplate) },
  { id: "护甲", version: "1.1.0", load: () => import("./armor/1.1.0/capability.ts").then((module) => module.armorTemplate) },
  { id: "社群", version: "1.0.0", load: () => import("./community/1.0.0/capability.ts").then((module) => module.communityTemplate) },
  { id: "社群", version: "1.0.1", load: () => import("./community/1.0.1/capability.ts").then((module) => module.communityTemplate) },
  { id: "社群", version: "1.1.0", load: () => import("./community/1.1.0/capability.ts").then((module) => module.communityTemplate) },
  { id: "领域卡", version: "1.0.0", load: () => import("./domain/1.0.0/capability.ts").then((module) => module.domainTemplate) },
  { id: "领域卡", version: "1.0.1", load: () => import("./domain/1.0.1/capability.ts").then((module) => module.domainTemplate) },
  { id: "领域卡", version: "1.1.0", load: () => import("./domain/1.1.0/capability.ts").then((module) => module.domainTemplate) },
  { id: "环境", version: "1.0.0", load: () => import("./environment/1.0.0/capability.ts").then((module) => module.environmentTemplate) },
  { id: "环境", version: "1.0.1", load: () => import("./environment/1.0.1/capability.ts").then((module) => module.environmentTemplate) },
  { id: "环境", version: "1.0.2", load: () => import("./environment/1.0.2/capability.ts").then((module) => module.environmentTemplate) },
  { id: "环境", version: "1.0.3", load: () => import("./environment/1.0.3/capability.ts").then((module) => module.environmentTemplate) },
  { id: "环境", version: "1.1.0", load: () => import("./environment/1.1.0/capability.ts").then((module) => module.environmentTemplate) },
  { id: "自由", version: "1.0.0", load: () => import("./free/1.0.0/capability.ts").then((module) => module.freeTemplate) },
  { id: "自由", version: "1.0.1", load: () => import("./free/1.0.1/capability.ts").then((module) => module.freeTemplate) },
  { id: "自由", version: "1.0.2", load: () => import("./free/1.0.2/capability.ts").then((module) => module.freeTemplate) },
  { id: "自由", version: "1.1.0", load: () => import("./free/1.1.0/capability.ts").then((module) => module.freeTemplate) },
  { id: "物品", version: "1.0.0", load: () => import("./item/1.0.0/capability.ts").then((module) => module.itemTemplate) },
  { id: "物品", version: "1.0.1", load: () => import("./item/1.0.1/capability.ts").then((module) => module.itemTemplate) },
  { id: "物品", version: "1.1.0", load: () => import("./item/1.1.0/capability.ts").then((module) => module.itemTemplate) },
  { id: "职业", version: "1.0.0", load: () => import("./profession/1.0.0/capability.ts").then((module) => module.professionTemplate) },
  { id: "职业", version: "1.0.1", load: () => import("./profession/1.0.1/capability.ts").then((module) => module.professionTemplate) },
  { id: "职业", version: "1.1.0", load: () => import("./profession/1.1.0/capability.ts").then((module) => module.professionTemplate) },
  { id: "子职业", version: "1.0.0", load: () => import("./subclass/1.0.0/capability.ts").then((module) => module.subclassTemplate) },
  { id: "子职业", version: "1.0.1", load: () => import("./subclass/1.0.1/capability.ts").then((module) => module.subclassTemplate) },
  { id: "子职业", version: "1.1.0", load: () => import("./subclass/1.1.0/capability.ts").then((module) => module.subclassTemplate) },
  { id: "武器", version: "1.0.0", load: () => import("./weapon/1.0.0/capability.ts").then((module) => module.weaponTemplate) },
  { id: "武器", version: "1.0.1", load: () => import("./weapon/1.0.1/capability.ts").then((module) => module.weaponTemplate) },
  { id: "武器", version: "1.1.0", load: () => import("./weapon/1.1.0/capability.ts").then((module) => module.weaponTemplate) },
];

export function createTemplateCoreLoader(entries: readonly TemplateCoreLoaderEntry[]) {
  const loaders = new Map<string, TemplateCoreLoaderEntry>();
  const pending = new Map<string, Promise<TemplateCoreCapability<any>>>();
  for (const entry of entries) {
    const key = `${entry.id}@${entry.version}`;
    if (loaders.has(key)) throw new Error(`Duplicate Template version: ${key}`);
    loaders.set(key, entry);
  }
  return (id: string, version: string): Promise<TemplateCoreCapability<any> | undefined> => {
    const key = `${id}@${version}`;
    const entry = loaders.get(key);
    if (!entry) return Promise.resolve(undefined);
    const existing = pending.get(key);
    if (existing) return existing;
    const result = Promise.resolve().then(entry.load).then((template) => {
      if (template.id !== id || template.version !== version) throw new Error(`Template identity mismatch: ${key}`);
      return template;
    }).catch((error: unknown) => {
      pending.delete(key);
      throw error;
    });
    pending.set(key, result);
    return result;
  };
}

export const loadTemplateCore = createTemplateCoreLoader(templateCoreLoaders);

export const currentTemplateReferences = ["敌人", "种族", "护甲", "社群", "领域卡", "环境", "自由", "物品", "职业", "子职业", "武器"]
  .map((id) => ({ id, version: "1.1.0" }));

export function loadCurrentTemplateCore(id: string) {
  const reference = currentTemplateReferences.find((entry) => entry.id === id);
  return reference ? loadTemplateCore(reference.id, reference.version) : Promise.resolve(undefined);
}
