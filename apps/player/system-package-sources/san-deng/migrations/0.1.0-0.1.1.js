function toText(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value === "object" && Number.isFinite(value.current)) return String(value.current);
  return "";
}

module.exports = ({ characterData }) => ({
  ...characterData,
  life: toText(characterData.life),
  stress: toText(characterData.stress),
});
