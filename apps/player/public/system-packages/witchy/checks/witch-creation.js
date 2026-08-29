module.exports = async (input) => {
  const values = input && input.characterData && input.characterData.character
    ? input.characterData.character.values || {}
    : {};
  const issues = [];

  const magicPoints = values["magic-points"];
  const magicPointMax = magicPoints && typeof magicPoints === "object"
    ? Number(magicPoints.max)
    : Number.NaN;
  if (Number.isFinite(magicPointMax)) {
    if (magicPointMax === 0) {
      issues.push({
        level: "warning",
        code: "WITCH_TOTAL_LUNAR_ECLIPSE",
        path: "character.values.magic-points.max",
        text: "月全食：魔力点上限已降至 0。",
      });
    } else if (magicPointMax <= 3) {
      issues.push({
        level: "warning",
        code: "WITCH_CRESCENT_MOON",
        path: "character.values.magic-points.max",
        text: "残月：魔力点上限为 3 或更低，混乱骰改为 d20。",
      });
    }
  }

  const essenceIds = ["essence-assiah", "essence-yetzirah", "essence-atziluth"];
  const essences = essenceIds.map((id) => {
    const raw = typeof values[id] === "string" ? values[id].trim() : "";
    return { id, raw, value: Number(raw) };
  });

  for (const essence of essences) {
    if (!/^[+-]?\d+$/.test(essence.raw)) {
      issues.push({ level: "error", code: "WITCH_ESSENCE_NOT_INTEGER", path: `character.values.${essence.id}`, text: "魔法本质必须填写完整整数。" });
    } else if (essence.value < -2 || essence.value > 2) {
      issues.push({ level: "error", code: "WITCH_ESSENCE_OUT_OF_RANGE", path: `character.values.${essence.id}`, text: "创建时魔法本质必须位于 -2 到 +2。" });
    }
  }

  if (essences.every((essence) => /^[+-]?\d+$/.test(essence.raw))) {
    const total = essences.reduce((sum, essence) => sum + essence.value, 0);
    if (total !== 0) {
      issues.push({ level: "error", code: "WITCH_ESSENCE_SUM", text: `三项魔法本质总和应为 0，当前为 ${total}。` });
    }
  }

  for (let index = 1; index <= 3; index += 1) {
    const name = typeof values[`magic-${index}-name`] === "string" ? values[`magic-${index}-name`].trim() : "";
    const noun = typeof values[`magic-${index}-noun`] === "string" ? values[`magic-${index}-noun`].trim() : "";
    const verb = typeof values[`magic-${index}-verb`] === "string" ? values[`magic-${index}-verb`].trim() : "";
    const description = typeof values[`magic-${index}-description`] === "string" ? values[`magic-${index}-description`].trim() : "";
    if (!name && !noun && !verb && !description) {
      issues.push({ level: "error", code: "WITCH_MAGIC_MISSING", path: `character.values.magic-${index}-name`, text: `请填写初始魔法 ${index}。` });
    }
  }

  for (let index = 1; index <= 2; index += 1) {
    const experience = typeof values[`experience-${index}`] === "string" ? values[`experience-${index}`].trim() : "";
    const modifier = typeof values[`experience-modifier-${index}`] === "string" ? values[`experience-modifier-${index}`].trim() : "";
    if (!experience) {
      issues.push({ level: "error", code: "WITCH_EXPERIENCE_MISSING", path: `character.values.experience-${index}`, text: `请填写初始经历 ${index}。` });
    }
    if (modifier !== "+3" && modifier !== "3") {
      issues.push({ level: "warning", code: "WITCH_EXPERIENCE_MODIFIER", path: `character.values.experience-modifier-${index}`, text: `初始经历 ${index} 的修正通常为 +3。` });
    }
  }

  return issues;
};
