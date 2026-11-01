function toLit(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return { lit: value !== "灭" };
}

module.exports = ({ characterData }) => ({
  ...characterData,
  "sky-lamp-state": toLit(characterData["sky-lamp-state"]),
  "yang-lamp-state": toLit(characterData["yang-lamp-state"]),
  "yin-lamp-state": toLit(characterData["yin-lamp-state"]),
});
