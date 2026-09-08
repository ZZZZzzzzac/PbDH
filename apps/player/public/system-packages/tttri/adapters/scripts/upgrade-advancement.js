module.exports = function (input) {
  const data = JSON.parse(JSON.stringify(input.characterData));
  for (const tier of [2, 3, 4]) {
    const id = `advancement-tier-${tier}`;
    const state = data[id];
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new Error(`${id} 的旧升级记录无效，请保留原文件并检查。`);
    }
    delete state[tier === 4 ? "subclass-elite" : "subclass"];
    if (!Object.prototype.hasOwnProperty.call(state, "multiclass-2")) state["multiclass-2"] = false;
  }
  return data;
};
