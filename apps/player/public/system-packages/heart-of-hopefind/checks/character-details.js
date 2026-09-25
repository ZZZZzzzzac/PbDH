module.exports = async (input) => {
  const values = input && input.characterData && input.characterData.character
    ? input.characterData.character.values || {}
    : {};
  const issues = [];

  const professionFields = [];
  for (let index = 1; index <= 4; index += 1) {
    professionFields.push(text(values[`profession-keyword-${index}`]));
    professionFields.push(text(values[`profession-modifier-${index}`]));
  }
  const professionActive = text(values["profession-name"]) !== "" || professionFields.some(Boolean);
  if (professionActive) {
    for (let index = 1; index <= 4; index += 1) {
      const raw = text(values[`profession-modifier-${index}`]);
      if (raw === "") continue;
      if (!/^[+-]?\d+$/.test(raw)) {
        issues.push({
          level: "error",
          code: "HOPEFIND_PROFESSION_MODIFIER_NOT_INTEGER",
          path: `character.values.profession-modifier-${index}`,
          text: `职业关键词${index}的加值必须是整数。`,
        });
        continue;
      }
      const value = Number(raw);
      if (value > 3) {
        issues.push({
          level: "error",
          code: "HOPEFIND_PROFESSION_MODIFIER_MAX",
          path: `character.values.profession-modifier-${index}`,
          text: `职业关键词${index}的加值不能超过+3。`,
        });
      }
    }
  }

  for (let index = 1; index <= 5; index += 1) {
    const description = text(values[`arc-${index}-description`]);
    const intensity = text(values[`arc-${index}-intensity`]);
    if (!description && !intensity) continue;
    if (!/^[+-]?\d+$/.test(intensity) || Number(intensity) < 1 || Number(intensity) > 5) {
      issues.push({
        level: "error",
        code: "HOPEFIND_ARC_INTENSITY_RANGE",
        path: `character.values.arc-${index}-intensity`,
        text: `弧光${index}的强度必须是1到5的整数。`,
      });
    }
  }

  return issues;
};

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
