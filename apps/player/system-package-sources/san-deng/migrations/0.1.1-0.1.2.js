module.exports = ({ characterData }) => ({
  ...characterData,
  "background-story": typeof characterData["background-story"] === "string" ? characterData["background-story"] : "",
});
