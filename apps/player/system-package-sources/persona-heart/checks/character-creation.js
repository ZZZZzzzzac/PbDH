module.exports = (input) => {
  const values = input?.characterData?.character?.values ?? {};
  const cards = input?.characterData?.cards?.instances ?? [];
  const issues = [];
  const warning = (code, text, path) => issues.push({ level: "warning", code, text, ...(path ? { path } : {}) });
  if (!String(values["character-name"] ?? "").trim()) warning("PERSONA_NAME_MISSING", "请填写姓名。", "character.values.character-name");
  const attributes = ["courage", "agility", "knowledge", "charm"].map((id) => String(values[id] ?? "").trim());
  if (!attributes.every((value) => /^[+-]?\d+$/.test(value))) {
    warning("PERSONA_ATTRIBUTES_MISSING", "四属性需要填写整数；初始分配 2、1、0、-1。");
  } else if (String(values.level) === "1" && attributes.map(Number).sort((a, b) => a - b).join(",") !== "-1,0,1,2") {
    warning("PERSONA_INITIAL_ATTRIBUTES", "一级角色的四属性应为 2、1、0、-1，各使用一次。");
  }
  for (let i = 1; i <= 2; i++) if (!String(values[`experience-${i}`] ?? "").trim()) warning("PERSONA_EXPERIENCE_MISSING", `请填写经历 ${i}。`, `character.values.experience-${i}`);
  const fieldsFor = (card) => {
    const entryId = card.definitionRef?.entryId ?? card.definitionId;
    const embedded = input.characterData.embeddedResourceEntries?.[entryId]?.entry;
    return embedded?.fields ?? input.resourceLibraries?.flatMap((library) => library.entries).find((entry) => entry.ID === entryId)?.fields ?? {};
  };
  for (const label of ["正位", "逆位"]) {
    const count = cards.filter((card) => {
      const fields = fieldsFor(card);
      return card.tableModuleId === "character-card-table" && fields.类型 === "大阿卡纳" && fields.牌位 === label;
    }).length;
    if (count !== 1) warning("PERSONA_ARCANA_COUNT", `桌面上应保留一张${label}大阿卡纳。`);
  }
  if (!String(values["combat-style"] ?? "").trim()) warning("PERSONA_COMBAT_STYLE_MISSING", "请选择非日常预设，或手动填写战斗数值。", "character.values.combat-style");
  return issues;
};
