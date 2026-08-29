function field(entry, name) {
  return name === "ID" ? entry.ID : entry.fields && entry.fields[name] !== undefined ? entry.fields[name] : entry[name];
}
function string(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}
function normalized(value) { return string(value).normalize("NFKC").trim().replace(/\s+/gu, " "); }
function countable(value) { return value && typeof value.current === "number" ? value : undefined; }
function resource(values, id) { return countable(values[id]) || { current: 0, max: 0 }; }
function booleanSlots(value, length) {
  const current = Math.max(0, Math.trunc(value.current || 0));
  return Array.from({ length }, (_, index) => index < current);
}
function strings(values, prefix, length) {
  return Array.from({ length }, (_, index) => string(values[`${prefix}-${index + 1}`]));
}
function image(data, moduleId) {
  const value = data.character.values[moduleId];
  return value && value.kind === "player-image" && data.playerImages[value.imageId]
    ? data.playerImages[value.imageId].dataUrl
    : "";
}
function library(libraries, id) { return libraries.find((candidate) => candidate.ID === id); }
function entryByName(libraries, libraryId, name, extra) {
  const expected = normalized(name);
  const matches = ((library(libraries, libraryId) || {}).entries || []).filter((entry) =>
    expected && normalized(field(entry, "名称")) === expected && (!extra || extra(entry)));
  return matches.length === 1 ? matches[0] : undefined;
}
function entryFor(card, libraries) {
  if (!card.definitionRef || card.definitionRef.type !== "resourceLibrary") return undefined;
  const source = library(libraries, card.definitionRef.libraryId);
  const entry = source && source.entries.find((candidate) => candidate.ID === card.definitionRef.entryId);
  return entry ? { libraryId: source.ID, entry } : undefined;
}
function cardType(libraryId) {
  return ({ classes: "profession", subclasses: "subclass", ancestries: "ancestry", communities: "community", "domain-cards": "domain" })[libraryId] || "unknown";
}
function cardFromEntry(libraryId, entry) {
  const type = cardType(libraryId);
  const description = type === "profession" ? field(entry, "职业特性")
    : type === "subclass" ? field(entry, "子职特性")
      : field(entry, "描述") || field(entry, "简介") || "";
  const card = {
    standarized: true,
    id: string(entry.ID),
    name: string(field(entry, "名称")),
    type,
    class: string(field(entry, "领域") || field(entry, "主职") || field(entry, "名称")),
    level: type === "subclass" ? string(({ T1: 1, T2: 2, T3: 3, T4X: 4, T4Y: 4 })[field(entry, "阶段")] || "") : string(field(entry, "等级")).replace(/级$/u, ""),
    description: string(description),
    cardSelectDisplay: {},
  };
  if (type === "profession") {
    card.professionSpecial = {
      "起始生命": Number(field(entry, "生命点")) || 0,
      "起始闪避": Number(field(entry, "闪避值")) || 0,
      "起始物品": "",
      "希望特性": string(field(entry, "希望特性")),
    };
  }
  return card;
}
function emptyCard(prefix, index) {
  return { standarized: true, id: `${prefix}-${index + 1}`, name: "", type: "unknown", class: "", level: "", description: "", cardSelectDisplay: {} };
}
function padCards(cards, prefix) {
  return cards.concat(Array.from({ length: Math.max(0, 20 - cards.length) }, (_, index) => emptyCard(prefix, index))).slice(0, 20);
}
function addUniqueCard(cards, libraryId, entry) {
  if (entry && !cards.some((card) => card.id === entry.ID)) cards.push(cardFromEntry(libraryId, entry));
}
function splitReversible(value, label, diagnostics) {
  const source = string(value).trim();
  if (!source) return ["", "", ""];
  const parts = source.split("｜").map((part) => part.trim());
  if (parts.length >= 3) return [parts[0] || "", parts[1] || "", parts.slice(2).join("｜") || ""];
  diagnostics.push({
    level: "warning", code: "TTTRI_DHSHEET_EQUIPMENT_NOT_REVERSIBLE",
    text: `${label}「${source}」不是适配器生成的可逆格式；完整文字已保存在名称字段，未猜测其他属性。`,
  });
  return [source, "", ""];
}
function exportUpgrades(values, diagnostics) {
  const upgrades = { tier1: {}, tier2: {}, tier3: {} };
  const common = [["traits-1", 0, 0], ["traits-2", 0, 1], ["traits-3", 0, 2], ["hp-1", 1, 0], ["hp-2", 1, 1], ["stress-1", 2, 0], ["stress-2", 2, 1], ["experiences", 3, 0], ["domain-card", 4, 0], ["evasion", 5, 0]];
  for (const [baseTier, dhTier] of [[2, "tier1"], [3, "tier2"], [4, "tier3"]]) {
    const state = values[`advancement-tier-${baseTier}`] || {};
    for (const [option, optionIndex, boxIndex] of common) {
      if (state[option] === true) upgrades[`${dhTier}-${optionIndex}-${boxIndex}`] = { [optionIndex]: true };
    }
    if (baseTier === 3 || baseTier === 4) {
      const subclassId = baseTier === 4 ? "subclass-elite" : "subclass";
      if (state[subclassId] === true) upgrades[`${dhTier}-6-0`] = { 6: true };
      if (state["proficiency-1"] === true || state["proficiency-2"] === true) upgrades[`${dhTier}-7`] = { 7: true };
      if (state["multiclass-1"] === true || state["multiclass-2"] === true) upgrades[`${dhTier}-8`] = { 8: true };
    }
  }
  const t2 = values["advancement-tier-2"] || {};
  if (t2.subclass || t2["multiclass-1"] || t2["multiclass-2"]) {
    diagnostics.push({
      level: "warning", code: "TTTRI_DHSHEET_ADVANCEMENT_NOT_EQUIVALENT",
      text: "TTTRI T2 的提升武器原型/技艺交流在 dhSheet T1 没有等价选项，导出时未猜测映射。",
    });
  }
  return upgrades;
}

module.exports = function (input) {
  const data = input.characterData;
  const libraries = input.resourceLibraries || [];
  const values = data.character.values;
  const diagnostics = [];
  const classEntry = entryByName(libraries, "classes", values["class-name"]);
  const subclassEntry = entryByName(libraries, "subclasses", values["subclass-name"], (entry) =>
    normalized(field(entry, "主职")) === normalized(values["class-name"])
      && (!normalized(values["subclass-stage"]) || normalized(field(entry, "等级")) === normalized(values["subclass-stage"])));
  const ancestryEntry = entryByName(libraries, "ancestries", values["ancestry-name"]);
  const communityEntry = entryByName(libraries, "communities", values["community-name"]);
  const activeCards = [];
  const vaultCards = [];
  addUniqueCard(activeCards, "classes", classEntry);
  addUniqueCard(activeCards, "subclasses", subclassEntry);
  addUniqueCard(activeCards, "ancestries", ancestryEntry);
  addUniqueCard(activeCards, "communities", communityEntry);
  for (const instance of data.cards.instances || []) {
    if (instance.tableModuleId !== "character-card-table") continue;
    const found = entryFor(instance, libraries);
    if (!found || !["ancestries", "communities", "domain-cards"].includes(found.libraryId)) continue;
    addUniqueCard(instance.state === "宝库" ? vaultCards : activeCards, found.libraryId, found.entry);
  }

  const primary = splitReversible(values["weapon-summary"], "武器", diagnostics);
  const armor = splitReversible(values["armor-summary"], "护甲", diagnostics);
  const inventoryLines = string(values.inventory).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const secondarySummaryIndex = inventoryLines.findIndex((line) => line.startsWith("副武器："));
  const secondaryFeatureIndex = inventoryLines.findIndex((line) => line.startsWith("副武器特性："));
  const secondary = secondarySummaryIndex >= 0
    ? splitReversible(inventoryLines[secondarySummaryIndex].slice("副武器：".length), "副武器", diagnostics)
    : ["", "", ""];
  const secondaryFeature = secondaryFeatureIndex >= 0 ? inventoryLines[secondaryFeatureIndex].slice("副武器特性：".length) : "";
  const inventory = inventoryLines.filter((_, index) => index !== secondarySummaryIndex && index !== secondaryFeatureIndex);
  const hp = resource(values, "hp");
  const stress = resource(values, "stress");
  const hope = resource(values, "hope");
  const armorSlots = resource(values, "armor-slots");
  const proficiency = resource(values, "proficiency");
  const handful = resource(values, "handful-gold");
  const bag = resource(values, "bag-gold");
  const chest = resource(values, "chest-gold");
  const ref = (entry, name) => ({ id: entry ? string(entry.ID) : "", name: string(name) });
  const document = {
    ruleSetId: "rhodes-island", name: string(values["character-name"]), characterImage: image(data, "character-avatar"), level: string(values.level || "1"),
    proficiency: booleanSlots(proficiency, 6),
    profession: classEntry ? string(classEntry.ID) : "", professionRef: ref(classEntry, values["class-name"]),
    subclass: subclassEntry ? string(subclassEntry.ID) : "", subclassRef: ref(subclassEntry, values["subclass-name"]),
    ancestry1: ancestryEntry ? string(ancestryEntry.ID) : "", ancestry2: "", mixedAncestryEnabled: false,
    ancestry1Ref: ref(ancestryEntry, values["ancestry-name"]), ancestry2Ref: { id: "", name: "" },
    community: communityEntry ? string(communityEntry.ID) : "", communityRef: ref(communityEntry, values["community-name"]),
    rhodesSecondaryDomain: string(values["secondary-domain"]), evasion: string(values.evasion), evasionManualModifier: "0",
    gold: [...booleanSlots(handful, 9), ...booleanSlots(bag, 9), ...booleanSlots(chest, 3)],
    experience: strings(values, "experience", 5), experienceValues: strings(values, "experience-modifier", 5),
    ancestryExperience: [string(values["ancestry-experience"])], ancestryExperienceValues: [string(values["ancestry-experience-modifier"])],
    hope: hope.current, hopeMax: hope.max === null ? 6 : hope.max,
    hp: booleanSlots(hp, 18), stress: booleanSlots(stress, 18), hpMax: hp.max === null ? hp.current : hp.max, stressMax: stress.max === null ? stress.current : stress.max,
    armorBoxes: booleanSlots(armorSlots, 12), armorValue: string(values["armor-value"]), armorValueManualModifier: "0", armorBonus: "", armorMax: armorSlots.max === null ? armorSlots.current : armorSlots.max,
    minorThreshold: string(values["major-threshold"]), majorThreshold: string(values["severe-threshold"]), minorThresholdManualModifier: "0", majorThresholdManualModifier: "0",
    inventory: inventory.concat(["", "", "", "", ""]).slice(0, 5),
    characterBackground: string(values["background-story"]), characterAppearance: "", characterMotivation: string(values.notes),
    cards: padCards(activeCards, "empty-card"), inventory_cards: padCards(vaultCards, "empty-inventory-card"), checkedUpgrades: exportUpgrades(values, diagnostics),
    primaryWeaponName: primary[0], primaryWeaponSelection: "", primaryWeaponTrait: primary[1], primaryWeaponDamage: primary[2], primaryWeaponFeature: string(values["weapon-feature"]),
    secondaryWeaponName: secondary[0], secondaryWeaponSelection: "", secondaryWeaponTrait: secondary[1], secondaryWeaponDamage: secondary[2], secondaryWeaponFeature: secondaryFeature,
    armorName: armor[0], armorSelection: "", armorBaseScore: armor[1], armorThreshold: armor[2], armorFeature: string(values["armor-feature"]),
    inventoryWeapon1Name: "", inventoryWeapon1Trait: "", inventoryWeapon1Damage: "", inventoryWeapon1Feature: "", inventoryWeapon1Primary: false, inventoryWeapon1Secondary: false,
    inventoryWeapon2Name: "", inventoryWeapon2Trait: "", inventoryWeapon2Damage: "", inventoryWeapon2Feature: "", inventoryWeapon2Primary: false, inventoryWeapon2Secondary: false,
    companionImage: "", companionName: "", companionDescription: "", companionRange: "", companionStress: Array.from({ length: 18 }, () => false), companionEvasion: "", companionStressMax: 0, companionWeapon: "", companionExperience: ["", "", "", "", ""], companionExperienceValue: ["", "", "", "", ""],
    trainingOptions: { intelligent: [false, false, false], radiantInDarkness: [false], creatureComfort: [false], armored: [false], vicious: [false, false, false], resilient: [false, false, false], bonded: [false], aware: [false, false, false] },
    includePageThreeInExport: true, pageVisibility: { rangerCompanion: false, armorTemplate: false, adventureNotes: false },
    armorTemplate: { weaponName: "", description: "", upgradeSlots: Array.from({ length: 5 }, () => ({ checked: false, text: "" })), upgrades: { basic: {}, tier2: {}, tier3: {}, tier4: {} }, scrapMaterials: { fragments: [0, 0, 0, 0, 0, 0], metals: [0, 0, 0, 0, 0, 0], components: [0, 0, 0, 0, 0, 0], relics: ["", "", "", "", ""] }, electronicCoins: 0 },
    adventureNotes: { characterProfile: {}, playerInfo: {}, backstory: "", milestones: "", adventureLog: Array.from({ length: 8 }, () => ({ name: "", levelRange: "", trauma: "", date: "" })) },
    notebook: { pages: [{ id: "page-1", lines: [] }], currentPageIndex: 0, isOpen: false }, presetEquipmentCalcVersion: 1, domainCardAutomation: {}, branchUpgradeCount: {}, rulesetAutomationVersions: {},
  };
  for (const id of ["agility", "strength", "finesse", "instinct", "presence", "knowledge"]) {
    document[id] = { checked: false, value: string(values[id]), spellcasting: false };
  }
  return {
    document,
    exportedFields: Object.keys(document).length,
    exportedCards: activeCards.length + vaultCards.length,
    exportedImages: document.characterImage ? 1 : 0,
    skippedFields: 0, skippedCards: 0, skippedImages: 0, diagnostics,
  };
};
