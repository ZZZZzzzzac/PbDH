module.exports = ({ characterData, resourceLibraries }) => {
  const context = createContext(characterData, resourceLibraries);
  const issues = [];

  checkLevel(issues, context);
  checkRequiredCardCounts(issues, context);
  checkWeaponLoadout(issues, context);
  checkAdvancement(issues, context);
  checkDomainCards(issues, context);
  checkDerivedValues(issues, context);

  return issues;
};

const TRAITS = ["agility", "strength", "finesse", "instinct", "presence", "knowledge"];
const INITIAL_TRAITS = [2, 1, 1, 0, 0, -1];
const TIER_IDS = ["advancement-tier-2", "advancement-tier-3", "advancement-tier-4"];
const TIER_CAPS = [4, 7, 10];

function createContext(characterData, resourceLibraries) {
  const values = characterData.character.values;
  const libraries = new Map(resourceLibraries.map((library) => [library.ID, library]));
  const cards = (characterData.cards?.instances ?? []).map((instance) => resolveCard(instance, libraries, characterData.compositeResources ?? {})).filter(Boolean);
  const level = integer(values.level);
  const tier = level === undefined ? undefined : level >= 8 ? 4 : level >= 5 ? 3 : level >= 2 ? 2 : 1;
  const classEntry = findEntryByName(libraries.get("classes"), text(values["class-name"]));
  const armorEntry = findEntryByName(libraries.get("armor"), text(values["armor-name"]));
  const primaryWeapon = findEntryByName(libraries.get("weapons"), selectedName(values["primary-weapon-name"]));
  const secondaryWeapon = findEntryByName(libraries.get("weapons"), selectedName(values["secondary-weapon-name"]));
  const inventoryEntries = inventoryNames(values.inventory).map((name) => findEntryByName(libraries.get("loot"), name)).filter(Boolean);

  return {
    values,
    libraries,
    cards,
    level,
    tier,
    classEntry,
    armorEntry,
    primaryWeapon,
    secondaryWeapon,
    weapons: [primaryWeapon, secondaryWeapon].filter(Boolean),
    inventoryEntries,
  };
}

function checkWeaponLoadout(issues, context) {
  if (context.secondaryWeapon && field(context.secondaryWeapon, "类型") === "主武器") {
    warn(issues, "PRIMARY_WEAPON_IN_SECONDARY_SLOT", "character.values.secondary-weapon-name", "副武器栏不能装备主武器。" );
  }

  const hasSecondaryWeapon = text(context.values["secondary-weapon-name"]) !== "";
  if (
    context.primaryWeapon
    && field(context.primaryWeapon, "负荷") === "双手"
    && field(context.classEntry, "名称") !== "战士"
    && hasSecondaryWeapon
  ) {
    warn(issues, "TWO_HANDED_PRIMARY_WITH_SECONDARY", "character.values.secondary-weapon-name", "除战士外，装备双手主武器时副武器栏必须为空。" );
  }
}

function checkRequiredCardCounts(issues, context) {
  const ancestryCount = context.cards.filter((card) => card.libraryId === "composite" && field(card.entry, "种族A名称") && field(card.entry, "种族B名称")).length;
  const communityCount = context.cards.filter((card) => card.libraryId === "communities").length;
  const subclassCount = context.cards.filter((card) => card.libraryId === "subclasses").length;

  if (ancestryCount !== 1) {
    warn(issues, "ANCESTRY_CARD_COUNT_MISMATCH", "cards.instances", `种族卡应有且只有 1 张，当前为 ${ancestryCount} 张。`);
  }
  if (communityCount !== 1) {
    warn(issues, "COMMUNITY_CARD_COUNT_MISMATCH", "cards.instances", `社群卡应有且只有 1 张，当前为 ${communityCount} 张。`);
  }
  if (subclassCount < 1) {
    warn(issues, "SUBCLASS_CARD_COUNT_MISMATCH", "cards.instances", "子职卡至少应有 1 张。" );
  }
}

function checkLevel(issues, context) {
  if (context.level !== undefined && context.level >= 1 && context.level <= 10) return;
  warn(issues, "LEVEL_INVALID", "character.values.level", "等级应为 1 到 10 的整数。");
}

function checkAdvancement(issues, context) {
  if (!validLevel(context.level)) return;

  const states = TIER_IDS.map((id) => checkboxState(context.values[id]));
  const expectedByTier = [
    2 * clamp(context.level - 1, 0, 3),
    2 * clamp(context.level - 4, 0, 3),
    2 * clamp(context.level - 7, 0, 3),
  ];

  states.forEach((state, index) => {
    const actual = checkedCount(state);
    if (actual !== expectedByTier[index]) {
      warn(
        issues,
        "ADVANCEMENT_COUNT_MISMATCH",
        `character.values.${TIER_IDS[index]}`,
        `位阶 ${index + 2} 应标记 ${expectedByTier[index]} 个升级槽，当前为 ${actual} 个。`,
      );
    }
    checkPairedOption(issues, state, TIER_IDS[index], "proficiency", "熟练值");
    checkPairedOption(issues, state, TIER_IDS[index], "multiclass", "兼职");
    if (selected(state, "subclass") && pairSelected(state, "multiclass")) {
      warn(issues, "SUBCLASS_MULTICLASS_CONFLICT", `character.values.${TIER_IDS[index]}`, `位阶 ${index + 2} 不能同时选择升级子职业与兼职。`);
    }
  });

  if (states.filter((state) => pairSelected(state, "multiclass")).length > 1) {
    warn(issues, "MULTICLASS_REPEATED", "character.values", "每个角色只能选择一次兼职。" );
  }

  checkTraits(issues, context, states);
  checkProficiency(issues, context, states);
  checkExperiences(issues, context, states);
}

function checkPairedOption(issues, state, moduleId, option, label) {
  const first = selected(state, `${option}-1`);
  const second = selected(state, `${option}-2`);
  if (first === second) return;
  warn(issues, "PAIRED_ADVANCEMENT_INCOMPLETE", `character.values.${moduleId}`, `${label}升级必须同时标记两个升级槽。`);
}

function checkTraits(issues, context, states) {
  const actual = TRAITS.map((id) => integer(context.values[id]));
  if (actual.some((value) => value === undefined)) {
    warn(issues, "TRAIT_VALUE_INVALID", "character.values", "六项角色属性都应填写整数。" );
    return;
  }

  const staticModifiers = staticTraitModifiers(context);
  const normalized = actual.map((value, index) => value - staticModifiers[index]);
  const upgrades = states.map((state) => countSelectedPrefix(state, "traits-"));

  if (upgrades.some((count) => count > 3) || !hasLegalTraitAllocation(normalized, upgrades)) {
    warn(
      issues,
      "TRAIT_DISTRIBUTION_MISMATCH",
      "character.values",
      "角色属性无法由初始 2、1、1、0、0、-1 与已标记的属性升级合法产生；同一位阶内同一属性最多提升一次。",
    );
  }
}

function checkProficiency(issues, context, states) {
  const expected = context.tier + states.filter((state) => pairSelected(state, "proficiency")).length;
  compareCountableCurrent(issues, context.values.proficiency, expected, {
    code: "PROFICIENCY_MISMATCH",
    path: "character.values.proficiency",
    label: "熟练值",
  });
}

function checkExperiences(issues, context, states) {
  const filled = [];
  for (let index = 1; index <= 5; index += 1) {
    const name = text(context.values[`experience-${index}`]);
    const modifier = integer(context.values[`experience-modifier-${index}`]);
    if (name) filled.push({ index, modifier });
    else if (modifier !== undefined) {
      warn(issues, "ORPHAN_EXPERIENCE_MODIFIER", `character.values.experience-modifier-${index}`, `经历 ${index} 未填写名称，但填写了调整值。`);
    }
  }

  const expectedCount = context.tier + 1;
  if (filled.length !== expectedCount) {
    warn(issues, "EXPERIENCE_COUNT_MISMATCH", "character.values", `当前位阶应有 ${expectedCount} 项经历，当前填写 ${filled.length} 项。`);
  }
  if (filled.some((experience) => experience.modifier === undefined)) {
    warn(issues, "EXPERIENCE_MODIFIER_INVALID", "character.values", "所有已填写经历都应填写整数调整值。" );
    return;
  }

  const upgradeCount = states.filter((state) => selected(state, "experiences")).length;
  const hasConstructBonus = hasAncestrySlot(context, "A", "械灵");
  const hasMasterOfCraft = hasOwnedDomain(context, "技艺大师");
  const excess = filled.map((experience) => experience.modifier - 2);

  if (!hasLegalExperienceAllocation(excess, upgradeCount, hasConstructBonus, hasMasterOfCraft)) {
    warn(issues, "EXPERIENCE_MODIFIER_MISMATCH", "character.values", "经历调整值无法由基础 +2、经历升级及已拥有的永久能力合法产生。" );
  }
}

function checkDomainCards(issues, context) {
  if (!validLevel(context.level)) return;
  const domainCards = context.cards.filter((card) => card.libraryId === "domain-cards");
  const states = TIER_IDS.map((id) => checkboxState(context.values[id]));
  const extraUpgradeCaps = [];
  states.forEach((state, index) => {
    if (selected(state, "domain-card")) extraUpgradeCaps.push(Math.min(context.level, TIER_CAPS[index]));
  });
  const knowledgeStages = context.cards.filter((card) => card.libraryId === "subclasses" && field(card.entry, "名称") === "知识学派").length;
  const expectedCount = context.level + 1 + extraUpgradeCaps.length + knowledgeStages;

  if (domainCards.length !== expectedCount) {
    warn(issues, "DOMAIN_CARD_COUNT_MISMATCH", "cards.instances", `领域卡总数应为 ${expectedCount} 张，当前为 ${domainCards.length} 张。`);
  }

  const actualLevels = domainCards.map((card) => domainLevel(field(card.entry, "等级")));
  if (actualLevels.some((level) => level === undefined)) {
    warn(issues, "DOMAIN_CARD_LEVEL_INVALID", "cards.instances", "存在无法识别等级的领域卡。" );
    return;
  }
  const allowedLevels = [1, 1];
  for (let level = 2; level <= context.level; level += 1) allowedLevels.push(level);
  allowedLevels.push(...extraUpgradeCaps);
  for (let index = 0; index < knowledgeStages; index += 1) allowedLevels.push(context.level);
  actualLevels.sort((left, right) => left - right);
  allowedLevels.sort((left, right) => left - right);

  const legal = actualLevels.length === allowedLevels.length && actualLevels.every((level, index) => level <= allowedLevels[index]);
  if (!legal) {
    warn(issues, "DOMAIN_CARD_LEVEL_MISMATCH", "cards.instances", "领域卡等级分布超过了初始、逐级升级或额外领域卡来源允许的上限。" );
  }

  checkDomainCardAffiliation(issues, context, domainCards);
}

function checkDomainCardAffiliation(issues, context, domainCards) {
  if (!context.classEntry) return;
  const primaryDomains = classDomains(context.classEntry);
  if (primaryDomains.length !== 2) return;

  const multiclassNames = [...new Set(context.cards
    .filter((card) => card.libraryId === "subclasses")
    .map((card) => field(card.entry, "主职"))
    .filter((name) => name && name !== field(context.classEntry, "名称")))];
  const extraDomains = [...new Set(domainCards.map((card) => field(card.entry, "领域")).filter((domain) => !primaryDomains.includes(domain)))];

  let legal = false;
  if (multiclassNames.length === 0) {
    legal = extraDomains.length === 0;
  } else if (multiclassNames.length === 1) {
    const multiclassEntry = findEntryByName(context.libraries.get("classes"), multiclassNames[0]);
    const multiclassDomains = classDomains(multiclassEntry);
    legal = extraDomains.length <= 1 && extraDomains.every((domain) => multiclassDomains.includes(domain));
  }

  if (!legal) {
    const domains = extraDomains.length > 0 ? extraDomains.join("、") : "无法确定";
    warn(issues, "DOMAIN_CARD_AFFILIATION_MISMATCH", "cards.instances", `领域卡包含不属于当前职业领域的选择：${domains}。兼职角色只能从兼职职业的两个领域中选择一个。`);
  }
}

function checkDerivedValues(issues, context) {
  checkArmor(issues, context);
  checkEvasion(issues, context);
  checkPersistentPoolsAndThresholds(issues, context);
}

function checkArmor(issues, context) {
  const displayedArmor = integer(context.values["armor-value"]);
  const armorMaximum = countableMax(context.values["armor-slots"]);
  if (displayedArmor === undefined || displayedArmor !== armorMaximum) {
    warn(
      issues,
      "ARMOR_VALUE_MAX_MISMATCH",
      "character.values.armor-value",
      `护甲值应与护甲槽上限相同；当前护甲值为 ${displayedArmor ?? "未填写或不是整数"}，护甲槽上限为 ${armorMaximum ?? "无上限"}。`,
    );
  }

  let expected;
  if (context.armorEntry) {
    expected = integer(field(context.armorEntry, "护甲值"));
  } else if (hasActiveDomain(context, "铁骨铮铮")) {
    const strength = integer(context.values.strength);
    if (strength !== undefined) expected = 3 + strength;
  }
  if (expected === undefined) return;

  for (const weapon of context.weapons) expected += weaponArmorModifier(field(weapon, "名称"));
  if (context.armorEntry && hasActiveDomain(context, "护甲大师")) expected += 1;
  if (activeDomainCount(context, "勇气") >= 4 && hasActiveDomain(context, "勇气恩泽")) expected += 1;

  compareCountableMax(issues, context.values["armor-slots"], expected, {
    code: "ARMOR_MAX_MISMATCH",
    path: "character.values.armor-slots",
    label: "护甲值",
  });
}

function checkEvasion(issues, context) {
  if (!context.classEntry) return;
  let expected = integer(field(context.classEntry, "闪避值"));
  if (expected === undefined) return;

  const states = TIER_IDS.map((id) => checkboxState(context.values[id]));
  expected += states.filter((state) => selected(state, "evasion")).length;
  if (hasAncestrySlot(context, "B", "猿族")) expected += 1;
  if (context.armorEntry) expected += armorEvasionModifier(field(context.armorEntry, "名称"));
  for (const weapon of context.weapons) expected += weaponEvasionModifier(field(weapon, "名称"));
  if (hasSubclass(context, "黑夜行者", "精通")) expected += 1;
  if (hasActiveDomain(context, "不可侵犯")) {
    const agility = integer(context.values.agility);
    if (agility !== undefined) expected += Math.ceil(agility / 2);
  }

  compareTextInteger(issues, context.values.evasion, expected, {
    code: "EVASION_MISMATCH",
    path: "character.values.evasion",
    label: "闪避值",
  });
}

function checkPersistentPoolsAndThresholds(issues, context) {
  const states = TIER_IDS.map((id) => checkboxState(context.values[id]));
  const proficiency = countableCurrent(context.values.proficiency);
  const hasFlourishingLife = hasOwnedDomain(context, "蓬勃生命");

  const expected = {
    hp: context.classEntry ? add(integer(field(context.classEntry, "生命点")), countSelected(states, "hp-")) : undefined,
    stress: 6 + countSelected(states, "stress-"),
    major: undefined,
    severe: undefined,
  };

  if (expected.hp !== undefined) {
    if (hasAncestrySlot(context, "A", "巨人")) expected.hp += 1;
    if (hasSubclass(context, "战争学派", "基础")) expected.hp += 1;
  }
  if (hasAncestrySlot(context, "A", "人类")) expected.stress += 1;
  if (hasSubclass(context, "复仇战卫", "基础")) expected.stress += 1;

  const thresholdBase = baseThresholds(context);
  if (thresholdBase && validLevel(context.level)) {
    expected.major = thresholdBase.major + context.level;
    expected.severe = thresholdBase.severe + context.level;
    const both = thresholdBothModifier(context, proficiency);
    expected.major += both;
    expected.severe += both;
    expected.severe += thresholdSevereModifier(context, proficiency);
  }

  if (hasFlourishingLife) {
    checkFlourishingLife(issues, context, expected);
    return;
  }

  compareDerivedPoolsAndThresholds(issues, context, expected);
}

function compareDerivedPoolsAndThresholds(issues, context, expected) {
  compareCountableMax(issues, context.values.hp, expected.hp, { code: "HP_MAX_MISMATCH", path: "character.values.hp", label: "生命上限" });
  compareCountableMax(issues, context.values.stress, expected.stress, { code: "STRESS_MAX_MISMATCH", path: "character.values.stress", label: "压力上限" });
  compareTextInteger(issues, context.values["major-threshold"], expected.major, { code: "MAJOR_THRESHOLD_MISMATCH", path: "character.values.major-threshold", label: "重度阈值" });
  compareTextInteger(issues, context.values["severe-threshold"], expected.severe, { code: "SEVERE_THRESHOLD_MISMATCH", path: "character.values.severe-threshold", label: "严重阈值" });
}

function checkFlourishingLife(issues, context, expected) {
  const candidates = [
    { hp: 1, stress: 1, major: 0, severe: 0 },
    { hp: 1, stress: 0, major: 2, severe: 2 },
    { hp: 0, stress: 1, major: 2, severe: 2 },
  ];
  const actual = {
    hp: countableMax(context.values.hp),
    stress: countableMax(context.values.stress),
    major: integer(context.values["major-threshold"]),
    severe: integer(context.values["severe-threshold"]),
  };
  const matches = candidates.some((bonus) => Object.keys(expected).every((key) => expected[key] === undefined || actual[key] === expected[key] + bonus[key]));
  if (!matches) {
    warn(issues, "FLOURISHING_LIFE_SELECTION_MISMATCH", "character.values", "生命、压力与伤害阈值无法同时匹配“蓬勃生命”三选二的任一合法组合。" );
  }
}

function baseThresholds(context) {
  if (context.armorEntry) {
    const major = integer(field(context.armorEntry, "重度阈值"));
    const severe = integer(field(context.armorEntry, "严重阈值"));
    return major === undefined || severe === undefined ? undefined : { major, severe };
  }
  if (!hasActiveDomain(context, "铁骨铮铮") || context.tier === undefined) return undefined;
  return [{ major: 9, severe: 19 }, { major: 11, severe: 24 }, { major: 13, severe: 31 }, { major: 15, severe: 38 }][context.tier - 1];
}

function thresholdBothModifier(context, proficiency) {
  let bonus = 0;
  if (hasAncestrySlot(context, "A", "龟人") && proficiency !== undefined) bonus += proficiency;
  if (context.armorEntry && hasActiveDomain(context, "强化护甲")) bonus += 2;
  for (const stage of ["基础", "进阶", "精通"]) {
    if (hasSubclass(context, "坚毅铁卫", stage)) bonus += { 基础: 1, 进阶: 2, 精通: 3 }[stage];
  }
  return bonus;
}

function thresholdSevereModifier(context, proficiency) {
  let bonus = 0;
  if (activeDomainCount(context, "利刃") >= 4 && hasActiveDomain(context, "利刃恩泽")) bonus += 4;
  if (activeDomainCount(context, "辉耀") >= 4 && hasActiveDomain(context, "辉耀恩泽")) bonus += 3;
  if (hasActiveDomain(context, "奋起直追") && proficiency !== undefined) bonus += proficiency;
  if (context.weapons.some((weapon) => field(weapon, "名称") === "勇气之剑")) bonus += 3;
  if (hasSubclass(context, "翔翼哨兵", "精通")) bonus += 4;
  return bonus;
}

function staticTraitModifiers(context) {
  const result = [0, 0, 0, 0, 0, 0];
  const addTrait = (trait, value) => { result[TRAITS.indexOf(trait)] += value; };
  const armorName = field(context.armorEntry, "名称");
  if (["全板甲", "改良全板甲", "高级全板甲", "传奇全板甲"].includes(armorName)) addTrait("agility", -1);
  if (armorName === "贝拉莫伊精致护甲") addTrait("presence", 1);
  if (armorName === "救世主链甲") TRAITS.forEach((trait) => addTrait(trait, -1));
  for (const weapon of context.weapons) {
    const name = field(weapon, "名称");
    if (["戟", "改良戟", "高级戟", "传奇戟", "长弓", "改良长弓", "高级长弓", "传奇长弓"].includes(name)) addTrait("finesse", -1);
    if (name === "巨斧") addTrait("agility", -1);
  }
  const relicTraits = {
    神行遗宝: "agility", 强力遗宝: "strength", 控制遗宝: "finesse",
    调和遗宝: "instinct", 魅力遗宝: "presence", 启迪遗宝: "knowledge",
  };
  for (const entry of context.inventoryEntries) {
    const trait = relicTraits[field(entry, "名称")];
    if (trait) addTrait(trait, 1);
  }
  if (activeDomainCount(context, "骸骨") >= 4 && hasActiveDomain(context, "骸骨恩泽")) addTrait("agility", 1);
  return result;
}

function armorEvasionModifier(name) {
  if (["填充布甲", "改良填充布甲", "高级填充布甲", "传奇填充布甲"].includes(name)) return 1;
  if (["链甲", "改良链甲", "高级链甲", "传奇链甲", "救世主链甲"].includes(name)) return -1;
  if (["全板甲", "改良全板甲", "高级全板甲", "传奇全板甲"].includes(name)) return -2;
  return 0;
}

function weaponEvasionModifier(name) {
  if (["巨剑", "改良巨剑", "高级巨剑", "传奇巨剑", "战锤", "改良战锤", "高级战锤", "传奇战锤", "塔盾", "改良塔盾", "高级塔盾", "传奇塔盾", "勇气之剑"].includes(name)) return -1;
  return 0;
}

function weaponArmorModifier(name) {
  const modifiers = {
    拉布里斯斧: 1, 圆盾: 1, 改良圆盾: 2, 高级圆盾: 3, 传奇圆盾: 4,
    塔盾: 2, 改良塔盾: 3, 高级塔盾: 4, 传奇塔盾: 5, 尖刺盾牌: 1,
  };
  return modifiers[name] ?? 0;
}

function hasLegalTraitAllocation(actual, upgrades) {
  const bases = uniquePermutations(INITIAL_TRAITS);
  const tierMasks = upgrades.map((count) => masksWithBits(TRAITS.length, count * 2));
  for (const base of bases) {
    for (const first of tierMasks[0]) {
      for (const second of tierMasks[1]) {
        for (const third of tierMasks[2]) {
          if (actual.every((value, index) => value === base[index] + bit(first, index) + bit(second, index) + bit(third, index))) return true;
        }
      }
    }
  }
  return false;
}

function hasLegalExperienceAllocation(actual, upgradeCount, constructBonus, masterOfCraft) {
  if (actual.some((value) => value < 0)) return false;
  let allocations = [Array(actual.length).fill(0)];
  for (let index = 0; index < upgradeCount; index += 1) allocations = addPairAllocations(allocations);
  if (constructBonus) allocations = addSingleAllocations(allocations, 1);
  if (masterOfCraft) {
    const next = addSingleAllocations(allocations, 3);
    allocations = next.concat(addPairAllocations(allocations, 2));
  }
  return allocations.some((candidate) => candidate.every((value, index) => value === actual[index]));
}

function addPairAllocations(allocations, amount = 1) {
  const result = [];
  for (const allocation of allocations) {
    for (let left = 0; left < allocation.length; left += 1) {
      for (let right = left + 1; right < allocation.length; right += 1) {
        const next = allocation.slice();
        next[left] += amount;
        next[right] += amount;
        result.push(next);
      }
    }
  }
  return result;
}

function addSingleAllocations(allocations, amount) {
  const result = [];
  for (const allocation of allocations) {
    for (let index = 0; index < allocation.length; index += 1) {
      const next = allocation.slice();
      next[index] += amount;
      result.push(next);
    }
  }
  return result;
}

function uniquePermutations(values) {
  const result = [];
  const visit = (prefix, remaining) => {
    if (remaining.length === 0) { result.push(prefix); return; }
    const seen = new Set();
    remaining.forEach((value, index) => {
      if (seen.has(value)) return;
      seen.add(value);
      visit(prefix.concat(value), remaining.slice(0, index).concat(remaining.slice(index + 1)));
    });
  };
  visit([], values);
  return result;
}

function masksWithBits(size, count) {
  if (count < 0 || count > size) return [];
  const result = [];
  for (let mask = 0; mask < (1 << size); mask += 1) {
    if (popcount(mask) === count) result.push(mask);
  }
  return result;
}

function resolveCard(instance, libraries, compositeResources) {
  const ref = instance.definitionRef ?? (instance.libraryId && instance.definitionId ? { type: "resourceLibrary", libraryId: instance.libraryId, entryId: instance.definitionId } : undefined);
  if (!ref) return undefined;
  if (ref.type === "compositeResource") {
    const composite = compositeResources[ref.compositeResourceId]
      ?? Object.values(compositeResources).find((candidate) => candidate.ID === ref.compositeResourceId);
    return composite ? { instance, libraryId: "composite", entry: { ID: composite.ID, fields: composite.fields } } : undefined;
  }
  const library = libraries.get(ref.libraryId);
  const entry = library?.entries.find((candidate) => candidate.ID === ref.entryId);
  return entry ? { instance, libraryId: ref.libraryId, entry } : undefined;
}

function findEntryByName(library, name) {
  if (!name) return undefined;
  return library?.entries.find((entry) => field(entry, "名称") === name);
}

function classDomains(entry) {
  return field(entry, "领域").split("+").map((domain) => domain.trim()).filter(Boolean);
}

function hasAncestrySlot(context, slot, name) {
  const key = `种族${slot}名称`;
  return context.cards.some((card) => card.libraryId === "composite" && field(card.entry, key) === name);
}

function hasSubclass(context, name, stage) {
  return context.cards.some((card) => card.libraryId === "subclasses" && field(card.entry, "名称") === name && field(card.entry, "等级") === stage);
}

function hasActiveDomain(context, name) {
  return context.cards.some((card) => card.libraryId === "domain-cards" && card.instance.state === "配置" && field(card.entry, "名称") === name);
}

function hasOwnedDomain(context, name) {
  return context.cards.some((card) => card.libraryId === "domain-cards" && field(card.entry, "名称") === name);
}

function activeDomainCount(context, domain) {
  return context.cards.filter((card) => card.libraryId === "domain-cards" && card.instance.state === "配置" && field(card.entry, "领域") === domain).length;
}

function selectedName(value) {
  const source = text(value);
  return source.match(/^\*\*([^*]+)\*\*/)?.[1]?.trim() ?? source.split("｜", 1)[0].replace(/^\*\*|\*\*$/g, "").trim();
}

function inventoryNames(value) {
  const names = [];
  const pattern = /\*\*([^*\n]+)\*\*/g;
  const source = text(value);
  let match;
  while ((match = pattern.exec(source))) names.push(match[1].trim());
  return names;
}

function compareCountableMax(issues, value, expected, config) {
  if (expected === undefined || !isCountable(value) || value.max === expected) return;
  warn(issues, config.code, config.path, `${config.label}应为 ${expected}，当前为 ${value.max ?? "无上限"}。`);
}

function compareCountableCurrent(issues, value, expected, config) {
  if (expected === undefined || !isCountable(value) || value.current === expected) return;
  warn(issues, config.code, config.path, `${config.label}应为 ${expected}，当前为 ${value.current}。`);
}

function compareTextInteger(issues, value, expected, config) {
  if (expected === undefined) return;
  const actual = integer(value);
  if (actual === expected) return;
  warn(issues, config.code, config.path, `${config.label}应为 ${expected}，当前为 ${actual ?? "未填写或不是整数"}。`);
}

function warn(issues, code, path, textValue) { issues.push({ level: "warning", code, path, text: textValue }); }
function field(entry, key) { return entry?.fields?.[key] ?? ""; }
function checkboxState(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function selected(state, id) { return state[id] === true; }
function pairSelected(state, prefix) { return selected(state, `${prefix}-1`) && selected(state, `${prefix}-2`); }
function checkedCount(state) { return Object.values(state).filter((value) => value === true).length; }
function countSelectedPrefix(state, prefix) { return Object.entries(state).filter(([id, value]) => id.startsWith(prefix) && value === true).length; }
function countSelected(states, prefix) { return states.reduce((total, state) => total + countSelectedPrefix(state, prefix), 0); }
function countableCurrent(value) { return isCountable(value) ? value.current : undefined; }
function countableMax(value) { return isCountable(value) ? value.max : undefined; }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function integer(value) {
  const source = typeof value === "number" ? String(value) : text(value);
  return /^-?\d+$/.test(source) ? Number(source) : undefined;
}
function domainLevel(value) { return integer(text(value).replace(/级$/, "")); }
function isCountable(value) { return value && typeof value === "object" && Number.isInteger(value.current) && (value.max === null || Number.isInteger(value.max)); }
function validLevel(level) { return Number.isInteger(level) && level >= 1 && level <= 10; }
function add(left, right) { return left === undefined || right === undefined ? undefined : left + right; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function popcount(value) { let count = 0; for (let current = value; current; current >>= 1) count += current & 1; return count; }
function bit(mask, index) { return (mask >> index) & 1; }
