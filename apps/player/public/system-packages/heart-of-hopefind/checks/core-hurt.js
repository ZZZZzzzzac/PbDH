module.exports = async (input) => {
  const values = input && input.characterData && input.characterData.character
    ? input.characterData.character.values || {}
    : {};
  const ids = [
    "core-hurt-phase-opening",
    "core-hurt-phase-development",
    "core-hurt-phase-turn",
    "core-hurt-phase-conclusion",
  ];
  const issues = [];
  let totalMax = 0;

  for (const id of ids) {
    const state = values[id];
    if (!state || typeof state !== "object") continue;
    const current = Number(state.current);
    const max = Number(state.max);
    if (Number.isFinite(max)) totalMax += max;
    if (Number.isFinite(current) && Number.isFinite(max) && current > max) {
      issues.push({
        level: "error",
        code: "HOPEFIND_CORE_HURT_CURRENT_OVER_MAX",
        path: `character.values.${id}`,
        text: "核心伤痛阶段的当前进度不能超过该阶段上限。",
      });
    }
  }

  if (totalMax > 12) {
    issues.push({
      level: "error",
      code: "HOPEFIND_CORE_HURT_MAX_TOTAL",
      text: `核心伤痛四阶段上限合计不能超过12，当前为${totalMax}。`,
    });
  }
  return issues;
};

