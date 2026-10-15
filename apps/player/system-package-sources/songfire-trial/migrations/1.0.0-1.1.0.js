module.exports = ({ characterData }) => {
  const primaryDomains = { '追猎': '刀兵', '飞隼': '轻捷', '磐卫': '堡垒', '夜语': '洞察', '唤灵师': '根源' };
  const result = { ...characterData, 'primary-domain': primaryDomains[characterData['class-name']] || '', 'secondary-domain': '' };
  for (const tier of [2, 3, 4]) {
    const key = 'advancement-tier-' + tier;
    result[key] = { ...characterData[key], 'skill-exchange': false };
  }
  return result;
};
