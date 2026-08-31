const decoder = new TextDecoder("utf-8", { fatal: true });

export function zzzCharacterEngineRead(bytes: Uint8Array): Record<string, unknown> {
  const value = JSON.parse(decoder.decode(bytes)) as Record<string, unknown>;
  if (typeof value.NameTextbox !== "string" || !Array.isArray(value.cards)) throw new Error("invalid ZZZ character");
  return value;
}

export function dhsheetCharacterEngineRead(bytes: Uint8Array): Record<string, unknown> {
  const value = JSON.parse(decoder.decode(bytes)) as Record<string, unknown>;
  if (typeof value.ruleSetId !== "string" || typeof value.name !== "string") throw new Error("invalid dhsheet character");
  for (const [key, length] of [["cards", 20], ["inventory_cards", 20], ["inventory", 5]] as const) {
    if (!Array.isArray(value[key]) || value[key].length !== length) throw new Error(`invalid ${key}`);
  }
  return value;
}
