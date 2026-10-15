module.exports = ({ characterData }) => {
  const next = { ...characterData };
  const upright = characterData['arcana-upright']?.instances ?? [];
  const reversed = characterData['arcana-reversed']?.instances ?? [];
  next['character-card-table'] = { instances: [...upright, ...reversed] };
  // 保留旧版手填小阿卡纳，避免布局调整后丢失玩家文字。
  const notes = [1, 2].flatMap((i) => {
    const name = String(characterData[`minor-${i}-name`] ?? '').trim();
    const daily = String(characterData[`minor-${i}-daily`] ?? '').trim();
    const palace = String(characterData[`minor-${i}-palace`] ?? '').trim();
    return name || daily || palace ? [`小阿卡纳 ${i}：${name}\n日常：${daily}\n宫殿：${palace}`] : [];
  });
  if (notes.length) next.skills = [characterData.skills, ...notes].filter(Boolean).join('\n\n');
  delete next['arcana-upright'];
  delete next['arcana-reversed'];
  for (const i of [1, 2]) for (const field of ['name', 'daily', 'palace']) delete next[`minor-${i}-${field}`];
  return next;
};
