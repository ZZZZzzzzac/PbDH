function image(data, moduleId) {
  const value = data.character.values[moduleId];
  return value && value.kind === "player-image" && data.playerImages[value.imageId] ? data.playerImages[value.imageId].dataUrl : undefined;
}
function entryFor(card, libraries, data) {
  if (!card.definitionRef || card.definitionRef.type !== "resourceLibrary") return undefined;
  const embedded = data.embeddedResourceEntries && data.embeddedResourceEntries[card.definitionRef.entryId];
  if (embedded && embedded.libraryId === card.definitionRef.libraryId) return embedded;
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
function companionTraining(values) {
  const state = values["companion-upgrades"] || {};
  const mapping = { intelligent: ["wise-1", "wise-2", "wise-3"], radiantInDarkness: ["light-in-dark"], creatureComfort: ["creature-comfort"], armored: ["armored"], vicious: ["trained-1", "trained-2", "trained-3"], resilient: ["resilient-1", "resilient-2", "resilient-3"], bonded: ["protective"], aware: ["aware-1", "aware-2", "aware-3"] };
  return Object.fromEntries(Object.entries(mapping).map(([key, ids]) => [key, ids.map((id) => state[id] === true)]));
}
function splitWeapon(value) {
  const parts = string(value).split("｜").map((item) => item.trim());
  if (parts.length < 5) return splitEquipment(value);
  const damage = parts[3].match(/^(.*?)\s+(物理|魔法|法术)$/u);
  return [parts[0].replace(/^\*\*(.*)\*\*$/u, "$1"), [damage?.[2] || "", parts[4], parts[2]].filter(Boolean).join("/"), `${parts[1]}: ${damage?.[1] || parts[3]}`];
}
function splitArmor(value) {
  const parts = splitEquipment(value);
  if (/^阈值\s*/u.test(parts[1]) && /^护甲值\s*/u.test(parts[2])) return [parts[0].replace(/^\*\*(.*)\*\*$/u, "$1"), parts[2].replace(/^护甲值\s*/u, ""), parts[1].replace(/^阈值\s*/u, "")];
  return parts;
}
function cardType(libraryId) { return ({ classes: "profession", communities: "community", subclasses: "subclass", "domain-cards": "domain", ancestries: "ancestry" })[libraryId] || "unknown"; }
function exportCards(data, libraries, state, dhSheet, diagnostics = []) {
  const allowed = dhSheet ? ["classes", "communities", "subclasses", "domain-cards"] : ["communities", "subclasses", "domain-cards"];
  const cards = [];
  for (const card of data.cards.instances) {
    if (card.tableModuleId !== "character-card-table" || card.state !== state) continue;
    const found = entryFor(card, libraries, data);
    const composite = card.definitionRef?.type === "compositeResource" ? Object.values(data.compositeResources || {}).find((item) => item.ID === card.definitionRef.compositeResourceId) : undefined;
    if (dhSheet && (found?.libraryId === "ancestries" || composite?.composerModuleId === "pick-ancestry")) {
      const source = found?.entry || composite;
      for (const [index, slot] of [[0, "A"], [1, "B"]]) {
        const feature = source.resourceCopy?.data?.特性?.[index];
        const value = string(field(source, `特性${slot}`));
        const separator = value.search(/[：:]/u);
        const name = feature ? string(feature.特性名称) : separator >= 0 ? value.slice(0, separator) : value;
        const description = feature ? string(feature.特性描述) : separator >= 0 ? value.slice(separator + 1) : "";
        cards.push({ standarized: true, id: `ancestry-${index + 1}-${name}`, name, type: "ancestry", level: index + 1, class: string(field(source, `种族${slot}名称`) || ""), description, cardSelectDisplay: {} });
      }
      continue;
    }
    if (!found || !allowed.includes(found.libraryId)) {
      if (dhSheet) diagnostics.push({ level: "warning", code: "DHSHEET_CARD_UNSUPPORTED", text: `卡牌 ${card.instanceId} 没有已确认的 dhsheet 映射，未导出。` });
      continue;
    }
    const name = field(found.entry, "名称");
    const description = found.libraryId === "classes" ? field(found.entry, "职业特性") : field(found.entry, "描述") || [field(found.entry, "特性A"), field(found.entry, "特性B")].filter(Boolean).join("\n\n");
    if (!name) {
      if (dhSheet) diagnostics.push({ level: "warning", code: "DHSHEET_CARD_UNSUPPORTED", text: `卡牌 ${card.instanceId} 缺少名称，未导出。` });
      continue;
    }
    cards.push(dhSheet ? {
      standarized: true, id: string(found.entry.ID), name: string(name), type: cardType(found.libraryId),
      class: string(found.libraryId === "classes" ? name : field(found.entry, "领域") || field(found.entry, "主职") || name), description: string(description),
      ...(found.libraryId === "classes" ? { professionSpecial: { "起始生命": Number(field(found.entry, "生命点")) || 0, "起始闪避": Number(field(found.entry, "闪避值")) || 0, "起始物品": string(field(found.entry, "起始物品")), "希望特性": string(field(found.entry, "希望特性")) } } : {}),
      level: found.libraryId === "subclasses" ? ({ 基础: 1, 进阶: 2, 精通: 3 })[field(found.entry, "等级")] || 0 : Number.parseInt(string(field(found.entry, "等级")), 10) || 0,
      ...(found.libraryId === "subclasses" ? { headerDisplay: string(name) } : {}),
      cardSelectDisplay: found.libraryId === "domain-cards" ? { item1: string(field(found.entry, "领域")), item2: string(field(found.entry, "属性")), item3: `RC.${string(field(found.entry, "回想") || 0)}`, item4: `LV.${string(field(found.entry, "等级"))}` } : found.libraryId === "subclasses" ? { item1: string(field(found.entry, "主职")), item2: ({ 基础: "基石", 进阶: "专精", 精通: "大师" })[field(found.entry, "等级")] || "", item3: string(field(found.entry, "施法属性")) } : {},
    } : { data: { 原名: field(found.entry, "原名"), 名称: name, 描述: description } });
  }
  if (dhSheet) for (const card of cards) {
    if (card.type !== "subclass" || card.class !== "游侠" || card.name !== "驯兽大师") continue;
    const stage = { 1: ["Foundation", "基石"], 2: ["Specialization", "专精"], 3: ["Mastery", "大师"] }[card.level];
    if (!stage) continue;
    card.id = `Beastbound-${stage[0]}`;
    card.name = `野兽羁绊${stage[1]}`;
    card.headerDisplay = "野兽羁绊";
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
  const diagnostics = [];
  for (const card of data.cards.instances) if (card.tableModuleId === "character-card-table" && !["配置", "宝库"].includes(card.state)) diagnostics.push({ level: "warning", code: "DHSHEET_CARD_UNSUPPORTED", text: `卡牌 ${card.instanceId} 的状态 ${card.state} 没有 dhsheet 对应卡组，未导出。` });
  if (string(values.inventory).split(/\r?\n/u).filter((line) => line.trim()).length > 5) diagnostics.push({ level: "warning", code: "DHSHEET_INVENTORY_OVERFLOW", text: "物品栏超过 dhsheet 的 5 行，仅导出前 5 行。" });
  const resource = (id) => countable(values[id]) || { current: 0, max: 0 };
  const ref = (name) => ({ id: "", name: string(name) });
  const primary = splitWeapon(values["primary-weapon-name"]);
  const secondary = splitWeapon(values["secondary-weapon-name"]);
  const armor = splitArmor(values["armor-name"]);
  const backup1 = splitWeapon(values["backup-weapon-1-name"]);
  const backup2 = splitWeapon(values["backup-weapon-2-name"]);
  const activeCards = exportCards(data, libraries, "配置", true, diagnostics);
  const inventoryCards = exportCards(data, libraries, "宝库", true, diagnostics);
  const professionName = string(values["class-name"]);
  const classNames = [...new Set([professionName, ...activeCards.filter((card) => card.type === "subclass").map((card) => card.class), ...inventoryCards.filter((card) => card.type === "subclass").map((card) => card.class)])].filter(Boolean);
  for (const name of classNames) {
    if (activeCards.some((card) => card.type === "profession" && card.name === name)) continue;
    const matches = (libraries.find((library) => library.ID === "classes")?.entries || []).filter((entry) => field(entry, "名称") === name);
    if (matches.length !== 1) { diagnostics.push({ level: "warning", code: "DHSHEET_PROFESSION_NOT_FOUND", text: `职业「${name}」无法匹配核心职业卡。` }); continue; }
    const entry = matches[0];
    activeCards.push({ standarized: true, id: entry.ID, name, class: name, type: "profession", description: string(field(entry, "职业特性")), cardSelectDisplay: {}, professionSpecial: { "起始生命": Number(field(entry, "生命点")) || 0, "起始闪避": Number(field(entry, "闪避值")) || 0, "起始物品": "", "希望特性": string(field(entry, "希望特性")) } });
  }
  const existingPrimary = activeCards.find((card) => card.type === "profession" && card.name === professionName);
  const professionCard = existingPrimary ? [existingPrimary] : professionName ? [{
    standarized: true, id: professionName, name: professionName, type: "profession", class: professionName,
    description: string(values["class-feature"]), cardSelectDisplay: {}, professionSpecial: {
      "起始生命": 0, "起始闪避": 0, "起始物品": "", "希望特性": string(values["class-hope-feature"]),
    },
  }] : [];
  const padCards = (cards, prefix) => {
    if (cards.length > 20) throw new Error("dhsheet 每组只显示 20 个槽位；当前卡牌超出容量，已停止导出，未截断卡牌。");
    return cards.concat(Array.from({ length: Math.max(0, 20 - cards.length) }, (_, index) => ({
    standarized: true, id: `${prefix}-${index + 1}`, name: "", type: "unknown", class: "", description: "", cardSelectDisplay: {},
    })));
  };
  const remaining = activeCards.filter((card) => card !== existingPrimary);
  if (existingPrimary) {
    for (const card of activeCards.filter((item) => item.type === "profession")) {
      const entries = (libraries.find((library) => library.ID === "classes")?.entries || []).filter((entry) => field(entry, "名称") === card.name);
      if (entries.length !== 1) continue;
      card.description = string(field(entries[0], "职业特性"));
      card.professionSpecial["希望特性"] = string(field(entries[0], "希望特性"));
    }
  }
  const take = (type) => { const index = remaining.findIndex((card) => card.type === type); return index < 0 ? padCards([], `empty-${type}`)[0] : remaining.splice(index, 1)[0]; };
  const slots = [professionCard[0] || padCards([], "empty-profession")[0], take("subclass"), take("ancestry"), take("ancestry"), take("community")];
  const hp = resource("hp"); const stress = resource("stress"); const hope = resource("hope"); const armorSlots = resource("armor-slots"); const proficiency = resource("proficiency");
  const handful = resource("handful-gold"); const bag = resource("bag-gold"); const chest = resource("chest-gold");
  const companionStress = resource("companion-stress");
  const document = {
    ruleSetId: "daggerheart", name: string(values["character-name"]), characterImage: "", level: string(values.level || "1"),
    proficiency: booleanSlots(proficiency, 6), ancestry1: string(values["ancestry-name"]), ancestry2: "", mixedAncestryEnabled: false,
    profession: professionName, community: string(values["community-name"]), subclass: string(values["subclass-name"]),
    professionRef: ref(professionName), ancestry1Ref: ref(values["ancestry-name"]), ancestry2Ref: ref(""), communityRef: ref(values["community-name"]), subclassRef: ref(values["subclass-name"]),
    evasion: string(values.evasion), evasionManualModifier: "0",
    gold: [...booleanSlots(handful, 9), ...booleanSlots(bag, 9), ...booleanSlots(chest, 3)],
    experience: strings(values, "experience", 5), experienceValues: strings(values, "experience-modifier", 5), ancestryExperience: [], ancestryExperienceValues: [],
    hope: hope.current, hopeMax: hope.max === null ? 6 : hope.max, hp: booleanSlots(hp, 18), stress: booleanSlots(stress, 18), hpMax: hp.max === null ? hp.current : hp.max, stressMax: stress.max === null ? stress.current : stress.max,
    armorBoxes: booleanSlots(armorSlots, 12), armorValue: string(values["armor-value"]), armorValueManualModifier: "0", armorBonus: "", armorMax: armorSlots.max === null ? armorSlots.current : armorSlots.max,
    minorThreshold: string(values["major-threshold"]), majorThreshold: string(values["severe-threshold"]), minorThresholdManualModifier: "0", majorThresholdManualModifier: "0",
    inventory: string(values.inventory).split(/\r?\n/u).map((item) => item.trim()).filter(Boolean).concat(["", "", "", "", ""]).slice(0, 5),
    characterBackground: string(values["background-story"]), characterAppearance: "", characterMotivation: string(values["event-log"]),
    cards: padCards(slots.concat(remaining), "empty-card"), inventory_cards: padCards(inventoryCards, "empty-inventory-card"), checkedUpgrades: exportDhUpgrades(values),
    primaryWeaponName: primary[0], primaryWeaponSelection: "", primaryWeaponTrait: primary[1], primaryWeaponDamage: primary[2], primaryWeaponFeature: string(values["primary-weapon-description"]),
    secondaryWeaponName: secondary[0], secondaryWeaponSelection: "", secondaryWeaponTrait: secondary[1], secondaryWeaponDamage: secondary[2], secondaryWeaponFeature: string(values["secondary-weapon-description"]),
    armorName: armor[0], armorSelection: "", armorBaseScore: armor[1], armorThreshold: armor[2], armorFeature: string(values["armor-description"]),
    inventoryWeapon1Name: backup1[0], inventoryWeapon1Trait: backup1[1], inventoryWeapon1Damage: backup1[2], inventoryWeapon1Feature: string(values["backup-weapon-1-description"]), inventoryWeapon1Primary: false, inventoryWeapon1Secondary: false,
    inventoryWeapon2Name: backup2[0], inventoryWeapon2Trait: backup2[1], inventoryWeapon2Damage: backup2[2], inventoryWeapon2Feature: string(values["backup-weapon-2-description"]), inventoryWeapon2Primary: false, inventoryWeapon2Secondary: false,
    companionImage: "", companionName: string(values["companion-name"]), companionDescription: "", companionRange: string(values["companion-attack-range"]), companionStress: booleanSlots(companionStress, 18), companionEvasion: string(values["companion-evasion"]), companionStressMax: companionStress.max === null ? companionStress.current : companionStress.max,
    companionWeapon: ["d6", "d8", "d10", "d12"].filter((die) => values["companion-attack-die"]?.[die] === true).join("/"), companionExperience: strings(values, "companion-experience", 5), companionExperienceValue: strings(values, "companion-experience-modifier", 5),
    trainingOptions: companionTraining(values),
    includePageThreeInExport: true, pageVisibility: { rangerCompanion: false, armorTemplate: false, adventureNotes: false },
    armorTemplate: { weaponName: "", description: "", upgradeSlots: Array.from({ length: 5 }, () => ({ checked: false, text: "" })), upgrades: { basic: {}, tier2: {}, tier3: {}, tier4: {} }, scrapMaterials: { fragments: [0, 0, 0, 0, 0, 0], metals: [0, 0, 0, 0, 0, 0], components: [0, 0, 0, 0, 0, 0], relics: ["", "", "", "", ""] }, electronicCoins: 0 },
    adventureNotes: { characterProfile: {}, playerInfo: {}, backstory: "", milestones: "", adventureLog: Array.from({ length: 8 }, () => ({ name: "", levelRange: "", trauma: "", date: "" })) },
    notebook: { pages: [{ id: "page-1", lines: [] }], currentPageIndex: 0, isOpen: false }, presetEquipmentCalcVersion: 1, domainCardAutomation: {}, branchUpgradeCount: {}, rulesetAutomationVersions: {},
  };
  for (const id of ["agility", "strength", "finesse", "instinct", "presence", "knowledge"]) document[id] = { checked: false, value: string(values[id]), spellcasting: false };
  if (professionCard[0]) { document.profession = professionCard[0].id; document.professionRef = { id: professionCard[0].id, name: professionName }; }
  for (const [index, key] of [[2, "ancestry1"], [3, "ancestry2"]]) if (slots[index].name) { document[key] = slots[index].id; document[`${key}Ref`] = { id: slots[index].id, name: slots[index].name }; }
  document.mixedAncestryEnabled = Boolean(slots[2].name && slots[3].name && slots[2].class !== slots[3].class);
  for (const [index, key] of [[1, "subclass"], [4, "community"]]) if (slots[index].name) { document[key] = slots[index].id; document[`${key}Ref`] = { id: slots[index].id, name: slots[index].name }; }
  const avatar = image(data, "character-avatar"); const companion = image(data, "companion-portrait"); if (avatar) document.characterImage = avatar; if (companion) document.companionImage = companion;
  return { document, exportedFields: Object.keys(document).length, exportedCards: (existingPrimary ? 0 : professionCard.length) + activeCards.length + inventoryCards.length, exportedImages: (avatar ? 1 : 0) + (companion ? 1 : 0), skippedFields: 0, skippedCards: diagnostics.filter((item) => item.code === "DHSHEET_CARD_UNSUPPORTED").length, skippedImages: 0, diagnostics };
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
