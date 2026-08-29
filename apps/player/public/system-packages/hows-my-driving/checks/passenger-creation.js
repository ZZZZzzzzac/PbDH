module.exports = async (input) => {
  const values = input && input.characterData && input.characterData.character
    ? input.characterData.character.values || {}
    : {};
  const ranks = [
    ["approach-expert", "专家 +3"],
    ["approach-good", "擅长 +2"],
    ["approach-practiced", "熟练 +1"],
    ["approach-poor", "生疏 -1"],
  ];
  const issues = [];
  const assigned = [];

  for (const [id, label] of ranks) {
    const value = text(values[id]);
    if (!value) {
      issues.push({
        level: "error",
        code: "HMD_APPROACH_RANK_MISSING",
        path: `character.values.${id}`,
        text: `${label}尚未填写行事风格。请按专家、擅长、熟练、生疏的顺序选择四项。`,
      });
      continue;
    }
    assigned.push([id, label, value]);
  }

  const firstByName = new Map();
  for (const [id, label, value] of assigned) {
    const key = value.toLocaleLowerCase("zh-Hans");
    const first = firstByName.get(key);
    if (first) {
      issues.push({
        level: "error",
        code: "HMD_APPROACH_RANK_DUPLICATE",
        path: `character.values.${id}`,
        text: `${label}与${first.label}重复使用了“${value}”。四个等级必须分配给不同的行事风格。`,
      });
    } else {
      firstByName.set(key, { id, label });
    }
  }

  return issues;
};

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
