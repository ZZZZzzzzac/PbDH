function image(data, moduleId) {
  const value = data.character.values[moduleId];
  return value && value.kind === "player-image" && data.playerImages[value.imageId] ? data.playerImages[value.imageId].dataUrl : undefined;
}
function entryFor(card, libraries) {
  if (!card.definitionRef || card.definitionRef.type !== "resourceLibrary") return undefined;
  const library = libraries.find((item) => item.ID === card.definitionRef.libraryId);
  const entry = library && library.entries.find((item) => item.ID === card.definitionRef.entryId);
  return entry ? { libraryId: library.ID, entry } : undefined;
}
function field(entry, name) { return name === "ID" ? entry.ID : entry.fields && entry.fields[name] !== undefined ? entry.fields[name] : entry[name]; }
function countable(value) { return value && typeof value.current === "number" ? value : undefined; }
function string(value) { return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : ""; }
function splitEquipment(value) {
  const parts = string(value).split("｜").map((item) => item.trim());
  return [parts[0] || "", parts[1] || "", parts.slice(2).join("｜") || ""];
}
function booleanSlots(value, length) {
  const resource = countable(value);
  const current = resource ? Math.max(0, Math.trunc(resource.current)) : 0;
  return Array.from({ length }, (_, index) => index < current);
}
function strings(values, prefix, length) { return Array.from({ length }, (_, index) => string(values[`${prefix}-${index + 1}`])); }
function cardType(libraryId) { return ({ communities: "community", subclasses: "subclass", "domain-cards": "domain", ancestries: "ancestry" })[libraryId] || "unknown"; }
function exportCards(data, libraries, state, dhSheet) {
  const allowed = ["communities", "subclasses", "domain-cards"];
  const cards = [];
  for (const card of data.cards.instances) {
    if (card.tableModuleId !== "character-card-table" || card.state !== state) continue;
    const found = entryFor(card, libraries);
    if (!found || !allowed.includes(found.libraryId)) continue;
    const name = field(found.entry, "名称");
    const description = field(found.entry, "描述");
    if (!name || !description) continue;
    cards.push(dhSheet ? {
      standarized: true, id: string(field(found.entry, "原名") || found.entry.ID), name: string(name), type: cardType(found.libraryId),
      class: string(field(found.entry, "领域")), description: string(description), cardSelectDisplay: {},
    } : { data: { 原名: field(found.entry, "原名"), 名称: name, 描述: description } });
  }
  return cards;
}
function exportZzz(data, libraries) {
  const values = data.character.values;
  const document = { cards: exportCards(data, libraries, "配置", false) };
  const pairs = {
    "character-name": "NameTextbox", "ancestry-name": "RaceTextbox", "community-name": "CommunityTextbox", "class-name": "ClassTextbox", level: "LevelTextbox", evasion: "EvasionTextbox",
    agility: "AgilityTextbox", strength: "StrengthTextbox", finesse: "FinesseTextbox", instinct: "InstinctTextbox", presence: "PresenceTextbox", knowledge: "KnowledgeTextbox",
    "major-threshold": "MajorTextbox", "severe-threshold": "SevereTextbox", "class-feature": "ClassFeatureTextbox", "primary-weapon-description": "PrimaryWeaponTraitTextbox",
    "secondary-weapon-description": "SecondaryWeaponTraitTextbox", "backup-weapon-1-name": "Backup1WeaponNameTextbox", "backup-weapon-1-description": "Backup1WeaponTraitTextbox",
    "backup-weapon-2-name": "Backup2WeaponNameTextbox", "backup-weapon-2-description": "Backup2WeaponTraitTextbox", "armor-value": "ArmorTextbox", "armor-description": "ArmorTraitTextbox",
    inventory: "ItemSlot1Textbox", "event-log": "EventLogTextbox",
  };
  Object.entries(pairs).forEach(([id, target]) => { if (typeof values[id] === "string") document[target] = values[id]; });
  if (typeof values["primary-weapon-name"] === "string") document.PrimaryWeaponNameTextbox = values["primary-weapon-name"];
  if (typeof values["secondary-weapon-name"] === "string") document.SecondaryWeaponNameTextbox = values["secondary-weapon-name"];
  if (typeof values["armor-name"] === "string") document.ArmorNameTextbox = values["armor-name"];
  for (let index = 1; index <= 5; index += 1) { document[`Experience${index}Textbox`] = values[`experience-${index}`] || ""; document[`Experience${index}ModifierTextbox`] = values[`experience-modifier-${index}`] || ""; }
  for (let index = 1; index <= 3; index += 1) { document[`BackgroundQuestion${index}Textbox`] = values[`background-question-${index}`] || ""; document[`ConnectQuestion${index}Textbox`] = values[`connection-question-${index}`] || ""; document[`BackgroundAnswer${index}Textbox`] = values[`background-answer-${index}`] || ""; document[`ConnectAnswer${index}Textbox`] = values[`connection-answer-${index}`] || ""; }
  for (const [id, prefix, length, tri] of [["hp", "HpSlotCheckbox", 12, true], ["stress", "StressSlotCheckbox", 12, true], ["armor-slots", "ArmorSlotCheckbox", 12, true], ["hope", "HopeSlotCheckbox", 6, false], ["proficiency", "ProficiencyCheckbox", 5, false], ["handful-gold", "HandfulGoldCheckbox", 9, false], ["bag-gold", "BagGoldCheckbox", 9, false]]) {
    const value = countable(values[id]);
    if (!value) continue;
    for (let index = 0; index < length; index += 1) document[`${prefix}${index + 1}`] = index < value.current ? 1 : tri && value.max !== null && index >= value.max ? 2 : 0;
  }
  const chest = countable(values["chest-gold"]); if (chest) document.ChestGoldCheckbox1 = chest.current;
  const advancement = { A1: "traits-1", A2: "traits-2", A3: "traits-3", B1: "hp-1", B2: "hp-2", C1: "stress-1", C2: "stress-2", D1: "experiences", E1: "domain-card", F1: "subclass", G1: "evasion", H1: "proficiency-1", I1: "multiclass-1" };
  for (const tier of [2, 3, 4]) { const state = values[`advancement-tier-${tier}`] || {}; Object.entries(advancement).forEach(([suffix, option]) => { document[`LevelupT${tier}_${suffix}`] = state[option] ? 1 : 0; }); }
  const avatar = image(data, "character-avatar"); if (avatar) document.avatarImageSrc = avatar;
  return { document, exportedFields: Object.keys(document).length, exportedCards: document.cards.length, exportedImages: avatar ? 1 : 0, skippedFields: 0, skippedCards: 0, skippedImages: 0, diagnostics: [] };
}
function exportDhSheet(data, libraries) {
  const values = data.character.values;
  const resource = (id) => countable(values[id]) || { current: 0, max: 0 };
  const ref = (name) => ({ id: "", name: string(name) });
  const primary = splitEquipment(values["primary-weapon-name"]);
  const secondary = splitEquipment(values["secondary-weapon-name"]);
  const armor = splitEquipment(values["armor-name"]);
  const backup1 = splitEquipment(values["backup-weapon-1-name"]);
  const backup2 = splitEquipment(values["backup-weapon-2-name"]);
  const activeCards = exportCards(data, libraries, "配置", true);
  const inventoryCards = exportCards(data, libraries, "宝库", true);
  const professionName = string(values["class-name"]);
  const professionCard = professionName ? [{
    standarized: true, id: professionName, name: professionName, type: "profession", class: professionName,
    description: string(values["class-feature"]), cardSelectDisplay: {}, professionSpecial: {
      "起始生命": 0, "起始闪避": 0, "起始物品": "", "希望特性": string(values["class-hope-feature"]),
    },
  }] : [];
  const padCards = (cards, prefix) => cards.concat(Array.from({ length: Math.max(0, 20 - cards.length) }, (_, index) => ({
    standarized: true, id: `${prefix}-${index + 1}`, name: "", type: "unknown", class: "", description: "", cardSelectDisplay: {},
  }))).slice(0, 20);
  const hp = resource("hp"); const stress = resource("stress"); const hope = resource("hope"); const armorSlots = resource("armor-slots"); const proficiency = resource("proficiency");
  const handful = resource("handful-gold"); const bag = resource("bag-gold"); const chest = resource("chest-gold");
  const companionStress = resource("companion-stress");
  const document = {
    ruleSetId: "daggerheart", name: string(values["character-name"]), characterImage: "", level: string(values.level || "1"),
    proficiency: booleanSlots(proficiency, 6), ancestry1: string(values["ancestry-name"]), ancestry2: "", mixedAncestryEnabled: false,
    profession: professionName, community: string(values["community-name"]), subclass: string(values["subclass-name"]),
    professionRef: ref(professionName), ancestry1Ref: ref(values["ancestry-name"]), ancestry2Ref: ref(""), communityRef: ref(values["community-name"]), subclassRef: ref(values["subclass-name"]),
    evasion: string(values.evasion), evasionManualModifier: "0",
    gold: [...booleanSlots(handful, 9), ...booleanSlots(bag, 9), ...booleanSlots(chest, 2)],
    experience: strings(values, "experience", 5), experienceValues: strings(values, "experience-modifier", 5), ancestryExperience: [], ancestryExperienceValues: [],
    hope: hope.current, hopeMax: hope.max === null ? 6 : hope.max, hp: booleanSlots(hp, 18), stress: booleanSlots(stress, 18), hpMax: hp.max === null ? hp.current : hp.max, stressMax: stress.max === null ? stress.current : stress.max,
    armorBoxes: booleanSlots(armorSlots, 12), armorValue: string(values["armor-value"]), armorValueManualModifier: "0", armorBonus: "", armorMax: armorSlots.max === null ? armorSlots.current : armorSlots.max,
    minorThreshold: string(values["major-threshold"]), majorThreshold: string(values["severe-threshold"]), minorThresholdManualModifier: "0", majorThresholdManualModifier: "0",
    inventory: string(values.inventory).split(/\r?\n/u).map((item) => item.trim()).filter(Boolean).concat(["", "", "", "", ""]).slice(0, 5),
    characterBackground: string(values["background-story"]), characterAppearance: "", characterMotivation: string(values["event-log"]),
    cards: padCards(professionCard.concat(activeCards), "empty-card"), inventory_cards: padCards(inventoryCards, "empty-inventory-card"), checkedUpgrades: exportDhUpgrades(values),
    primaryWeaponName: primary[0], primaryWeaponSelection: "", primaryWeaponTrait: primary[1], primaryWeaponDamage: primary[2], primaryWeaponFeature: string(values["primary-weapon-description"]),
    secondaryWeaponName: secondary[0], secondaryWeaponSelection: "", secondaryWeaponTrait: secondary[1], secondaryWeaponDamage: secondary[2], secondaryWeaponFeature: string(values["secondary-weapon-description"]),
    armorName: armor[0], armorSelection: "", armorBaseScore: armor[1], armorThreshold: armor[2], armorFeature: string(values["armor-description"]),
    inventoryWeapon1Name: backup1[0], inventoryWeapon1Trait: backup1[1], inventoryWeapon1Damage: backup1[2], inventoryWeapon1Feature: string(values["backup-weapon-1-description"]), inventoryWeapon1Primary: false, inventoryWeapon1Secondary: false,
    inventoryWeapon2Name: backup2[0], inventoryWeapon2Trait: backup2[1], inventoryWeapon2Damage: backup2[2], inventoryWeapon2Feature: string(values["backup-weapon-2-description"]), inventoryWeapon2Primary: false, inventoryWeapon2Secondary: false,
    companionImage: "", companionName: string(values["companion-name"]), companionDescription: "", companionRange: string(values["companion-attack-range"]), companionStress: booleanSlots(companionStress, 18), companionEvasion: string(values["companion-evasion"]), companionStressMax: companionStress.max === null ? companionStress.current : companionStress.max,
    companionWeapon: string(values["companion-attack-die"]), companionExperience: strings(values, "companion-experience", 5), companionExperienceValue: strings(values, "companion-experience-modifier", 5),
    trainingOptions: { intelligent: [false, false, false], radiantInDarkness: [false], creatureComfort: [false], armored: [false], vicious: [false, false, false], resilient: [false, false, false], bonded: [false], aware: [false, false, false] },
    includePageThreeInExport: true, pageVisibility: { rangerCompanion: false, armorTemplate: false, adventureNotes: false },
    armorTemplate: { weaponName: "", description: "", upgradeSlots: Array.from({ length: 5 }, () => ({ checked: false, text: "" })), upgrades: { basic: {}, tier2: {}, tier3: {}, tier4: {} }, scrapMaterials: { fragments: [0, 0, 0, 0, 0, 0], metals: [0, 0, 0, 0, 0, 0], components: [0, 0, 0, 0, 0, 0], relics: ["", "", "", "", ""] }, electronicCoins: 0 },
    adventureNotes: { characterProfile: {}, playerInfo: {}, backstory: "", milestones: "", adventureLog: Array.from({ length: 8 }, () => ({ name: "", levelRange: "", trauma: "", date: "" })) },
    notebook: { pages: [{ id: "page-1", lines: [] }], currentPageIndex: 0, isOpen: false }, presetEquipmentCalcVersion: 1, domainCardAutomation: {}, branchUpgradeCount: {}, rulesetAutomationVersions: {},
  };
  for (const id of ["agility", "strength", "finesse", "instinct", "presence", "knowledge"]) document[id] = { checked: false, value: string(values[id]), spellcasting: false };
  const avatar = image(data, "character-avatar"); const companion = image(data, "companion-portrait"); if (avatar) document.characterImage = avatar; if (companion) document.companionImage = companion;
  return { document, exportedFields: Object.keys(document).length, exportedCards: professionCard.length + activeCards.length + inventoryCards.length, exportedImages: (avatar ? 1 : 0) + (companion ? 1 : 0), skippedFields: 0, skippedCards: 0, skippedImages: 0, diagnostics: [] };
}
function exportDhUpgrades(values) {
  const upgrades = { tier1: {}, tier2: {}, tier3: {} };
  const common = [["traits-1", 0, 0], ["traits-2", 0, 1], ["traits-3", 0, 2], ["hp-1", 1, 0], ["hp-2", 1, 1], ["stress-1", 2, 0], ["stress-2", 2, 1], ["experiences", 3, 0], ["domain-card", 4, 0], ["evasion", 5, 0]];
  for (const [baseTier, dhTier] of [[2, "tier1"], [3, "tier2"], [4, "tier3"]]) {
    const state = values[`advancement-tier-${baseTier}`] || {};
    for (const [option, optionIndex, boxIndex] of common) if (state[option] === true) upgrades[`${dhTier}-${optionIndex}-${boxIndex}`] = { [optionIndex]: true };
    if (baseTier >= 3) {
      if (state.subclass === true) upgrades[`${dhTier}-6-0`] = { 6: true };
      if (state["proficiency-1"] === true || state["proficiency-2"] === true) upgrades[`${dhTier}-7`] = { 7: true };
      if (state["multiclass-1"] === true || state["multiclass-2"] === true) upgrades[`${dhTier}-8`] = { 8: true };
    }
  }
  return upgrades;
}
module.exports = function (input) { return input.adapterId === "zzz-character-json" ? exportZzz(input.characterData, input.resourceLibraries || []) : exportDhSheet(input.characterData, input.resourceLibraries || []); };
