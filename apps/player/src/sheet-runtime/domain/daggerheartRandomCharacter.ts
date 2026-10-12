import { createEmptyCharacterData, type SheetValue } from "./characterData";
import { createCardInstance } from "./cardEngine";
import type { GeneratedCharacter } from "./characterGenerator";
import { applyDependencyResultToCharacterData, evaluateDependencies } from "./dependencyEngine";
import { composeResource } from "./resourceComposer";
import type { ResourceLibraryEntry } from "./resourceLibrary";
import { applyResourceSelectionToDraft } from "./resourceSelection";
import type { SystemPackage } from "./systemPackage";

const traits = ["agility", "strength", "finesse", "instinct", "presence", "knowledge"] as const;
const traitLabels = ["敏捷", "力量", "灵巧", "本能", "风度", "知识"] as const;

// 核心资源未包含推荐配置时使用已迁入的 Sheet 推荐值；来源见迁移文档。
const recommendations: Record<string, { traits: number[]; weapons: string[]; armor: string }> = {
  吟游诗人: { traits: [0, -1, 1, 0, 2, 1], weapons: ["刺剑", "小匕首"], armor: "填充布甲" },
  德鲁伊: { traits: [1, 0, 1, 2, -1, 0], weapons: ["短杖", "圆盾"], armor: "皮甲" },
  守护者: { traits: [1, 2, -1, 0, 1, 0], weapons: ["战斧"], armor: "链甲" },
  游侠: { traits: [2, 0, 1, 1, -1, 0], weapons: ["短弓"], armor: "皮甲" },
  游荡者: { traits: [1, -1, 2, 0, 1, 0], weapons: ["匕首", "小匕首"], armor: "填充布甲" },
  神使: { traits: [0, 2, 0, 1, 1, -1], weapons: ["圣斧", "圆盾"], armor: "链甲" },
  术士: { traits: [0, -1, 1, 2, 1, 0], weapons: ["双手法杖"], armor: "填充布甲" },
  战士: { traits: [2, 1, 0, 1, -1, 0], weapons: ["长剑"], armor: "链甲" },
  法师: { traits: [-1, 0, 0, 1, 1, 2], weapons: ["巨杖"], armor: "皮甲" },
};

export function generateDaggerheartCharacter(
  systemPackage: SystemPackage,
  corePackageIds: ReadonlySet<string>,
  random: () => number = Math.random,
): GeneratedCharacter {
  const entries = (id: string) => systemPackage.resourceLibraries?.find(library => library.ID === id)?.entries
    .filter(entry => corePackageIds.has(entry.resourceCopy?.source?.packageId ?? "")) ?? [];
  const pick = <T,>(pool: readonly T[], label: string): T => {
    if (!pool.length) throw new Error(`完全随机所需的${label}资源不可用，请恢复内置资源包。`);
    const value = random();
    if (value < 0 || value >= 1 || !Number.isFinite(value)) throw new Error("随机数必须位于 [0, 1)。");
    return pool[Math.floor(value * pool.length)]!;
  };
  const byName = (libraryId: string, name: string) => {
    const matches = entries(libraryId).filter(entry => entry.fields.名称 === name && entry.fields.位阶 === "1");
    if (matches.length !== 1) throw new Error(`推荐装备“${name}”不可用或不唯一。`);
    return matches[0]!;
  };
  const ancestry = pick(entries("ancestries"), "种族");
  const community = pick(entries("communities"), "社群");
  const profession = pick(entries("classes"), "职业");
  const subclass = pick(entries("subclasses").filter(entry => entry.fields.主职 === profession.fields.名称
    && entry.fields.等级 === "基础"), "基础子职");
  const fallback = recommendations[profession.fields.名称!];
  if (!fallback) throw new Error(`职业“${profession.fields.名称}”缺少推荐配置。`);
  const professionData = profession.resourceCopy!.data;
  const recommendedTraits = professionData.推荐初始属性 as Record<string, string> | undefined;
  const traitValues = traitLabels.map((label, index) => recommendedTraits?.[label]?.trim()
    ? integer(recommendedTraits[label]) : fallback.traits[index]!);
  const weaponNames = text(professionData.推荐初始武器).split(/[+＋]/u).map(name => name.trim()).filter(Boolean);
  const weapons = (weaponNames.length ? weaponNames : fallback.weapons).map(name => byName("weapons", name));
  const armor = byName("armor", text(professionData.推荐初始护甲) || fallback.armor);
  if (weapons.length > 2 || weapons[0]?.fields.类型 !== "主武器" || (weapons[1] && weapons[1].fields.类型 !== "副武器")) {
    throw new Error("职业推荐武器不符合主、副武器栏规则。");
  }
  const domains = professionData.领域;
  if (!Array.isArray(domains) || domains.length !== 2) throw new Error("职业领域配置无效。");
  const domainPool = entries("domain-cards").filter(entry => entry.fields.等级 === "1" && domains.includes(entry.fields.领域));
  const domainCards: ResourceLibraryEntry[] = [];
  const cardCount = subclass.fields.名称 === "知识学派" ? 3 : 2;
  for (let index = 0; index < cardCount; index += 1) {
    const card = pick(domainPool, "1级领域卡");
    domainCards.push(card);
    domainPool.splice(domainPool.indexOf(card), 1);
  }

  let data = createEmptyCharacterData(systemPackage);
  const apply = (moduleId: string, libraryId: string, selected: ResourceLibraryEntry[]) => {
    const result = applyResourceSelectionToDraft(data, systemPackage, moduleId, libraryId, selected);
    if (result.interactionResult.warnings.length || result.derivedResult.warnings.length) throw new Error("随机创建的资源应用失败。");
    data = result.characterData;
  };
  apply("pick-class", "classes", [profession]);
  apply("pick-community", "communities", [community]);
  apply("pick-subclass", "subclasses", [subclass]);
  apply("pick-primary-weapon", "weapons", [weapons[0]!]);
  if (weapons[1]) apply("pick-secondary-weapon", "weapons", [weapons[1]]);
  apply("pick-armor", "armor", [armor]);
  apply("pick-domain-card", "domain-cards", domainCards);
  const composer = systemPackage.modules.find(module => module.ID === "pick-ancestry");
  if (composer?.类型 !== "resourceComposer") throw new Error("种族选择模块不可用。");
  const composite = composeResource(composer, Object.fromEntries(composer.来源槽位.map(slot => [slot.ID, ancestry])));
  if (!composite) throw new Error("种族卡创建失败。");
  data = { ...data, compositeResources: { [composer.ID]: composite } };
  const ancestryResult = evaluateDependencies(data, systemPackage, {
    type: "resourceSelected", sourceModuleId: composer.ID, selectedEntries: [composite],
  });
  if (ancestryResult.warnings.length) throw new Error("随机创建的种族应用失败。");
  const targetTable = systemPackage.modules.find(module => module.ID === composer.创建卡牌?.卡牌桌面模块ID);
  if (targetTable?.类型 !== "cardTable" || !targetTable.资源来源.some(source => source.类型 === "resourceComposer" && source.ID === composer.ID)) {
    throw new Error("种族卡牌桌面不可用。");
  }
  data = createCardInstance(applyDependencyResultToCharacterData(data, ancestryResult), {
    instanceId: crypto.randomUUID(), tableModuleId: targetTable.ID,
    definitionRef: { type: "compositeResource", compositeResourceId: composite.ID },
    state: composer.创建卡牌!.默认状态 ?? targetTable.状态选项?.[0],
  });

  // 填写基础配置和永久加值；临时战斗能力不在创建时启用。
  const ancestryName = ancestry.fields.名称;
  const subclassName = subclass.fields.名称;
  let evasion = integer(profession.fields.闪避值) + (ancestryName === "猿族" ? 1 : 0);
  const armorName = armor.fields.名称;
  if (armorName === "填充布甲") evasion += 1;
  if (armorName === "链甲") evasion -= 1;
  if (armorName === "全板甲") { evasion -= 2; traitValues[0]! -= 1; }
  for (const weapon of weapons) {
    if (["巨剑", "战锤", "塔盾"].includes(weapon.fields.名称!)) evasion -= 1;
    if (["戟", "长弓"].includes(weapon.fields.名称!)) traitValues[2]! -= 1;
  }
  if (domainCards.some(card => card.fields.名称 === "不可侵犯")) evasion += Math.ceil(traitValues[0]! / 2);
  const armorValue = integer(armor.fields.护甲值) + weapons.reduce((bonus, weapon) => bonus
    + (weapon.fields.名称 === "圆盾" ? 1 : weapon.fields.名称 === "塔盾" ? 2 : 0), 0);
  const thresholdBonus = 1 + (ancestryName === "龟人" ? 1 : 0) + (subclassName === "坚毅铁卫" ? 1 : 0);
  const name = `${ancestryName}${profession.fields.名称}`;
  const values: Record<string, SheetValue> = {
    ...data.character.values,
    ...Object.fromEntries(traits.map((trait, index) => [trait, String(traitValues[index])])),
    "character-name": name, level: "1", evasion: String(evasion),
    hp: { current: 0, max: integer(profession.fields.生命点) + (ancestryName === "巨人" ? 1 : 0) + (subclassName === "战争学派" ? 1 : 0) },
    stress: { current: 0, max: 6 + (ancestryName === "人类" ? 1 : 0) + (subclassName === "复仇战卫" ? 1 : 0) },
    "armor-value": String(armorValue), "armor-slots": { current: 0, max: armorValue },
    "major-threshold": String(integer(armor.fields.重度阈值) + thresholdBonus),
    "severe-threshold": String(integer(armor.fields.严重阈值) + thresholdBonus),
    "experience-1": "一条战斗相关经历", "experience-modifier-1": ancestryName === "械灵" ? "3" : "2",
    "experience-2": "一条非战斗相关经历", "experience-modifier-2": "2",
  };
  return { name, data: { ...data, character: { ...data.character, values } } };
}

function integer(value: unknown): number {
  const content = text(value);
  if (!/^[+-]?\d+$/u.test(content)) throw new Error(`随机创建所需数值“${content}”无效。`);
  return Number(content);
}

function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
