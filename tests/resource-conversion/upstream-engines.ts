import { unzipSync } from "fflate";

const decoder = new TextDecoder("utf-8", { fatal: true });

export function rinkcxEngineRead(bytes: Uint8Array): Array<{ type: "enemy" | "scene"; data: Record<string, unknown> }> {
  const parsed = JSON.parse(decoder.decode(bytes)) as unknown;
  const values = Array.isArray(parsed) ? parsed : [parsed];
  return values.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid RinkCX card");
    const data = value as Record<string, unknown>;
    return { type: data.health !== undefined || data.threshold !== undefined ? "enemy" : "scene", data };
  });
}

const kidTypes = new Set([
  "weapon", "subweapon", "armor", "loot", "consumable", "domain", "story", "class", "subclass",
  "ancestry", "community", "npc", "calamity", "ingredient", "meal", "transformation", "material",
  "vehicle", "madness", "clue", "prophecy", "question", "quest", "wheelchair", "anomaly", "stronghold",
  "environment", "landmark",
]);

export function kidEngineRead(bytes: Uint8Array): Record<string, unknown> {
  const value = JSON.parse(decoder.decode(bytes)) as Record<string, unknown>;
  if (!kidTypes.has(String(value.type))) throw new Error("invalid Kid card type");
  return value;
}

export function dhsheetEngineRead(bytes: Uint8Array, dhcb: boolean): Record<string, unknown> {
  const documentBytes = dhcb ? unzipSync(bytes)["cards.json"] : bytes;
  if (!documentBytes) throw new Error("missing cards.json");
  const value = JSON.parse(decoder.decode(documentBytes)) as Record<string, unknown>;
  if (!["profession", "ancestry", "community", "subclass", "domain", "variant"].some((key) => Array.isArray(value[key]))) {
    throw new Error("invalid dhsheet pack");
  }
  return value;
}

export function dhsheetEngineImport(bytes: Uint8Array, dhcb: boolean): Record<string, unknown> {
  const value = dhsheetEngineRead(bytes, dhcb);
  const ancestries = Array.isArray(value.ancestry) ? value.ancestry : [];
  for (const [index, item] of ancestries.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`invalid ancestry ${index}`);
    const card = item as Record<string, unknown>;
    if (typeof card.id !== "string" || typeof card.名称 !== "string" || typeof card.种族 !== "string") {
      throw new Error(`invalid ancestry ${index}`);
    }
    if (![1, 2].includes(Number(card.类别))) throw new Error(`invalid ancestry category ${String(card.类别)}`);
  }
  const communities = Array.isArray(value.community) ? value.community : [];
  for (const [index, item] of communities.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`invalid community ${index}`);
    const card = item as Record<string, unknown>;
    if (typeof card.id !== "string" || typeof card.名称 !== "string" || typeof card.描述 !== "string") {
      throw new Error(`invalid community ${index}`);
    }
  }
  const domains = Array.isArray(value.domain) ? value.domain : [];
  for (const [index, item] of domains.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`invalid domain ${index}`);
    const card = item as Record<string, unknown>;
    if (typeof card.id !== "string" || typeof card.名称 !== "string" || !Number.isFinite(Number(card.等级)) || !Number.isFinite(Number(card.回想))) {
      throw new Error(`invalid domain ${index}`);
    }
  }
  const subclasses = Array.isArray(value.subclass) ? value.subclass : [];
  for (const [index, item] of subclasses.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`invalid subclass ${index}`);
    const card = item as Record<string, unknown>;
    if (typeof card.id !== "string" || typeof card.子职业 !== "string" || typeof card.主职 !== "string") {
      throw new Error(`invalid subclass ${index}`);
    }
    if (!["基石", "专精", "大师"].includes(String(card.等级))) throw new Error(`invalid subclass level ${String(card.等级)}`);
  }
  const variants = Array.isArray(value.variant) ? value.variant : [];
  const customFields = value.customFieldDefinitions as Record<string, unknown> | undefined;
  const declaredTypes = new Set(Array.isArray(customFields?.variants) ? customFields.variants.map(String) : []);
  for (const [index, item] of variants.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`invalid variant ${index}`);
    const card = item as Record<string, unknown>;
    if (typeof card.id !== "string" || typeof card.名称 !== "string" || typeof card.类型 !== "string") {
      throw new Error(`invalid variant ${index}`);
    }
    if (!declaredTypes.has(card.类型)) throw new Error(`undeclared variant type ${String(card.类型)}`);
  }
  return value;
}

export function zzzEngineRead(bytes: Uint8Array): Record<string, unknown>[] {
  const value = JSON.parse(decoder.decode(bytes)) as unknown;
  if (!Array.isArray(value)) throw new Error("invalid ZZZ pack");
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}
