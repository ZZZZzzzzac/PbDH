module.exports = async (input) => {
  const values = input && input.characterData && input.characterData.character
    ? input.characterData.character.values || {}
    : {};
  const life = values.life;
  const stress = values.stress;
  const issues = [];

  const dice = [
    { id: "hope-die", label: "希望骰", code: "HOPEFIND_HOPE_DIE_INVALID" },
    { id: "fear-die", label: "恐惧骰", code: "HOPEFIND_FEAR_DIE_INVALID" },
  ];
  for (const die of dice) {
    const value = typeof values[die.id] === "string" ? values[die.id].trim().toUpperCase() : "";
    if (!["D4", "D6", "D8", "D10", "D12", "D20"].includes(value)) {
      issues.push({
        level: "error",
        code: die.code,
        path: `character.values.${die.id}`,
        text: `${die.label}必须选择d4、d6、d8、d10、d12或d20。`,
      });
    }
  }

  if (life && stress && typeof life === "object" && typeof stress === "object") {
    const total = Number(life.max) + Number(stress.max);
    if (Number.isFinite(total) && total !== 10) {
      issues.push({
        level: "error",
        code: "HOPEFIND_LIFE_STRESS_MAX_TOTAL",
        text: `生命与压力的上限合计应为 10，当前为 ${total}。`,
      });
    }
  }
  return issues;
};

