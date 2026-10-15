const names = {
  "女教皇·正位·宫殿": "正位・女教皇",
  "女教皇·正位·日常": "正位・女教皇",
  "女教皇·逆位·宫殿": "逆位・女教皇",
  "女教皇·逆位·日常": "逆位・女教皇",
  "女皇·正位·宫殿": "正位・女皇",
  "女皇·正位·日常": "正位・女皇",
  "女皇·逆位·宫殿": "逆位・女皇",
  "女皇·逆位·日常": "逆位・女皇",
  "恋爱·正位·宫殿": "正位・恋爱",
  "恋爱·正位·日常": "正位・恋爱",
  "恋爱·逆位·宫殿": "逆位・恋爱",
  "恋爱·逆位·日常": "逆位・恋爱",
  "战车·正位·宫殿": "正位・战车",
  "战车·正位·日常": "正位・战车",
  "战车·逆位·宫殿": "逆位・战车",
  "战车·逆位·日常": "逆位・战车",
  "教皇·正位·宫殿": "正位・教皇",
  "教皇·正位·日常": "正位・教皇",
  "教皇·逆位·宫殿": "逆位・教皇",
  "教皇·逆位·日常": "逆位・教皇",
  "皇帝·正位·宫殿": "正位・皇帝",
  "皇帝·正位·日常": "正位・皇帝",
  "皇帝·逆位·宫殿": "逆位・皇帝",
  "皇帝·逆位·日常": "逆位・皇帝",
  "隐者·正位·宫殿": "正位・隐者",
  "隐者·正位·日常": "正位・隐者",
  "隐者·逆位·宫殿": "逆位・隐者",
  "隐者·逆位·日常": "逆位・隐者",
  "魔术师·正位·宫殿": "正位・魔术师",
  "魔术师·正位·日常": "正位・魔术师",
  "魔术师·逆位·宫殿": "逆位・魔术师",
  "魔术师·逆位·日常": "逆位・魔术师"
};

module.exports = ({ characterData }) => {
  const table = characterData['character-card-table'];
  if (!table || !Array.isArray(table.instances)) return characterData;
  const instances = table.instances.map((instance) => {
    const copy = instance.resourceCopy;
    const id = copy?.source?.resourceId;
    if (copy?.source?.packageId !== '01a17c40-0000-7000-8000-000000000002' || !names[id]) return instance;
    const data = { ...copy.data, 名称: names[id] };
    delete data['牌位'];
    delete data['阶段'];
    return { ...instance, resourceCopy: { ...copy, data } };
  });
  return { ...characterData, 'character-card-table': { ...table, instances } };
};
