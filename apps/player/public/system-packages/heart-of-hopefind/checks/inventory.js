module.exports = async (input) => {
  const values = input?.characterData?.character?.values || {};
  const rows = Number(values["bag-1-rows"] ?? 3);
  const columns = Number(values["bag-1-columns"] ?? 5);
  return [3, 5, 7].includes(rows) && columns === 5 ? [] : [{ level: "warning", code: "HOPEFIND_BAG_PRESET", text: "请选择3×5、5×5或7×5背包；旧尺寸暂按小型背包显示。" }];
};
