const phases = {
  "女教皇·正位·宫殿": "宫殿",
  "女教皇·正位·日常": "日常",
  "女教皇·逆位·宫殿": "宫殿",
  "女教皇·逆位·日常": "日常",
  "女皇·正位·宫殿": "宫殿",
  "女皇·正位·日常": "日常",
  "女皇·逆位·宫殿": "宫殿",
  "女皇·逆位·日常": "日常",
  "恋爱·正位·宫殿": "宫殿",
  "恋爱·正位·日常": "日常",
  "恋爱·逆位·宫殿": "宫殿",
  "恋爱·逆位·日常": "日常",
  "战车·正位·宫殿": "宫殿",
  "战车·正位·日常": "日常",
  "战车·逆位·宫殿": "宫殿",
  "战车·逆位·日常": "日常",
  "教皇·正位·宫殿": "宫殿",
  "教皇·正位·日常": "日常",
  "教皇·逆位·宫殿": "宫殿",
  "教皇·逆位·日常": "日常",
  "皇帝·正位·宫殿": "宫殿",
  "皇帝·正位·日常": "日常",
  "皇帝·逆位·宫殿": "宫殿",
  "皇帝·逆位·日常": "日常",
  "隐者·正位·宫殿": "宫殿",
  "隐者·正位·日常": "日常",
  "隐者·逆位·宫殿": "宫殿",
  "隐者·逆位·日常": "日常",
  "魔术师·正位·宫殿": "宫殿",
  "魔术师·正位·日常": "日常",
  "魔术师·逆位·宫殿": "宫殿",
  "魔术师·逆位·日常": "日常"
};

module.exports = ({ characterData }) => {
  const table = characterData['character-card-table'];
  if (!table || !Array.isArray(table.instances)) return characterData;
  const instances = table.instances.map((instance) => {
    const copy = instance.resourceCopy;
    const phase = phases[copy?.source?.resourceId];
    if (copy?.source?.packageId !== '01a17c40-0000-7000-8000-000000000002' || !phase) return instance;
    return { ...instance, resourceCopy: { ...copy, data: { ...copy.data, 阶段: phase } } };
  });
  return { ...characterData, 'character-card-table': { ...table, instances } };
};
