function text(value) {
  return value === undefined || value === null ? undefined : String(value);
}

function normalized(value) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).normalize("NFKC").trim().replace(/\s+/gu, " ")
    : "";
}

function joined(values) {
  const parts = values.map(text).filter((value) => value !== undefined).map((value) => value.trim()).filter(Boolean);
  return parts.length ? parts.join("｜") : undefined;
}

function put(values, id, value) {
  if (value !== undefined && value !== null) values[id] = typeof value === "string" ? value : text(value);
}

function countable(current, max) {
  const safeCurrent = Number.isFinite(Number(current)) ? Math.max(0, Math.trunc(Number(current))) : 0;
  const safeMax = max === undefined || max === null || max === ""
    ? null
    : Number.isFinite(Number(max)) ? Math.max(0, Math.trunc(Number(max))) : null;
  return { current: safeMax === null ? safeCurrent : Math.min(safeCurrent, safeMax), max: safeMax };
}

function checkedCount(value) {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

function upgradeSelected(upgrades, tier, optionIndex, boxIndex, doubleBox) {
  if (!upgrades || typeof upgrades !== "object") return false;
  const key = doubleBox ? `${tier}-${optionIndex}` : `${tier}-${optionIndex}-${boxIndex}`;
  const state = upgrades[key];
  return Boolean(state && typeof state === "object" && state[optionIndex] === true);
}

function advancement(upgrades, sourceTier, targetTier) {
  const result = {
    "traits-1": upgradeSelected(upgrades, sourceTier, 0, 0, false),
    "traits-2": upgradeSelected(upgrades, sourceTier, 0, 1, false),
    "traits-3": upgradeSelected(upgrades, sourceTier, 0, 2, false),
    "hp-1": upgradeSelected(upgrades, sourceTier, 1, 0, false),
    "hp-2": upgradeSelected(upgrades, sourceTier, 1, 1, false),
    "stress-1": upgradeSelected(upgrades, sourceTier, 2, 0, false),
    "stress-2": upgradeSelected(upgrades, sourceTier, 2, 1, false),
    experiences: upgradeSelected(upgrades, sourceTier, 3, 0, false),
    "domain-card": upgradeSelected(upgrades, sourceTier, 4, 0, false),
    evasion: upgradeSelected(upgrades, sourceTier, 5, 0, false),
  };
  if (targetTier === 2) {
    result.subclass = false;
    result["multiclass-1"] = false;
  } else {
    const subclass = upgradeSelected(upgrades, sourceTier, 6, 0, false);
    result[targetTier === 4 ? "subclass-elite" : "subclass"] = subclass;
    const proficiency = upgradeSelected(upgrades, sourceTier, 7, 0, true);
    const multiclass = upgradeSelected(upgrades, sourceTier, 8, 0, true);
    result["proficiency-1"] = proficiency;
    result["proficiency-2"] = proficiency;
    result["multiclass-1"] = multiclass;
  }
  return result;
}

function field(entry, name) {
  return name === "ID" ? entry.ID : entry.fields && entry.fields[name] !== undefined ? entry.fields[name] : entry[name];
}

function library(input, id) {
  return (input.resourceLibraries || []).find((candidate) => candidate.ID === id);
}

function uniqueEntry(input, libraryId, predicate) {
  const entries = (library(input, libraryId) || {}).entries || [];
  const matches = entries.filter(predicate);
  return matches.length === 1 ? matches[0] : undefined;
}

function byName(input, libraryId, name) {
  const expected = normalized(name);
  return expected ? uniqueEntry(input, libraryId, (entry) => normalized(field(entry, "名称")) === expected) : undefined;
}

function pushCard(output, entry, libraryId, state) {
  if (!entry) return;
  output.cards.push({ tableModuleId: "character-card-table", state, libraryId, entryId: entry.ID });
}

function reportMissingCard(output, name) {
  output.skippedCards += 1;
  output.diagnostics.push({
    level: "warning", code: "CHARACTER_ADAPTER_CARD_NOT_FOUND",
    text: `Card「${normalized(name)}」没有匹配的 Resource Entry，已跳过。`,
  });
}

module.exports = function (input) {
  const document = input.document || {};
  const output = {
    values: {}, cards: [], images: [], suggestedSaveName: text(document.name),
    skippedFields: 0, skippedCards: 0, skippedImages: 0, diagnostics: [],
  };
  const professionName = document.professionRef && document.professionRef.name;
  const subclassName = document.subclassRef && document.subclassRef.name;
  const ancestryName = document.ancestry1Ref && document.ancestry1Ref.name;
  const communityName = document.communityRef && document.communityRef.name;
  const selectedClass = byName(input, "classes", professionName);
  const selectedSubclass = uniqueEntry(input, "subclasses", (entry) =>
    normalized(field(entry, "主职")) === normalized(professionName)
      && normalized(field(entry, "名称")) === normalized(subclassName)
      && normalized(field(entry, "阶段")) === "T1");

  const scalarPairs = {
    "character-name": document.name, level: document.level, "class-name": professionName, "subclass-name": subclassName,
    "ancestry-name": ancestryName, "community-name": communityName, "secondary-domain": document.rhodesSecondaryDomain,
    evasion: document.evasion, "armor-value": document.armorValue,
    "major-threshold": document.minorThreshold, "severe-threshold": document.majorThreshold,
    agility: document.agility && document.agility.value, strength: document.strength && document.strength.value,
    finesse: document.finesse && document.finesse.value, instinct: document.instinct && document.instinct.value,
    presence: document.presence && document.presence.value, knowledge: document.knowledge && document.knowledge.value,
    "weapon-feature": document.primaryWeaponFeature, "armor-feature": document.armorFeature,
    "background-story": document.characterBackground, notes: document.characterMotivation,
    "ancestry-experience": Array.isArray(document.ancestryExperience) ? document.ancestryExperience[0] : undefined,
    "ancestry-experience-modifier": Array.isArray(document.ancestryExperienceValues) ? document.ancestryExperienceValues[0] : undefined,
  };
  Object.entries(scalarPairs).forEach(([id, value]) => put(output.values, id, value));
  put(output.values, "weapon-summary", joined([document.primaryWeaponName, document.primaryWeaponTrait, document.primaryWeaponDamage]));
  put(output.values, "armor-summary", joined([document.armorName, document.armorBaseScore, document.armorThreshold]));
  for (let index = 0; index < 5; index += 1) {
    put(output.values, `experience-${index + 1}`, document.experience && document.experience[index]);
    put(output.values, `experience-modifier-${index + 1}`, document.experienceValues && document.experienceValues[index]);
  }
  output.values.hp = countable(checkedCount(document.hp), document.hpMax);
  output.values.stress = countable(checkedCount(document.stress), document.stressMax);
  output.values.hope = countable(document.hope, document.hopeMax);
  output.values["armor-slots"] = countable(checkedCount(document.armorBoxes), document.armorMax);
  output.values.proficiency = countable(checkedCount(document.proficiency), Array.isArray(document.proficiency) ? document.proficiency.length : undefined);
  const gold = Array.isArray(document.gold) ? document.gold : [];
  output.values["handful-gold"] = countable(checkedCount(gold.slice(0, 9)), 9);
  output.values["bag-gold"] = countable(checkedCount(gold.slice(9, 18)), 9);
  output.values["chest-gold"] = countable(checkedCount(gold.slice(18)), null);
  output.values["advancement-tier-2"] = advancement(document.checkedUpgrades, "tier1", 2);
  output.values["advancement-tier-3"] = advancement(document.checkedUpgrades, "tier2", 3);
  output.values["advancement-tier-4"] = advancement(document.checkedUpgrades, "tier3", 4);
  if (selectedClass) {
    output.values["primary-domain"] = text(field(selectedClass, "主领域"));
    output.values["class-hope-feature"] = text(field(selectedClass, "希望特性"));
    output.values["class-feature"] = text(field(selectedClass, "职业特性"));
  } else if (normalized(professionName)) {
    output.skippedFields += 1;
    output.diagnostics.push({ level: "warning", code: "TTTRI_DHSHEET_CLASS_NOT_FOUND", text: `职业「${normalized(professionName)}」没有匹配的 TTTRI Resource Entry。` });
  }
  if (selectedSubclass) {
    output.values["subclass-stage"] = text(field(selectedSubclass, "等级"));
    output.values["subclass-current"] = text(field(selectedSubclass, "子职特性"));
    output.values["weapon-summary"] = text(field(selectedSubclass, "武器原型"));
  } else if (normalized(subclassName)) {
    output.skippedFields += 1;
    output.diagnostics.push({ level: "warning", code: "TTTRI_DHSHEET_SUBCLASS_NOT_FOUND", text: `子职「${normalized(subclassName)}」没有匹配的 TTTRI Resource Entry。` });
  }
  if (joined([document.primaryWeaponName, document.primaryWeaponTrait, document.primaryWeaponDamage])) {
    output.values["weapon-summary"] = joined([document.primaryWeaponName, document.primaryWeaponTrait, document.primaryWeaponDamage]);
  }

  const inventory = Array.isArray(document.inventory)
    ? document.inventory.map(text).filter((value) => value !== undefined).map((value) => value.trim()).filter(Boolean)
    : [];
  const secondarySummary = joined([document.secondaryWeaponName, document.secondaryWeaponTrait, document.secondaryWeaponDamage]);
  if (secondarySummary) {
    inventory.push(`副武器：${secondarySummary}`);
    if (normalized(document.secondaryWeaponFeature)) inventory.push(`副武器特性：${text(document.secondaryWeaponFeature)}`);
    output.diagnostics.push({
      level: "warning",
      code: "TTTRI_DHSHEET_SECONDARY_WEAPON_STORED_IN_INVENTORY",
      text: `TTTRI 只有一个武器栏；副武器「${normalized(document.secondaryWeaponName) || secondarySummary}」已保存在物品栏。`,
    });
  }
  put(output.values, "inventory", inventory.join("\n"));
  if (typeof document.characterImage === "string" && document.characterImage) {
    output.images.push({ moduleId: "character-avatar", name: "dhSheet character image", dataUrl: document.characterImage });
  }

  const ancestryEntry = byName(input, "ancestries", ancestryName);
  const communityEntry = byName(input, "communities", communityName);
  pushCard(output, ancestryEntry, "ancestries", "配置");
  pushCard(output, communityEntry, "communities", "配置");
  if (normalized(ancestryName) && !ancestryEntry) reportMissingCard(output, ancestryName);
  if (normalized(communityName) && !communityEntry) reportMissingCard(output, communityName);
  const addSourceCards = (cards, state) => {
    if (!Array.isArray(cards)) return;
    cards.filter((card) => card && card.type === "domain").forEach((card, index) => {
      const domain = normalized(card.class);
      const name = normalized(card.name);
      const entries = (library(input, "domain-cards") || {}).entries || [];
      const qualified = entries.filter((candidate) =>
        normalized(field(candidate, "领域")) === domain && normalized(field(candidate, "名称")) === name);
      const candidates = qualified.length ? qualified : entries.filter((candidate) => normalized(field(candidate, "名称")) === name);
      if (candidates.length === 1) {
        pushCard(output, candidates[0], "domain-cards", state);
        return;
      }
      output.skippedCards += 1;
      const label = name || `第 ${index + 1} 项`;
      output.diagnostics.push({
        level: "warning",
        code: candidates.length > 1 ? "CHARACTER_ADAPTER_CARD_AMBIGUOUS" : "CHARACTER_ADAPTER_CARD_NOT_FOUND",
        text: `Card「${label}」${candidates.length > 1 ? "匹配到多个" : "没有匹配的"} Resource Entry，已跳过。`,
      });
    });
  };
  addSourceCards(document.cards, "配置");
  addSourceCards(document.inventory_cards, "宝库");
  return output;
};
