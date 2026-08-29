const TRAITS = ["agility", "strength", "finesse", "instinct", "presence", "knowledge"];
const INITIAL_TRAITS = [2, 1, 1, 0, 0, -1];
const TIER_IDS = ["advancement-tier-2", "advancement-tier-3", "advancement-tier-4"];
const TIER_CAPS = [4, 7, 10];
const ELITE_STAGES = ["精英X", "精英Y"];
const ALL_STAGES = ["预备", "正式", "资深", ...ELITE_STAGES];
const COLOR_NAMES = ["red", "orange", "yellow", "green", "blue", "purple", "gray"];

module.exports = ({ characterData, resourceLibraries }) => {
  const context = createContext(characterData, resourceLibraries);
  const issues = [];

  checkLevel(issues, context);
  checkRequiredSelections(issues, context);
  checkSubclassProgression(issues, context);
  checkTraits(issues, context);
  checkExperiences(issues, context);
  checkCards(issues, context);
  checkDerivedValues(issues, context);

  return issues;
};

function createContext(characterData, resourceLibraries) {
  const values = characterData?.character?.values ?? {};
  const libraries = new Map((resourceLibraries ?? []).map((library) => [library.ID, library]));
  const level = integer(values.level);
  const tier = validLevel(level) ? (level >= 8 ? 4 : level >= 5 ? 3 : level >= 2 ? 2 : 1) : undefined;
  const classEntry = findEntryByName(libraries.get("classes"), text(values["class-name"]));
  const subclassEntry = findSubclassEntry(
    libraries.get("subclasses"),
    text(values["subclass-name"]),
    text(values["subclass-stage"]),
  );
  const ancestryEntry = findEntryByName(libraries.get("ancestries"), text(values["ancestry-name"]));
  const communityEntry = findEntryByName(libraries.get("communities"), text(values["community-name"]));
  const armorEntry = findArmorEntry(libraries.get("armor"), text(values["armor-summary"]));
  const cards = (characterData?.cards?.instances ?? [])
    .map((instance) => resolveCard(instance, libraries, characterData?.compositeResources ?? {}))
    .filter(Boolean);
  const advancementStates = TIER_IDS.map((id) => checkboxState(values[id]));

  return {
    values,
    libraries,
    cards,
    level,
    tier,
    classEntry,
    subclassEntry,
    ancestryEntry,
    communityEntry,
    armorEntry,
    advancementStates,
    multiclassCount: advancementStates.filter((state) => multiclassSelected(state)).length,
  };
}

function checkLevel(issues, context) {
  if (validLevel(context.level)) return;
  warn(issues, "LEVEL_INVALID", "character.values.level", "等级应为 1 到 10 的整数。");
}

function checkRequiredSelections(issues, context) {
  checkNamedSelection(issues, context.values["class-name"], context.classEntry, {
    missingCode: "CLASS_MISSING",
    unknownCode: "CLASS_UNKNOWN",
    path: "character.values.class-name",
    missingText: "尚未选择职业。",
    unknownText: "当前职业不在职业资源库中。",
  });
  checkNamedSelection(issues, context.values["ancestry-name"], context.ancestryEntry, {
    missingCode: "ANCESTRY_MISSING",
    unknownCode: "ANCESTRY_UNKNOWN",
    path: "character.values.ancestry-name",
    missingText: "尚未选择种族。",
    unknownText: "当前种族不在种族资源库中。",
  });
  checkNamedSelection(issues, context.values["community-name"], context.communityEntry, {
    missingCode: "COMMUNITY_MISSING",
    unknownCode: "COMMUNITY_UNKNOWN",
    path: "character.values.community-name",
    missingText: "尚未选择社群。",
    unknownText: "当前社群不在社群资源库中。",
  });

  const subclassName = text(context.values["subclass-name"]);
  const subclassStage = text(context.values["subclass-stage"]);
  if (!subclassName) {
    warn(issues, "SUBCLASS_MISSING", "character.values.subclass-name", "尚未选择干员。");
  }
  if (subclassName && !ALL_STAGES.includes(subclassStage)) {
    warn(issues, "SUBCLASS_STAGE_INVALID", "character.values.subclass-stage", "干员等级必须是预备、正式、资深、精英X或精英Y。");
  } else if (subclassName && !context.subclassEntry) {
    warn(issues, "SUBCLASS_UNKNOWN", "character.values.subclass-name", "当前干员类型及等级组合不在干员资源库中。");
  }
}

function checkNamedSelection(issues, rawName, entry, config) {
  if (!text(rawName)) {
    warn(issues, config.missingCode, config.path, config.missingText);
  } else if (!entry) {
    warn(issues, config.unknownCode, config.path, config.unknownText);
  }
}

function checkSubclassProgression(issues, context) {
  const [t2, t3, t4] = context.advancementStates;
  const stage = text(context.values["subclass-stage"]);
  const isElite = ELITE_STAGES.includes(stage);

  if (selected(t2, "subclass") && !["正式", "资深", ...ELITE_STAGES].includes(stage)) {
    warn(issues, "T2_SUBCLASS_UPGRADE_MISSING", "character.values.subclass-stage", "已在 T2 勾选提升武器原型，但当前干员仍是预备等级。");
  }
  if (selected(t3, "subclass") && !["资深", ...ELITE_STAGES].includes(stage)) {
    warn(issues, "T3_SUBCLASS_UPGRADE_MISSING", "character.values.subclass-stage", "已在 T3 勾选提升武器原型，但当前干员尚未达到资深等级。");
  }
  if (selected(t4, "subclass-elite") && !isElite) {
    warn(issues, "T4_ELITE_SUBCLASS_MISSING", "character.values.subclass-stage", "已在 T4 勾选提升武器原型，应选择精英X或精英Y的干员。");
  } else if (!selected(t4, "subclass-elite") && isElite) {
    warn(issues, "ELITE_SUBCLASS_BEFORE_T4", "character.values.subclass-stage", "尚未在 T4 选择提升武器原型，不应提前选择精英X或精英Y。");
  }
}

function checkTraits(issues, context) {
  const actual = TRAITS.map((id) => integer(context.values[id]));
  if (actual.some((value) => value === undefined)) {
    warn(issues, "TRAIT_VALUE_INVALID", "character.values", "六项角色属性都应填写整数；颜色、粗体和斜体装饰不影响数值检查。");
    return;
  }

  const upgradeCounts = context.advancementStates.map((state) => countSelectedPrefix(state, "traits-"));
  const armorTraits = armorModifiers(context.armorEntry).traits;
  const traitsBeforeArmor = actual.map((value, index) => value - armorTraits[index]);
  if (upgradeCounts.some((count) => count > 3) || !hasLegalTraitAllocation(traitsBeforeArmor, upgradeCounts)) {
    warn(
      issues,
      "TRAIT_DISTRIBUTION_MISMATCH",
      "character.values",
      "角色属性无法由初始 2、1、1、0、0、-1、已标记的属性升级与当前护甲的固定修正合法产生；同一位阶内同一属性最多提升一次。",
    );
  }
}

function checkExperiences(issues, context) {
  if (context.tier === undefined) return;
  const experiences = [];
  const ancestryName = text(context.values["ancestry-experience"])
    || field(context.ancestryEntry, "默认种族经历");
  const ancestryModifierSource = text(context.values["ancestry-experience-modifier"])
    || field(context.ancestryEntry, "默认种族经历修正");
  const ancestryModifier = integer(ancestryModifierSource);
  if (ancestryName) {
    experiences.push({ id: "ancestry-experience", modifier: ancestryModifier });
  } else if (ancestryModifierSource) {
    warn(issues, "ORPHAN_EXPERIENCE_MODIFIER", "character.values.ancestry-experience-modifier", "种族经历未填写名称，但填写了修正值。");
  }

  for (let index = 1; index <= 5; index += 1) {
    const name = text(context.values[`experience-${index}`]);
    const modifierSource = text(context.values[`experience-modifier-${index}`]);
    const modifier = integer(modifierSource);
    if (name) {
      experiences.push({ id: `experience-${index}`, modifier });
    } else if (modifierSource) {
      warn(issues, "ORPHAN_EXPERIENCE_MODIFIER", `character.values.experience-modifier-${index}`, `经历 ${index} 未填写名称，但填写了修正值。`);
    }
  }

  const expectedCount = context.tier + 2;
  if (experiences.length !== expectedCount) {
    warn(issues, "EXPERIENCE_COUNT_MISMATCH", "character.values", `当前位阶应有 ${expectedCount} 项经历（包含种族经历），当前填写 ${experiences.length} 项。`);
  }
  if (experiences.some((experience) => experience.modifier === undefined)) {
    warn(issues, "EXPERIENCE_MODIFIER_INVALID", "character.values", "所有已填写经历都应填写整数修正值。");
    return;
  }

  const upgradeCount = context.advancementStates.filter((state) => selected(state, "experiences")).length;
  const excess = experiences.map((experience) => experience.modifier - 2);
  if (!hasLegalExperienceAllocation(excess, upgradeCount)) {
    warn(issues, "EXPERIENCE_MODIFIER_MISMATCH", "character.values", "经历修正值无法由基础 +2 与已标记的经历升级合法产生；每次升级应使两项不同经历各 +1。");
  }
}

function checkCards(issues, context) {
  const ancestryCount = context.cards.filter((card) => card.libraryId === "ancestries").length;
  const communityCount = context.cards.filter((card) => card.libraryId === "communities").length;
  if (ancestryCount !== 1) {
    warn(issues, "ANCESTRY_CARD_COUNT_MISMATCH", "cards.instances", `种族卡应有且只有 1 张，当前为 ${ancestryCount} 张。`);
  }
  if (communityCount !== 1) {
    warn(issues, "COMMUNITY_CARD_COUNT_MISMATCH", "cards.instances", `社群卡应有且只有 1 张，当前为 ${communityCount} 张。`);
  }
  checkDomainCards(issues, context);
}

function checkDomainCards(issues, context) {
  if (!validLevel(context.level)) return;
  const domainCards = context.cards.filter((card) => card.libraryId === "domain-cards");
  const extraUpgradeCaps = [];
  context.advancementStates.forEach((state, index) => {
    if (selected(state, "domain-card")) extraUpgradeCaps.push(Math.min(context.level, TIER_CAPS[index]));
  });
  const normalCaps = [1, 1];
  for (let level = 2; level <= context.level; level += 1) normalCaps.push(level);
  normalCaps.push(...extraUpgradeCaps);
  const multiclassCaps = Array(context.multiclassCount).fill(Math.floor(context.level / 2));
  const expectedCount = normalCaps.length + multiclassCaps.length;
  if (domainCards.length !== expectedCount) {
    warn(issues, "DOMAIN_CARD_COUNT_MISMATCH", "cards.instances", `领域卡总数应为 ${expectedCount} 张，当前为 ${domainCards.length} 张。`);
  }

  const cardsWithLevels = domainCards.map((card) => ({ ...card, level: domainLevel(field(card.entry, "等级")) }));
  if (cardsWithLevels.some((card) => card.level === undefined)) {
    warn(issues, "DOMAIN_CARD_LEVEL_INVALID", "cards.instances", "存在无法识别等级的领域卡。");
  } else {
    const capSources = [...normalCaps, ...multiclassCaps].map((cap) => ({ cap, anyDomain: true }));
    if (!hasLegalDomainCardAllocation(cardsWithLevels, capSources, [])) {
      warn(issues, "DOMAIN_CARD_LEVEL_MISMATCH", "cards.instances", "领域卡等级分布超过了初始、逐级升级、额外领域卡或兼职（角色等级一半）允许的上限。");
    }

    const allowedDomains = [text(context.values["primary-domain"]), text(context.values["secondary-domain"])].filter(Boolean);
    if (allowedDomains.length === 2) {
      const domainSources = [
        ...normalCaps.map((cap) => ({ cap, anyDomain: false })),
        ...multiclassCaps.map((cap) => ({ cap, anyDomain: true })),
      ];
      if (!hasLegalDomainCardAllocation(cardsWithLevels, domainSources, allowedDomains)) {
        const invalidDomains = [...new Set(domainCards
          .map((card) => field(card.entry, "领域"))
          .filter((domain) => domain && !allowedDomains.includes(domain)))];
        const detail = invalidDomains.length > 0 ? `：${invalidDomains.join("、")}` : "";
        warn(issues, "DOMAIN_CARD_AFFILIATION_MISMATCH", "cards.instances", `领域卡无法分配至主领域、次领域及已选择的兼职领域卡名额${detail}。`);
      }
    }
  }
}

function hasLegalDomainCardAllocation(cards, sources, allowedDomains) {
  if (cards.length !== sources.length) return false;
  const sourceMatches = Array(sources.length).fill(-1);
  const orderedCards = cards
    .map((card, index) => ({ card, index }))
    .sort((left, right) => candidateSourceCount(left.card) - candidateSourceCount(right.card));

  return orderedCards.every(({ card, index }) => assignCard(card, index, new Set()));

  function candidateSourceCount(card) {
    return sources.filter((source) => sourceAcceptsCard(source, card)).length;
  }

  function assignCard(card, cardIndex, visited) {
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      if (visited.has(sourceIndex) || !sourceAcceptsCard(sources[sourceIndex], card)) continue;
      visited.add(sourceIndex);
      const previousCardIndex = sourceMatches[sourceIndex];
      if (previousCardIndex < 0 || assignCard(cards[previousCardIndex], previousCardIndex, visited)) {
        sourceMatches[sourceIndex] = cardIndex;
        return true;
      }
    }
    return false;
  }

  function sourceAcceptsCard(source, card) {
    return card.level <= source.cap
      && (source.anyDomain || allowedDomains.includes(field(card.entry, "领域")));
  }
}

function checkDerivedValues(issues, context) {
  const modifiers = subclassModifiers(context.subclassEntry);
  const armorMods = armorModifiers(context.armorEntry);
  const hpBase = integer(field(context.classEntry, "生命点"));
  const evasionBase = integer(field(context.classEntry, "闪避值"));
  const armorBase = integer(field(context.armorEntry, "护甲值"));
  const heavyBase = integer(field(context.armorEntry, "重度阈值"));
  const severeBase = integer(field(context.armorEntry, "严重阈值"));

  const expectedHp = hpBase === undefined
    ? undefined
    : hpBase + countSelected(context.advancementStates, "hp-") + modifiers.hp;
  const expectedStress = 6 + countSelected(context.advancementStates, "stress-");
  const expectedEvasion = evasionBase === undefined
    ? undefined
    : evasionBase + context.advancementStates.filter((state) => selected(state, "evasion")).length + modifiers.evasion + armorMods.evasion;
  const expectedArmor = armorBase === undefined ? undefined : armorBase + modifiers.armor;

  compareCountableMax(issues, context.values.hp, expectedHp, {
    code: "HP_MAX_MISMATCH", path: "character.values.hp", label: "生命上限",
  });
  compareCountableMax(issues, context.values.stress, expectedStress, {
    code: "STRESS_MAX_MISMATCH", path: "character.values.stress", label: "压力上限",
  });
  compareTextInteger(issues, context.values.evasion, expectedEvasion, {
    code: "EVASION_MISMATCH", path: "character.values.evasion", label: "闪避值",
  });
  if (!text(context.values["armor-value"])) {
    warn(issues, "ARMOR_VALUE_MISSING", "character.values.armor-value", "尚未填写护甲值。");
  } else {
    compareTextInteger(issues, context.values["armor-value"], expectedArmor, {
      code: "ARMOR_VALUE_MISMATCH", path: "character.values.armor-value", label: "护甲值",
    });
  }
  compareCountableMax(issues, context.values["armor-slots"], expectedArmor, {
    code: "ARMOR_MAX_MISMATCH", path: "character.values.armor-slots", label: "护甲槽上限",
  });

  if (heavyBase === undefined || severeBase === undefined || !validLevel(context.level)) return;
  const expectedHeavy = heavyBase + context.level + modifiers.heavyThreshold;
  const expectedSevere = severeBase + context.level;
  const actualHeavy = integer(context.values["major-threshold"]);
  const actualSevere = integer(context.values["severe-threshold"]);
  if (actualHeavy !== expectedHeavy || actualSevere !== expectedSevere) {
    const actualText = actualHeavy === undefined || actualSevere === undefined
      ? "未填写或格式无法识别"
      : `${actualHeavy} / ${actualSevere}`;
    warn(
      issues,
      "CURRENT_THRESHOLDS_MISMATCH",
      "character.values.major-threshold",
      `当前阈值应为 ${expectedHeavy} / ${expectedSevere}（护甲基础阈值 + 等级及永久干员修正），当前为 ${actualText}。`,
    );
  }
}

function armorModifiers(entry) {
  const description = field(entry, "描述");
  const traits = Array(TRAITS.length).fill(0);
  const sharedTraitMatch = description.match(/所有角色属性(?:以及|与|和)?闪避值\s*([+-]\d+)/);
  if (sharedTraitMatch) traits.fill(Number(sharedTraitMatch[1]));

  const traitLabels = ["敏捷", "力量", "灵巧", "本能", "风度", "知识"];
  traitLabels.forEach((label, index) => {
    const match = description.match(new RegExp(`${label}\\s*([+-]\\d+)`));
    if (match) traits[index] += Number(match[1]);
  });

  const evasionMatch = description.match(/闪避值\s*([+-]\d+)/);
  return { evasion: evasionMatch ? Number(evasionMatch[1]) : 0, traits };
}

function subclassModifiers(entry) {
  const name = field(entry, "名称");
  const stage = field(entry, "等级");
  const result = { hp: 0, evasion: 0, armor: 0, heavyThreshold: 0 };
  if (name === "无畏者") result.hp = stage === "精英Y" ? 2 : 1;
  if (name === "斗士") result.evasion = ["资深", ...ELITE_STAGES].includes(stage) ? 2 : 1;
  if (name === "铁卫") {
    if (["预备", "正式"].includes(stage)) {
      result.armor = 1;
      result.heavyThreshold = 1;
    } else if (["资深", "精英X"].includes(stage)) {
      result.armor = 2;
      result.heavyThreshold = 2;
    } else if (stage === "精英Y") {
      result.armor = 3;
      result.heavyThreshold = 2;
    }
  }
  return result;
}

function hasLegalTraitAllocation(actual, upgradeCounts) {
  const bases = uniquePermutations(INITIAL_TRAITS);
  const tierMasks = upgradeCounts.map((count) => masksWithBits(TRAITS.length, count * 2));
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

function hasLegalExperienceAllocation(actual, upgradeCount) {
  if (actual.some((value) => value < 0)) return false;
  let allocations = [Array(actual.length).fill(0)];
  for (let index = 0; index < upgradeCount; index += 1) allocations = addPairAllocations(allocations);
  return allocations.some((candidate) => candidate.every((value, index) => value === actual[index]));
}

function addPairAllocations(allocations) {
  const result = [];
  for (const allocation of allocations) {
    for (let left = 0; left < allocation.length; left += 1) {
      for (let right = left + 1; right < allocation.length; right += 1) {
        const next = allocation.slice();
        next[left] += 1;
        next[right] += 1;
        result.push(next);
      }
    }
  }
  return result;
}

function uniquePermutations(values) {
  const result = [];
  const visit = (prefix, remaining) => {
    if (remaining.length === 0) {
      result.push(prefix);
      return;
    }
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
  const ref = instance.definitionRef
    ?? (instance.libraryId && instance.definitionId
      ? { type: "resourceLibrary", libraryId: instance.libraryId, entryId: instance.definitionId }
      : undefined);
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

function findSubclassEntry(library, name, stage) {
  if (!name || !stage) return undefined;
  return library?.entries.find((entry) => field(entry, "名称") === name && field(entry, "等级") === stage);
}

function findArmorEntry(library, summary) {
  if (!library || !summary) return undefined;
  const marker = " | 阈值 ";
  const markerIndex = summary.indexOf(marker);
  if (markerIndex < 1) return undefined;
  return findEntryByName(library, summary.slice(0, markerIndex).trim());
}


function compareCountableMax(issues, value, expected, config) {
  if (expected === undefined) return;
  const actual = countableMax(value);
  if (actual === expected) return;
  warn(issues, config.code, config.path, `${config.label}应为 ${expected}，当前为 ${actual ?? "未填写或无上限"}。`);
}

function compareTextInteger(issues, value, expected, config) {
  if (expected === undefined) return;
  const actual = integer(value);
  if (actual === expected) return;
  warn(issues, config.code, config.path, `${config.label}应为 ${expected}，当前为 ${actual ?? "未填写或不是整数"}。`);
}

function stripPresentation(value) {
  let source = text(value);
  let previous;
  do {
    previous = source;
    const color = source.match(new RegExp(`^:(${COLOR_NAMES.join("|")})\\[([\\s\\S]*)\\]$`));
    if (color) source = color[2].trim();
    const emphasis = source.match(/^\*\*\*([\s\S]*)\*\*\*$/)
      ?? source.match(/^\*\*([\s\S]*)\*\*$/)
      ?? source.match(/^\*([\s\S]*)\*$/);
    if (emphasis) source = emphasis[1].trim();
  } while (source !== previous);
  return source;
}

function integer(value) {
  const source = stripPresentation(value);
  return /^[+-]?\d+$/.test(source) ? Number(source) : undefined;
}

function domainLevel(value) {
  return integer(text(value).replace(/级$/, ""));
}

function field(entry, key) {
  return entry?.fields?.[key] ?? "";
}

function checkboxState(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function selected(state, id) {
  return state[id] === true;
}

function multiclassSelected(state) {
  return selected(state, "multiclass-1") || selected(state, "multiclass-2");
}

function countSelectedPrefix(state, prefix) {
  return Object.entries(state).filter(([id, value]) => id.startsWith(prefix) && value === true).length;
}

function countSelected(states, prefix) {
  return states.reduce((total, state) => total + countSelectedPrefix(state, prefix), 0);
}

function countableMax(value) {
  return value && typeof value === "object" && Number.isInteger(value.current) && (value.max === null || Number.isInteger(value.max))
    ? value.max
    : undefined;
}

function validLevel(level) {
  return Number.isInteger(level) && level >= 1 && level <= 10;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function popcount(value) {
  let count = 0;
  for (let current = value; current; current >>= 1) count += current & 1;
  return count;
}

function bit(mask, index) {
  return (mask >> index) & 1;
}

function warn(issues, code, path, textValue) {
  issues.push({ level: "warning", code, path, text: textValue });
}
