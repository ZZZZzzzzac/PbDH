export const zzzToCanonical = {
  NameTextbox: "character-name",
  RaceTextbox: "ancestry-name",
  CommunityTextbox: "community-name",
  ClassTextbox: "class-name",
  LevelTextbox: "level",
  EvasionTextbox: "evasion",
  AgilityTextbox: "agility",
  StrengthTextbox: "strength",
  FinesseTextbox: "finesse",
  InstinctTextbox: "instinct",
  PresenceTextbox: "presence",
  KnowledgeTextbox: "knowledge",
  MajorTextbox: "major-threshold",
  SevereTextbox: "severe-threshold",
  ClassFeatureTextbox: "class-feature",
  ArmorTextbox: "armor-value",
  ArmorTraitTextbox: "armor-description",
  ItemSlot1Textbox: "inventory",
  EventLogTextbox: "event-log",
} as const;

export const dhsheetToCanonical = {
  name: "character-name",
  level: "level",
  evasion: "evasion",
  agility: "agility",
  strength: "strength",
  finesse: "finesse",
  instinct: "instinct",
  presence: "presence",
  knowledge: "knowledge",
  minorThreshold: "major-threshold",
  majorThreshold: "severe-threshold",
  armorValue: "armor-value",
  characterBackground: "background-story",
  characterMotivation: "notes",
} as const;

export function reverseMap<T extends Record<string, string>>(mapping: T): Record<T[keyof T], keyof T> {
  return Object.fromEntries(Object.entries(mapping).map(([source, target]) => [target, source])) as Record<T[keyof T], keyof T>;
}
