module.exports = ({ characterData }) => {
  const next = { ...characterData };
  // 原补充经历保留在第三行，新增行不预设规则未授予的加值。
  next['experience-3'] = characterData['experience-notes'] ?? '';
  for (const i of [3, 4, 5]) {
    next[`experience-${i}`] ??= '';
    next[`experience-modifier-${i}`] = '';
  }
  delete next['experience-notes'];
  return next;
};
