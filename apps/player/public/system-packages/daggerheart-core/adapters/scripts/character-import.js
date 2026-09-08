function text(value) {
  return value === undefined || value === null ? undefined : String(value);
}
function join(values) {
  const parts = values.map(text).filter((value) => value && value.trim());
  return parts.length ? parts.join("｜") : undefined;
}
function countable(current, max) {
  const safeCurrent = Number.isFinite(Number(current)) ? Math.max(0, Math.trunc(Number(current))) : 0;
  const safeMax = max === null || max === undefined || max === "" ? null : Number.isFinite(Number(max)) ? Math.max(0, Math.trunc(Number(max))) : null;
  return { current: safeMax === null ? safeCurrent : Math.min(safeCurrent, safeMax), max: safeMax };
}
function checkedCount(value) {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}
function equipment(values) {
  return values.some((value) => text(value)) ? values.map((value) => text(value) || "").join("｜") : undefined;
}
function triState(value) {
  const items = Array.isArray(value) ? value : [];
  return countable(items.filter((item) => item === 1 || item === "1").length, items.filter((item) => item !== 2 && item !== "2").length);
}
function dhUpgradeSelected(upgrades, tier, optionIndex, boxIndex, doubleBox) {
  if (!upgrades || typeof upgrades !== "object") return false;
  const checkKey = doubleBox ? `${tier}-${optionIndex}` : `${tier}-${optionIndex}-${boxIndex}`;
  const state = upgrades[checkKey];
  return Boolean(state && typeof state === "object" && state[optionIndex] === true);
}
function dhAdvancement(upgrades, tier, includeTierSpecific) {
  const state = {
    "traits-1": dhUpgradeSelected(upgrades, tier, 0, 0, false),
    "traits-2": dhUpgradeSelected(upgrades, tier, 0, 1, false),
    "traits-3": dhUpgradeSelected(upgrades, tier, 0, 2, false),
    "hp-1": dhUpgradeSelected(upgrades, tier, 1, 0, false),
    "hp-2": dhUpgradeSelected(upgrades, tier, 1, 1, false),
    "stress-1": dhUpgradeSelected(upgrades, tier, 2, 0, false),
    "stress-2": dhUpgradeSelected(upgrades, tier, 2, 1, false),
    experiences: dhUpgradeSelected(upgrades, tier, 3, 0, false),
    "domain-card": dhUpgradeSelected(upgrades, tier, 4, 0, false),
    evasion: dhUpgradeSelected(upgrades, tier, 5, 0, false),
  };
  if (includeTierSpecific) {
    state.subclass = dhUpgradeSelected(upgrades, tier, 6, 0, false);
    const proficiency = dhUpgradeSelected(upgrades, tier, 7, 0, true);
    const multiclass = dhUpgradeSelected(upgrades, tier, 8, 0, true);
    state["proficiency-1"] = proficiency; state["proficiency-2"] = proficiency;
    state["multiclass-1"] = multiclass; state["multiclass-2"] = multiclass;
  }
  return state;
}
function normalized(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).normalize("NFKC").trim().replace(/\s+/gu, " ") : "";
}
function subclassName(value) {
  const name = normalized(value);
  return /^野兽羁绊(?:基石|专精|大师)?$/u.test(name) ? "驯兽大师" : name;
}
function stem(value) {
  if (typeof value !== "string") return "";
  const name = value.replace(/\\/gu, "/").split("/").pop() || "";
  return normalized(name.replace(/\.[^.]+$/u, ""));
}
function field(entry, name) {
  return name === "ID" ? entry.ID : entry.fields && entry.fields[name] !== undefined ? entry.fields[name] : entry[name];
}
function findCard(source, libraryIds, libraries, rules) {
  const pools = libraries.filter((library) => libraryIds.includes(library.ID));
  for (const rule of rules) {
    const candidates = pools.flatMap((library) => library.entries.filter((entry) => rule(source, entry)).map((entry) => ({ libraryId: library.ID, entryId: entry.ID })));
    if (candidates.length === 1) return { match: candidates[0] };
    if (candidates.length > 1) return { ambiguous: true };
  }
  return {};
}
function cardLabel(card, index, state) {
  const value = card && typeof card === "object" ? card.name || card.名称 || (card.data && (card.data.名称 || card.data.原名)) || card.id : undefined;
  const label = normalized(value);
  return label ? `Card「${Array.from(label).slice(0, 80).join("")}」` : `Card（${state}第 ${index + 1} 项）`;
}
function addCards(output, sourceCards, state, libraryIds, libraries, rules) {
  if (!Array.isArray(sourceCards)) return;
  sourceCards.forEach((source, index) => {
    const found = findCard(source, libraryIds, libraries, rules);
    if (found.match) output.cards.push({ tableModuleId: "character-card-table", state, ...found.match });
    else {
      output.skippedCards += 1;
      output.diagnostics.push({
        level: "warning",
        code: found.ambiguous ? "CHARACTER_ADAPTER_CARD_AMBIGUOUS" : "CHARACTER_ADAPTER_CARD_NOT_FOUND",
        text: `${cardLabel(source, index, state)}${found.ambiguous ? "匹配到多个" : "没有匹配的"} Resource Entry，已跳过。`,
      });
    }
  });
}
function put(values, id, value) {
  if (value !== undefined && value !== null) values[id] = text(value);
}

function importZzz(document, libraries) {
  const output = { values: {}, cards: [], images: [], suggestedSaveName: text(document.NameTextbox), skippedFields: 0, skippedCards: 0, skippedImages: 0, diagnostics: [] };
  const pairs = {
    "character-name": "NameTextbox", "ancestry-name": "RaceTextbox", "community-name": "CommunityTextbox", "class-name": "ClassTextbox",
    level: "LevelTextbox", evasion: "EvasionTextbox", agility: "AgilityTextbox", strength: "StrengthTextbox", finesse: "FinesseTextbox",
    instinct: "InstinctTextbox", presence: "PresenceTextbox", knowledge: "KnowledgeTextbox", "major-threshold": "MajorTextbox", "severe-threshold": "SevereTextbox",
    "class-feature": "ClassFeatureTextbox", "primary-weapon-description": "PrimaryWeaponTraitTextbox", "secondary-weapon-description": "SecondaryWeaponTraitTextbox",
    "backup-weapon-1-description": "Backup1WeaponTraitTextbox", "backup-weapon-2-description": "Backup2WeaponTraitTextbox",
    "armor-value": "ArmorTextbox", "armor-description": "ArmorTraitTextbox", inventory: "ItemSlot1Textbox", "event-log": "EventLogTextbox",
  };
  Object.entries(pairs).forEach(([id, source]) => put(output.values, id, document[source]));
  put(output.values, "primary-weapon-name", join([document.PrimaryWeaponNameTextbox, document.PrimaryWeaponStatTextbox, document.PrimaryWeaponDamageTextbox]));
  put(output.values, "secondary-weapon-name", join([document.SecondaryWeaponNameTextbox, document.SecondaryWeaponStatTextbox, document.SecondaryWeaponDamageTextbox]));
  put(output.values, "backup-weapon-1-name", join([document.Backup1WeaponNameTextbox, document.Backup1WeaponStatTextbox, document.Backup1WeaponDamageTextbox]));
  put(output.values, "backup-weapon-2-name", join([document.Backup2WeaponNameTextbox, document.Backup2WeaponStatTextbox, document.Backup2WeaponDamageTextbox]));
  put(output.values, "armor-name", join([document.ArmorNameTextbox, document.ArmorThresholdTextbox, document.ArmorScoreTextbox]));
  for (let index = 1; index <= 5; index += 1) {
    put(output.values, `experience-${index}`, document[`Experience${index}Textbox`]);
    put(output.values, `experience-modifier-${index}`, document[`Experience${index}ModifierTextbox`]);
  }
  for (let index = 1; index <= 3; index += 1) {
    put(output.values, `background-question-${index}`, document[`BackgroundQuestion${index}Textbox`]);
    put(output.values, `connection-question-${index}`, document[`ConnectQuestion${index}Textbox`]);
    put(output.values, `background-answer-${index}`, document[`BackgroundAnswer${index}Textbox`]);
    put(output.values, `connection-answer-${index}`, document[`ConnectAnswer${index}Textbox`]);
  }
  for (const [id, prefix, length, tri] of [["hp", "HpSlotCheckbox", 12, true], ["stress", "StressSlotCheckbox", 12, true], ["armor-slots", "ArmorSlotCheckbox", 12, true], ["hope", "HopeSlotCheckbox", 6, false], ["proficiency", "ProficiencyCheckbox", 5, false], ["handful-gold", "HandfulGoldCheckbox", 9, false], ["bag-gold", "BagGoldCheckbox", 9, false]]) {
    const items = Array.from({ length }, (_, index) => document[`${prefix}${index + 1}`]);
    output.values[id] = tri ? triState(items) : countable(items.filter((item) => Number(item) === 1).length, length);
  }
  output.values["chest-gold"] = countable(document.ChestGoldCheckbox1, null);
  const advancement = { A1: "traits-1", A2: "traits-2", A3: "traits-3", B1: "hp-1", B2: "hp-2", C1: "stress-1", C2: "stress-2", D1: "experiences", E1: "domain-card", G1: "evasion" };
  for (const tier of [2, 3, 4]) {
    const state = {};
    Object.entries(advancement).forEach(([suffix, option]) => { state[option] = Number(document[`LevelupT${tier}_${suffix}`]) === 1; });
    if (tier >= 3) {
      state.subclass = Number(document[`LevelupT${tier}_F1`]) === 1;
      const proficiency = Number(document[`LevelupT${tier}_H1`]) === 1;
      const multiclass = Number(document[`LevelupT${tier}_I1`]) === 1;
      state["proficiency-1"] = proficiency; state["proficiency-2"] = proficiency;
      state["multiclass-1"] = multiclass; state["multiclass-2"] = multiclass;
    }
    output.values[`advancement-tier-${tier}`] = state;
  }
  if (typeof document.avatarImageSrc === "string" && document.avatarImageSrc) output.images.push({ moduleId: "character-avatar", name: "ZZZ avatar", dataUrl: document.avatarImageSrc });
  const rules = [
    (source, entry) => normalized(source && source.data && source.data.原名) !== "" && normalized(source.data.原名) === normalized(field(entry, "原名")),
    (source, entry) => normalized(source && source.data && source.data.名称) !== "" && normalized(source.data.名称) === normalized(field(entry, "名称")),
    (source, entry) => stem(source && source.data) !== "" && stem(source.data) === stem(field(entry, "卡图")),
    (source, entry) => normalized(source && source.data && source.data.描述) !== "" && normalized(source.data.描述) === normalized(field(entry, "描述")),
  ];
  addCards(output, document.cards, "配置", ["ancestries", "communities", "subclasses", "domain-cards"], libraries, rules);
  return output;
}

function importDhSheet(document, libraries) {
  const output = { values: {}, cards: [], images: [], suggestedSaveName: text(document.name), skippedFields: 0, skippedCards: 0, skippedImages: 0, diagnostics: [] };
  const pairs = {
    "character-name": document.name, "ancestry-name": document.ancestry1Ref && document.ancestry1Ref.name, "community-name": document.communityRef && document.communityRef.name,
    "class-name": document.professionRef && document.professionRef.name, "subclass-name": document.subclassRef && document.subclassRef.name, level: document.level, evasion: document.evasion,
    agility: document.agility && document.agility.value, strength: document.strength && document.strength.value, finesse: document.finesse && document.finesse.value,
    instinct: document.instinct && document.instinct.value, presence: document.presence && document.presence.value, knowledge: document.knowledge && document.knowledge.value,
    "major-threshold": document.minorThreshold, "severe-threshold": document.majorThreshold,
    "primary-weapon-name": equipment([document.primaryWeaponName, document.primaryWeaponTrait, document.primaryWeaponDamage]), "primary-weapon-description": document.primaryWeaponFeature,
    "secondary-weapon-name": equipment([document.secondaryWeaponName, document.secondaryWeaponTrait, document.secondaryWeaponDamage]), "secondary-weapon-description": document.secondaryWeaponFeature,
    "backup-weapon-1-name": equipment([document.inventoryWeapon1Name, document.inventoryWeapon1Trait, document.inventoryWeapon1Damage]), "backup-weapon-1-description": document.inventoryWeapon1Feature,
    "backup-weapon-2-name": equipment([document.inventoryWeapon2Name, document.inventoryWeapon2Trait, document.inventoryWeapon2Damage]), "backup-weapon-2-description": document.inventoryWeapon2Feature,
    "armor-name": equipment([document.armorName, document.armorBaseScore, document.armorThreshold]), "armor-value": document.armorValue, "armor-description": document.armorFeature,
    "background-story": document.characterBackground, inventory: Array.isArray(document.inventory) ? document.inventory.filter((item) => text(item) && text(item).trim()).join("\n") : undefined,
    "event-log": document.characterMotivation, "companion-name": document.companionName, "companion-evasion": document.companionEvasion, "companion-attack-range": document.companionRange,
  };
  Object.entries(pairs).forEach(([id, value]) => put(output.values, id, value));
  const allCards = [...(Array.isArray(document.cards) ? document.cards : []), ...(Array.isArray(document.inventory_cards) ? document.inventory_cards : [])];
  if (output.values["subclass-name"]) output.values["subclass-name"] = subclassName(output.values["subclass-name"]);
  const ancestryCards = [1, 2].map((slot) => allCards.find((card) => card && card.type === "ancestry" && card.id === (document[`ancestry${slot}Ref`]?.id || document[`ancestry${slot}`])) || (Array.isArray(document.cards) ? document.cards.find((card) => card && card.type === "ancestry" && Number(card.level) === slot) : undefined));
  if (ancestryCards.some(Boolean)) {
    const entries = libraries.find((library) => library.ID === "ancestries")?.entries || [];
    const fields = {};
    ancestryCards.forEach((card, index) => {
      const slot = index === 0 ? "A" : "B";
      const matches = card ? entries.filter((entry) => {
        const feature = entry.resourceCopy?.data?.特性?.[index];
        return feature && normalized(feature.特性名称) === normalized(card.name);
      }) : [];
      const legacyNames = [{ 坚韧: "巨人" }, { 坚定不移: "费尔博格" }];
      fields[`种族${slot}名称`] = matches.length === 1 ? text(field(matches[0], "名称")) : card ? legacyNames[index][card.name] || "" : "";
      fields[`特性${slot}`] = card ? `${card.name || ""}：${card.description || ""}` : "";
    });
    output.values["ancestry-name"] = `${fields.种族A名称} / ${fields.种族B名称}`;
    output.composedCards = [{ composerModuleId: "pick-ancestry", tableModuleId: "character-card-table", state: "配置", fields }];
  }
  if (["d6", "d8", "d10", "d12"].includes(document.companionWeapon)) {
    output.values["companion-attack-die"] = Object.fromEntries(["d6", "d8", "d10", "d12"].map((die) => [die, die === document.companionWeapon]));
  } else if (document.companionWeapon) {
    output.skippedFields += 1;
    output.diagnostics.push({ level: "warning", code: "DHSHEET_COMPANION_DIE_UNSUPPORTED", text: "伙伴攻击方式不是 d6/d8/d10/d12，未猜测伤害骰。" });
  }
  if (document.trainingOptions) {
    const mapping = { intelligent: ["wise-1", "wise-2", "wise-3"], radiantInDarkness: ["light-in-dark"], creatureComfort: ["creature-comfort"], armored: ["armored"], vicious: ["trained-1", "trained-2", "trained-3"], resilient: ["resilient-1", "resilient-2", "resilient-3"], bonded: ["protective"], aware: ["aware-1", "aware-2", "aware-3"] };
    output.values["companion-upgrades"] = Object.fromEntries(Object.entries(mapping).flatMap(([source, ids]) => ids.map((id, index) => [id, document.trainingOptions[source]?.[index] === true])));
  }
  const profession = Array.isArray(document.cards) ? document.cards.find((card) => card && card.type === "profession" && card.id === document.profession) : undefined;
  put(output.values, "class-feature", profession && profession.description);
  if (Array.isArray(document.cards)) {
    const additional = document.cards.filter((card) => card && card.type === "profession" && card.name && card !== profession);
    if (additional.length) output.values["class-feature"] = [profession && profession.description, ...additional.map((card) => `【${card.class || card.name}】\n${card.description || ""}`)].filter(Boolean).join("\n\n");
  }
  put(output.values, "class-hope-feature", profession && profession.professionSpecial && profession.professionSpecial["希望特性"]);
  for (let index = 0; index < 5; index += 1) { put(output.values, `experience-${index + 1}`, document.experience && document.experience[index]); put(output.values, `experience-modifier-${index + 1}`, document.experienceValues && document.experienceValues[index]); }
  for (let index = 0; index < 5; index += 1) { put(output.values, `companion-experience-${index + 1}`, document.companionExperience && document.companionExperience[index]); put(output.values, `companion-experience-modifier-${index + 1}`, document.companionExperienceValue && document.companionExperienceValue[index]); }
  output.values.hp = countable(checkedCount(document.hp), document.hpMax);
  output.values.stress = countable(checkedCount(document.stress), document.stressMax);
  output.values.hope = countable(document.hope, document.hopeMax);
  output.values["armor-slots"] = countable(checkedCount(document.armorBoxes), document.armorMax);
  output.values.proficiency = countable(Array.isArray(document.proficiency) ? checkedCount(document.proficiency) : document.proficiency, 6);
  const gold = Array.isArray(document.gold) ? document.gold : [];
  output.values["handful-gold"] = countable(checkedCount(gold.slice(0, 9)), 9);
  output.values["bag-gold"] = countable(checkedCount(gold.slice(9, 18)), 9);
  output.values["chest-gold"] = countable(checkedCount(gold.slice(18)), null);
  output.values["companion-stress"] = countable(checkedCount(document.companionStress), document.companionStressMax);
  output.values["advancement-tier-2"] = dhAdvancement(document.checkedUpgrades, "tier1", false);
  output.values["advancement-tier-3"] = dhAdvancement(document.checkedUpgrades, "tier2", true);
  output.values["advancement-tier-4"] = dhAdvancement(document.checkedUpgrades, "tier3", true);
  if (typeof document.characterImage === "string" && document.characterImage) output.images.push({ moduleId: "character-avatar", name: "dhSheet character image", dataUrl: document.characterImage });
  if (typeof document.companionImage === "string" && document.companionImage) output.images.push({ moduleId: "companion-portrait", name: "dhSheet companion image", dataUrl: document.companionImage });
  const rules = [
    (source, entry) => normalized(source && source.id) !== "" && normalized(source.id) === normalized(entry.ID),
    (source, entry) => source.type === "subclass" && normalized(source.class) === normalized(field(entry, "主职")) && Number(source.level) === ({ 基础: 1, 进阶: 2, 精通: 3 })[field(entry, "等级")] && [source.name, source.headerDisplay].some((name) => subclassName(name) !== "" && subclassName(name) === normalized(field(entry, "名称"))),
    (source, entry) => source.type !== "subclass" && normalized(source && source.id) !== "" && normalized(source.id) === normalized(field(entry, "原名")),
    (source, entry) => normalized(source && source.name) !== "" && normalized(source.name) === normalized(field(entry, "名称")) && normalized(source.class) !== "" && normalized(source.class) === normalized(field(entry, "领域")),
    (source, entry) => source.type !== "subclass" && normalized(source && source.name) !== "" && normalized(source.name) === normalized(field(entry, "名称")),
    (source, entry) => normalized(source && source.description) !== "" && normalized(source.description) === normalized(field(entry, "描述")),
  ];
  const types = { profession: "classes", community: "communities", subclass: "subclasses", domain: "domain-cards" };
  for (const [cards, state] of [[document.cards, "配置"], [document.inventory_cards, "宝库"]]) {
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      if (!card || !card.name || card.type === "unknown") continue;
      if (card.type === "profession" || ancestryCards.includes(card)) continue;
      addCards(output, [card], state, types[card.type] ? [types[card.type]] : [], libraries, rules);
    }
  }
  return output;
}

module.exports = function (input) {
  const document = input.document || {};
  return Object.prototype.hasOwnProperty.call(document, "NameTextbox") ? importZzz(document, input.resourceLibraries || []) : importDhSheet(document, input.resourceLibraries || []);
};
