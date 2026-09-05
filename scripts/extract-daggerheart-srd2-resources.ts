import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

import { templateRegistry } from "../packages/templates/src/core/index.ts";

type RecordEntry = { key: string; original: string; translation: string; stage: number };
type SourceResource = Record<string, unknown> & { ID: string; 名称: string };
const kindTemplateId: Record<string, string> = {
  ancestries: "种族", communities: "社群", classes: "职业", subclasses: "子职业",
  weapons: "武器", armor: "护甲", loot: "物品", "domain-cards": "领域卡",
  beastforms: "自由", adversaries: "敌人", environments: "环境",
};
// 已发布资源的身份不能因纠正译名而漂移。
const publishedResourceIds = new Map([
  ["weapons\u0000武器:回响利刃:4:副武器", "0585bc96-de93-5371-8d04-c4ab5d2da68f"],
]);

const repositorySource = "docs/sources/daggerheart-srd2/DH_SRD_2_2026_08_25.paratranz.json";
const sourcePath = argument("--source") ?? repositorySource;
const resolvedSourcePath = path.resolve(sourcePath);
const sourceBytes = await readFile(resolvedSourcePath);
const records = JSON.parse(sourceBytes.toString("utf8")) as RecordEntry[];
if (!Array.isArray(records) || records.length !== 1102) throw new Error(`Expected 1102 paired records, received ${records.length}`);
for (const record of records) if (!record.original?.trim()) throw new Error(`Missing original text: ${record.key}`);
const localizedExperiences = buildLocalizedExperienceIndex(records);

const outputRootArgument = argument("--output-root");
if (!outputRootArgument) throw new Error("Missing required --output-root; use npm run build:daggerheart-core for normal generation.");
const outputRoot = path.resolve(outputRootArgument);
const proseFields = new Set([
  "简介", "特性描述", "描述", "动机与战术", "经历", "趋向", "潜在敌人", "引导问题", "职业物品", "背景问题", "关系问题",
]);
const resources = {
  ancestries: extractAncestries(),
  communities: extractCommunities(),
  classes: extractClasses(),
  subclasses: extractSubclasses(),
  beastforms: extractBeastforms(),
  weapons: extractWeapons(),
  armor: extractArmor(),
  loot: extractItems(),
  "domain-cards": extractDomainCards(),
  adversaries: extractAdversaries(),
  environments: extractEnvironments(),
};

const expectedCounts: Record<keyof typeof resources, number> = {
  ancestries: 24, communities: 15, classes: 13, subclasses: 78, beastforms: 24, weapons: 307,
  armor: 69, loot: 240, "domain-cards": 210, adversaries: 264, environments: 47,
};
const countMismatches = (Object.entries(resources) as Array<[keyof typeof resources, SourceResource[]]>).filter(([kind, entries]) => entries.length !== expectedCounts[kind]).map(([kind, entries]) => `${kind}: expected ${expectedCounts[kind]}, extracted ${entries.length}`);
if (countMismatches.length > 0) throw new Error(countMismatches.join("\n"));
assertCatalogMatches(records.find((record) => record.key === "SRD2_SECTION_413"), resources.adversaries, "敌人");
assertCatalogMatches(records.find((record) => record.key === "SRD2_SECTION_695"), resources.environments, "环境");
for (const [kind, entries] of Object.entries(resources) as Array<[keyof typeof resources, SourceResource[]]>) {
  const templateId = kindTemplateId[kind];
  const template = templateId ? templateRegistry.resolve(templateId, "1.0.1") : undefined;
  if (!template) throw new Error(`${kind}: missing template ${templateId}`);
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(template.schema);
  const ids = new Set<string>();
  for (const entry of entries) {
    entry.ID = kind === "subclasses"
      ? `子职业:${String(entry.主职)}:${String(entry.名称)}:${String(entry.等级)}`
      : stableResourceId(kind, entry.ID);
    normalizeResourceText(entry);
    assertNoUnexpectedLatin(kind, entry);
    if (!entry.ID || !entry.名称) throw new Error(`${kind}: resource is missing ID or 名称`);
    if (ids.has(entry.ID)) throw new Error(`${kind}: duplicate ID ${entry.ID}`);
    ids.add(entry.ID);
    const { ID, 卡图, 卡背, ...data } = entry;
    if (!validate(data)) throw new Error(`${kind}/${entry.ID}: does not match ${templateId} schema: ${JSON.stringify(validate.errors)}`);
  }
}
await mkdir(outputRoot, { recursive: true });
for (const [kind, entries] of Object.entries(resources)) {
  await writeFile(path.join(outputRoot, `${kind}.json`), `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(resources).map(([kind, entries]) => [kind, entries.length])), null, 2));

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function stableResourceId(kind: string, sourceIdentity: string): string {
  const publishedId = publishedResourceIds.get(`${kind}\u0000${sourceIdentity}`);
  if (publishedId) return publishedId;
  const hex = createHash("sha256").update(`pbdh:daggerheart-srd2:${kind}:${sourceIdentity}`, "utf8").digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function normalizeResourceText(entry: SourceResource): void {
  for (const [key, value] of Object.entries(entry)) {
    if (["ID", "卡图", "卡背", "原文", "特性原文"].includes(key)) continue;
    entry[key] = normalizeResourceValue(value, key);
  }
}

function normalizeResourceValue(value: unknown, field: string): unknown {
  if (typeof value === "string") {
    const stripped = stripMarkdownSyntax(value);
    const normalized = proseFields.has(field) ? applyMakeup(normalizeLineBreaks(stripped)) : plain(stripped);
    return stripParallelEnglish(normalized);
  }
  if (Array.isArray(value)) return value.map((item) => normalizeResourceValue(item, field));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      ["原文", "特性原文"].includes(key) ? item : normalizeResourceValue(item, key),
    ]));
  }
  return value;
}

function stripParallelEnglish(value: string): string {
  const protectedValues: string[] = [];
  const protectedText = value
    .replace(/\b\d*d\d+(?:\s*[+−-]\s*\d+)?\b/giu, (match) => {
      protectedValues.push(match);
      return `§甲${protectedValues.length - 1}§`;
    })
    .replace(/\bX\b/gu, () => {
      protectedValues.push("X");
      return `§甲${protectedValues.length - 1}§`;
    });
  let result = protectedText
    .replace(/\|item\s*\($/giu, "")
    .replace(/[A-Za-z]+(?:[’'][A-Za-z]+)*(?:-[A-Za-z]+)*/gu, "")
    .replace(/\s*[“"][\s.…,!?！？]*[”"]\s*/gu, " ")
    .replace(/\s+([,，。；：！？）])/gu, "$1")
    .replace(/([（])\s+/gu, "$1")
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/\n[ \t]+/gu, "\n")
    .trim();
  result = result.replace(/§甲(\d+)§/gu, (_match, index: string) => protectedValues[Number(index)] ?? "");
  return result;
}

function assertNoUnexpectedLatin(kind: string, entry: SourceResource): void {
  const visit = (value: unknown, field: string, location: string): void => {
    if (["ID", "卡图", "卡背", "原文", "特性原文"].includes(field)) return;
    if (typeof value === "string") {
      const residue = value.replace(/\b\d*d\d+(?:\s*[+−-]\s*\d+)?\b/giu, "").replace(/\bX\b/gu, "");
      if (/[A-Za-z]/u.test(residue)) throw new Error(`${kind}/${entry.ID}/${location}: unexpected Latin text: ${value}`);
      return;
    }
    if (Array.isArray(value)) value.forEach((item, index) => visit(item, field, `${location}[${index}]`));
    else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) visit(item, key, `${location}.${key}`);
    }
  };
  visit(entry, "", "resource");
}

function stripMarkdownSyntax(value: string): string {
  return clean(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/<[^>]+>/gu, "")
    .replace(/^\s{0,3}#{1,6}\s*/gmu, "")
    .replace(/^\s*>\s?/gmu, "")
    .replace(/~~|`{1,3}/gu, "")
    .replace(/\\([*_`[\]()#>+.!-])/gu, "$1")
    .replace(/[*_]{1,3}/gu, "");
}

function normalizeLineBreaks(value: string): string {
  const output: string[] = [];
  let current = "";
  let currentIsList = false;
  const flush = () => {
    if (!current) return;
    output.push(current);
    current = "";
    currentIsList = false;
  };
  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      if (output.length && output.at(-1) !== "") output.push("");
      continue;
    }
    const bullet = /^(?:(?:[-+•·])\s+|(\d+)[.)、]\s*)(.+)$/u.exec(line);
    if (bullet) {
      flush();
      current = bullet[1] ? `${bullet[1]}）${bullet[2]}` : `• ${bullet[2]}`;
      currentIsList = true;
      continue;
    }
    if (!current) {
      current = line;
      continue;
    }
    if (/[。！？；：.!?]$/u.test(current)) {
      flush();
      current = line;
      continue;
    }
    const spacer = /[A-Za-z0-9]$/u.test(current) && /^[A-Za-z0-9]/u.test(line) ? " " : "";
    current += `${spacer}${line}`;
    if (currentIsList && /[。！？；.!?]$/u.test(current)) flush();
  }
  flush();
  while (output.at(-1) === "") output.pop();
  return output.join("\n").replace(/\n{3,}/gu, "\n\n");
}

function applyMakeup(value: string): string {
  const verbMap: Record<string, string> = { 回复: "恢复", 移除: "清除", 消耗: "花费" };
  const numberMap: Record<string, string> = { 一: "1", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9", 十: "10", 两: "2" };
  let result = value
    .replace(/(?<![A-Za-z(（])PC(?![A-Za-z)）])/gu, "玩家角色")
    .replace(/(?<![A-Za-z(（])GM(?![A-Za-z)）])/gu, "游戏主持人")
    .replace(/重骰/gu, "重掷");
  result = result.replace(
    /(恢复|回复|标记|清除|移除|获得|花费|消耗|失去|承受|转移)\s*(\d{1,2}d\d{1,2}(?:[+−-]\d+)?|\d{1,2}|[一二三四五六七八九十两]|任意数量|一或更多|等量|至少\s*\d+)\s*(?:个|点)?\s*(生命|希望|压力|恐惧|绝望|恩宠|专注|回响|充能|护甲)(点|值|槽)?/gu,
    (_match, rawVerb: string, rawAmount: string, rawResource: string) => {
      const verb = verbMap[rawVerb] ?? rawVerb;
      const amount = numberMap[rawAmount] ?? rawAmount.replace(/\s+/gu, "");
      const resource = rawResource === "绝望" ? "恐惧" : rawResource;
      const suffix = resource === "护甲" ? "槽" : "点";
      return `**${verb} ${amount} ${resource}${suffix}**`;
    },
  );
  result = replaceOutsideBold(result, /(?<![A-Za-z])(?:\d+)?d\d+(?:[+−-]\d+)?/giu, (match) => `**${match.replace(/\s+/gu, "")}**`);
  result = replaceOutsideBold(result, /(敏捷|力量|灵巧|本能|风度|知识|施法)掷骰(?:\s*[（(]\d+[）)])?/gu, (match) => `**${match}**`);
  return result;
}

function replaceOutsideBold(value: string, pattern: RegExp, replacement: (match: string) => string): string {
  return value.split("**").map((part, index) => index % 2 === 0 ? part.replace(pattern, replacement) : part).join("**");
}

function sectionNumber(record: RecordEntry): number {
  return Number(record.key.split("_").at(-1));
}

function clean(value: string): string {
  return value.replace(/\r/gu, "").replace(/[ \t]+\n/gu, "\n").trim();
}

function fold(value: string): string {
  return value.toLocaleLowerCase().replace(/[’‘]/gu, "'");
}

function plain(value: string): string {
  return clean(value).replace(/^[-*]\s*/u, "").replace(/[*_]/gu, "").replace(/\s+/gu, " ").trim();
}

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function heading(markdown: string): string {
  const match = /^#{1,4}\s+(.+)$/mu.exec(markdown);
  if (!match) throw new Error("Missing resource heading");
  return plain(match[1]!);
}

function correctedOriginalName(value: string): string {
  const corrections: Record<string, string> = {
    "POL TERGEIST": "POLTERGEIST",
    "RA VENOUS MOCKERY": "RAVENOUS MOCKERY",
    "OUTER REALMS CORRUPTER": "OUTER REALMS CORRUPTOR",
    "OCEAN VOY AGE": "OCEAN VOYAGE",
    "CONVERGENCE, THE CITY OF PORTALS": "CONVERGENCE, CITY OF PORTALS",
  };
  return corrections[value.toLocaleUpperCase()] ?? value;
}

function catalogNames(record: RecordEntry | undefined, kind: "敌人" | "环境"): string[] {
  if (!record) throw new Error(`Missing ${kind} catalog record`);
  const result: string[] = [];
  let current = "";
  const flush = () => {
    if (!current) return;
    const withoutType = kind === "环境"
      ? current.replace(/\s+\((?:Exploration|Traversal|Event|Social)\)\s*$/iu, "")
      : current;
    result.push(correctedOriginalName(plain(withoutType)));
    current = "";
  };
  for (const rawLine of record.original.split("\n")) {
    const line = rawLine.trim();
    const bullet = /^-\s+(.+)$/u.exec(line);
    if (bullet) {
      flush();
      current = bullet[1]!;
    } else if (current && line && !/^TIER\s+/iu.test(line)) {
      current += ` ${line}`;
    }
  }
  flush();
  return result;
}

function assertCatalogMatches(record: RecordEntry | undefined, entries: SourceResource[], kind: "敌人" | "环境"): void {
  const expected = catalogNames(record, kind);
  const actual = entries.map((entry) => correctedOriginalName(String(entry.原文 ?? "")));
  const expectedKeys = new Map(expected.map((name) => [fold(name), name]));
  const actualKeys = new Map(actual.map((name) => [fold(name), name]));
  const missing = [...expectedKeys].filter(([key]) => !actualKeys.has(key)).map(([, name]) => name);
  const extra = [...actualKeys].filter(([key]) => !expectedKeys.has(key)).map(([, name]) => name);
  if (expected.length !== expectedKeys.size || actual.length !== actualKeys.size || missing.length || extra.length) {
    throw new Error(`${kind}目录与资源不一致: catalog=${expected.length}, resources=${actual.length}, missing=${missing.join(", ") || "-"}, extra=${extra.join(", ") || "-"}`);
  }
}

function localizedName(record: RecordEntry): { name: string; original: string } {
  const original = correctedOriginalName(heading(record.original));
  const translated = heading(record.translation);
  const index = translated.toLocaleLowerCase().indexOf(original.toLocaleLowerCase());
  const name = index >= 0 ? plain(translated.slice(0, index)) : plain(translated.replace(/\s+[A-Za-z][\s\S]*$/u, ""));
  if (!name) throw new Error(`${record.key}: cannot pair heading ${translated} / ${original}`);
  return { name, original };
}

function localizedHeadingPrefix(record: RecordEntry): { name: string; original: string } {
  const original = correctedOriginalName(heading(record.original));
  const name = plain(heading(record.translation).replace(/\s+[A-Za-z][\s\S]*$/u, ""));
  if (!name) throw new Error(`${record.key}: missing localized heading`);
  return { name, original };
}

function localizedCell(value: string, original: string): string {
  const normalizedValue = fold(value);
  const normalizedOriginal = fold(original);
  const suffixAt = normalizedValue.endsWith(normalizedOriginal)
    ? value.length - original.length
    : -1;
  const result = plain(suffixAt >= 0 ? value.slice(0, suffixAt) : value);
  return result || plain(value);
}

function afterHeading(markdown: string): string {
  return clean(markdown.replace(/^#{1,4}\s+.+\n+/u, ""));
}

function beforeHeading(markdown: string, titlePattern: RegExp): string {
  return clean(markdown.split(titlePattern)[0] ?? "");
}

function field(markdown: string, label: string): string {
  const match = new RegExp(`(?:\\*\\*)?${escaped(label)}\\s*(?:[：:]|[-–—])\\s*(?:\\*\\*)?\\s*([^\\n|]+)`, "iu").exec(markdown);
  return plain(match?.[1] ?? "");
}

function buildLocalizedExperienceIndex(sourceRecords: RecordEntry[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const record of sourceRecords) {
    const original = field(record.original, "Experience");
    const translated = field(record.translation, "经历");
    if (original && translated && /[\u3400-\u9fff]/u.test(translated)) result.set(fold(original), translated);
  }
  return result;
}

function localizedExperience(record: RecordEntry): string {
  const translated = field(record.translation, "经历");
  if (/[\u3400-\u9fff]/u.test(translated)) return translated;
  const original = field(record.original, "Experience");
  return localizedExperiences.get(fold(original)) ?? translated;
}

function dashField(markdown: string, label: string): string {
  return plain(new RegExp(`^${escaped(label)}\\s*[–—-]\\s*([^\\n]+)$`, "imu").exec(markdown)?.[1] ?? "");
}

function bulletLines(markdown: string): string[] {
  return [...markdown.matchAll(/^\s*-\s+(.+)$/gmu)].map((match) => plain(match[1]!));
}

function englishFeatureMarkers(markdown: string): Array<{ name: string; start: number; bodyStart: number }> {
  const markers: Array<{ name: string; start: number; bodyStart: number }> = [];
  for (const match of markdown.matchAll(/^(?:[-*]\s*)?(?:\*\*|__)?([A-Z][^:\n]{0,78}?)(?:\*\*|__)?\s*:\s*/gmu)) {
    const name = plain(match[1]!);
    if (/^(Motives|Difficulty|Thresholds|HP|Stress|ATK|Experience|Recall Cost|Potential Adversaries|Impulses|While |When |On |If |You |At |Once |Spend |After |Before |Whenever |Each |Choose )/iu.test(name)) continue;
    markers.push({ name, start: match.index!, bodyStart: match.index! + match[0].length });
  }
  if (markers.length === 0) {
    const match = /^([A-Z][^.\n]{0,78})\.\s*/mu.exec(markdown);
    if (match) markers.push({ name: plain(match[1]!), start: match.index, bodyStart: match.index + match[0].length });
  }
  return markers;
}

function pairedFeatures(original: string, translation: string): Array<{ 特性名称: string; 特性原文: string; 特性描述: string }> {
  const translatedLower = fold(translation);
  const seen = new Set<string>();
  const markers = englishFeatureMarkers(original).filter((marker) => {
    const name = fold(marker.name);
    if (seen.has(name) || !translatedLower.includes(name)) return false;
    seen.add(name);
    return true;
  });
  if (markers.length === 0 && clean(original)) throw new Error(`No paired feature markers found: ${plain(original).slice(0, 120)}`);
  const result: Array<{ 特性名称: string; 特性原文: string; 特性描述: string }> = [];
  let cursor = 0;
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index]!;
    const found = translatedLower.indexOf(fold(marker.name), cursor);
    if (found < 0) throw new Error(`Cannot pair feature ${marker.name}`);
    const lineStart = Math.max(translation.lastIndexOf("\n", found) + 1, cursor);
    const colon = translation.slice(found + marker.name.length).search(/[：:]/u);
    if (colon < 0) throw new Error(`Cannot find translated feature body for ${marker.name}`);
    const bodyStart = found + marker.name.length + colon + 1;
    const nextName = markers[index + 1]?.name;
    const next = nextName ? translatedLower.indexOf(fold(nextName), bodyStart) : -1;
    const bodyEnd = next < 0 ? translation.length : Math.max(lineStart, translation.lastIndexOf("\n", next));
    const prefix = translation.slice(lineStart, found);
    result.push({ 特性名称: plain(prefix) || marker.name, 特性原文: marker.name, 特性描述: clean(translation.slice(bodyStart, bodyEnd)) });
    cursor = bodyStart;
  }
  return result;
}

function firstSentence(value: string): string {
  const normalized = clean(value);
  const period = normalized.indexOf("。");
  return period >= 0 ? normalized.slice(0, period + 1) : normalized;
}

function extractBeastforms(): SourceResource[] {
  return records.filter((record) => {
    const number = sectionNumber(record);
    return number >= 74 && number <= 100 && ![80, 87, 94].includes(number);
  }).map((record) => {
    const number = sectionNumber(record);
    const tier = number <= 79 ? "1" : number <= 86 ? "2" : number <= 93 ? "3" : "4";
    const names = localizedName(record);
    const translation = clean(record.translation.replace(/^\s*[|/=]+\s*$/gmu, ""));
    const body = afterHeading(translation);
    const features = pairedBeastformFeatures(record, body);
    const firstFeature = features[0];
    const originalFeatureAt = firstFeature?.特性原文 ? fold(body).indexOf(fold(firstFeature.特性原文)) : -1;
    const localizedFeatureAt = firstFeature?.特性名称 ? fold(body).indexOf(fold(firstFeature.特性名称)) : -1;
    const firstFeatureAt = originalFeatureAt >= 0 ? originalFeatureAt : localizedFeatureAt;
    const featureLineStart = firstFeatureAt >= 0 ? body.lastIndexOf("\n", firstFeatureAt) + 1 : body.length;
    const introduction = body.slice(0, featureLineStart);
    const example = /^\s*[（(][^\n]+[）)]\s*$/mu.exec(introduction)?.[0] ?? "";
    const statistics = beastformStatistics(record);
    return {
      ID: `野兽形态:${names.name}`,
      名称: names.name,
      原文: names.original,
      类型: "野兽形态",
      简介: plain(example).replace(/^[（(]\s*|\s*[）)]$/gu, ""),
      位阶: tier,
      属性: statistics.trait,
      闪避: statistics.evasion,
      武器: statistics.weapon,
      优势: field(translation, "获得优势"),
      内容: features.map((feature) => ({ 名称: feature.特性名称, 原文: feature.特性原文, 描述: feature.特性描述 })),
    };
  });
}

function beastformStatistics(record: RecordEntry): { trait: string; evasion: string; weapon: string } {
  const traitNames: Record<string, string> = { Agility: "敏捷", Strength: "力量", Finesse: "灵巧", Instinct: "本能" };
  const rangeNames: Record<string, string> = { Melee: "近战", "Very Close": "邻近", Close: "近距离", Far: "远距离" };
  const damageNames: Record<string, string> = { phy: "物理", mag: "魔法" };
  const stat = /\b(Agility|Strength|Finesse|Instinct)\s+([+−-]\d+)\s*\|\s*Evasion\s+([+−-]\d+)/iu.exec(record.original);
  const weapon = /^(?:(Melee|Very Close|Close|Far)\s+(Agility|Strength|Finesse|Instinct)|(Agility|Strength|Finesse|Instinct)\s+(Melee|Very Close|Close|Far))\s+(d\d+(?:[+−-]\d+)?)\s+(phy|mag)\s*$/imu.exec(record.original);
  const traitName = stat?.[1] ? traitNames[stat[1]] ?? "" : "";
  const range = weapon?.[1] ?? weapon?.[4] ?? "";
  const weaponTrait = weapon?.[2] ?? weapon?.[3] ?? "";
  return {
    trait: stat ? `${traitName} ${stat[2]}` : "",
    evasion: stat?.[3] ?? "",
    weapon: weapon ? `${rangeNames[range] ?? range} ${traitNames[weaponTrait] ?? weaponTrait} ${weapon[5]} ${damageNames[weapon[6]!] ?? weapon[6]}` : "",
  };
}

function pairedBeastformFeatures(record: RecordEntry, translation: string): Array<{ 特性名称: string; 特性原文: string; 特性描述: string }> {
  try {
    return pairedFeatures(record.original, translation);
  } catch (error) {
    const originalMarkers = englishFeatureMarkers(record.original);
    const translatedMarkers = [...translation.matchAll(/^\s*[*_]{0,3}([^*\n：:]+?)[*_]{0,3}\s*[：:]\s*[*_]{0,3}/gmu)];
    const translatedMarker = translatedMarkers.at(-1);
    if (originalMarkers.length !== 1 || !translatedMarker) throw error;
    return [{
      特性名称: plain(translatedMarker[1]!),
      特性原文: originalMarkers[0]!.name,
      特性描述: clean(translation.slice(translatedMarker.index! + translatedMarker[0].length)),
    }];
  }
}

function extractAncestries(): SourceResource[] {
  const result = records.filter((record) => {
    const number = sectionNumber(record);
    return number >= 167 && number <= 192 && /ANCESTRY FEATURES/iu.test(record.original);
  }).map((record) => {
    const names = localizedName(record);
    const originalParts = record.original.split(/^### ANCESTRY FEATURES?\s*$/imu);
    const translatedParts = record.translation.split(/^#{3,4}\s+(?:\*+)?种族特性(?:\*+)?\s*$/imu);
    const features = pairedFeatures(originalParts[1] ?? "", translatedParts[1] ?? "");
    return { ID: `种族:${names.name}`, 名称: names.name, 原文: names.original, 类型: "种族", 简介: firstSentence(afterHeading(translatedParts[0] ?? "")), 特性: features };
  });
  const faerie = records.find((record) => sectionNumber(record) === 177)!;
  const faerieFeatures = records.find((record) => sectionNumber(record) === 178)!;
  const names = localizedName(faerie);
  result.push({ ID: `种族:${names.name}`, 名称: names.name, 原文: names.original, 类型: "种族", 简介: firstSentence(afterHeading(faerie.translation)), 特性: pairedFeatures(afterHeading(faerieFeatures.original), afterHeading(faerieFeatures.translation)) });
  return result;
}

function extractCommunities(): SourceResource[] {
  return records.filter((record) => sectionNumber(record) >= 195 && sectionNumber(record) <= 209).map((record) => {
    const names = localizedName(record);
    const originalParts = record.original.split(/^### COMMUNITY FEATURE\s*$/imu);
    const translatedParts = record.translation.split(/^###\s+社群特性\s*$/imu);
    const features = pairedFeatures(originalParts[1] ?? "", translatedParts[1] ?? "");
    if (features.length !== 1) throw new Error(`${record.key}: expected one community feature`);
    const introduction = afterHeading(translatedParts[0] ?? "");
    const personality = introduction.split(/\n+/u).filter(Boolean).at(-1) ?? "";
    return { ID: `社群:${names.name}`, 名称: names.name, 原文: names.original, 类型: "社群", 简介: firstSentence(introduction), 性格: plain(personality), 特性: features[0] };
  });
}

function extractClasses(): SourceResource[] {
  return records.filter((record) => /DOMAINS\s*[–-]/iu.test(record.original) && /CLASS ITEMS\s*[–-]/iu.test(record.original)).map((record) => {
    const names = localizedName(record);
    const classIntro = beforeHeading(record.translation, /^#{3,4}\s*\*{0,2}.+希望特性\*{0,2}\s*$/imu);
    const hopeHeading = /^#{3,4}\s*\*{0,2}.+希望特性\*{0,2}\s*$/imu.exec(record.translation);
    const featureHeading = /^#{3,4}\s*\*{0,2}职业特性\*{0,2}\s*$/imu.exec(record.translation);
    if (!hopeHeading || !featureHeading) throw new Error(`${record.key}: missing class feature headings`);
    const hopeText = record.translation.slice(hopeHeading.index + hopeHeading[0].length, featureHeading.index);
    const originalHope = record.original.split(/^### .+HOPE FEATURE\s*$/imu)[1]?.split(/^### CLASS FEATURES?\s*$/imu)[0] ?? "";
    const featuresOriginal = record.original.split(/^### CLASS FEATURES?\s*$/imu)[1] ?? "";
    const hope = pairedFeatures(originalHope, hopeText);
    const features = pairedFeatures(featuresOriginal, record.translation.slice(featureHeading.index + featureHeading[0].length));
    if (hope.length !== 1) throw new Error(`${record.key}: expected one hope feature`);
    const originalDomains = dashField(record.original, "DOMAINS").split(/[&＋+]/u).map((value) => domainName(plain(value))).filter(Boolean);
    const translatedClassItem = field(classIntro, "职业物品") || plain(/(?:^|\n)职业物品\s*\n+([^#\n|]+)/mu.exec(classIntro)?.[1] ?? "");
    const introduction = clean(afterHeading(classIntro).split(/^(?:\/|\|.*领域|#{2,4}\s+\*{0,2}领域|\*{0,2}领域\s*[-–—：:])/imu)[0] ?? "");
    const number = sectionNumber(record);
    const background = records.find((item) => sectionNumber(item) > number && /^### BACKGROUND QUESTIONS\s*$/imu.test(item.original));
    const connections = records.find((item) => sectionNumber(item) > number && /^### CONNECTIONS\s*$/imu.test(item.original));
    return {
      ID: `职业:${names.name}`, 名称: names.name, 原文: names.original, 类型: "职业", 简介: introduction,
      领域: originalDomains, 生命点: dashField(record.original, "STARTING HIT POINTS"), 闪避值: dashField(record.original, "STARTING EVASION"),
      职业物品: translatedClassItem || dashField(record.original, "CLASS ITEMS"), 希望特性: hope[0], 特性: features,
      推荐初始属性: { 敏捷: "", 力量: "", 灵巧: "", 本能: "", 风度: "", 知识: "" }, 推荐初始武器: "", 推荐初始护甲: "", 背景问题: bulletLines(background?.translation ?? ""), 关系问题: bulletLines(connections?.translation ?? ""),
    };
  });
}

function extractSubclasses(): SourceResource[] {
  const classBySection = records.filter((record) => /DOMAINS\s*[–-]/iu.test(record.original) && /CLASS ITEMS\s*[–-]/iu.test(record.original)).map((record) => ({ section: sectionNumber(record), name: localizedName(record).name }));
  const result: SourceResource[] = [];
  for (const record of records.filter((item) => sectionNumber(item) > 37 && /FOUNDATION FEATURES?/iu.test(item.original) && /MASTERY FEATURES?/iu.test(item.original))) {
    const names = localizedName(record);
    const parent = classBySection.filter((item) => item.section < sectionNumber(record)).at(-1)?.name;
    if (!parent) throw new Error(`${record.key}: missing subclass parent`);
    const spellcast = plain(record.translation.split(/^#{2,4}\s+\*{0,2}施法属性\*{0,2}(?:[：:].*)?$/imu)[1]?.split(/^#{3,4}\s+\*{0,2}基础特性/imu)[0] ?? field(record.translation, "施法属性"));
    const intro = clean(afterHeading(record.translation).split(/^#{2,4}\s+\*{0,2}(?:施法属性|基础特性)/imu)[0] ?? "");
    for (const [level, englishHeading, chineseHeading] of [["基础", "FOUNDATION", "基础"], ["进阶", "SPECIALIZATION", "进阶"], ["精通", "MASTERY", "精通"]] as const) {
      const originalPart = record.original.split(new RegExp(`^### ${englishHeading} FEATURES?\\s*$`, "imu"))[1]?.split(/^### /mu)[0] ?? "";
      const translatedPart = record.translation.split(new RegExp(`^#{3,4}\\s+\\*{0,2}${chineseHeading}特性\\*{0,2}\\s*$`, "imu"))[1]?.split(/^#{3,4}\s+/mu)[0] ?? "";
      const features = pairedFeatures(originalPart, translatedPart);
      result.push({ ID: `子职业:${parent}:${names.name}:${level}`, 名称: names.name, 原文: names.original, 类型: "子职业", 主职: parent, 等级: level, 施法属性: spellcast, 特性: features, 简介: intro });
    }
  }
  return result;
}

function tableRows(markdown: string, columns: number): string[][] {
  return markdown.split(/\r?\n/u).filter((line) => /^\|/u.test(line)).map((line) => line.split("|").slice(1, -1).map((cell) => clean(cell))).filter((cells) => cells.length === columns && !cells.every((cell) => /^-+$/u.test(cell)));
}

function tablePairs(record: RecordEntry, columns: number, header: string): Array<{ original: string[]; translated: string[]; position: number }> {
  const originals = tableRows(record.original, columns).filter((row) => plain(row[0]!).toLocaleLowerCase() !== header.toLocaleLowerCase());
  const translated = tableRows(record.translation, columns).filter((row) => !["名称", "掷骰"].includes(plain(row[0]!)));
  if (originals.length !== translated.length) throw new Error(`${record.key}: table row mismatch ${originals.length}/${translated.length}`);
  return originals.map((row, index) => ({ original: row, translated: translated[index]!, position: record.original.indexOf(`| ${row[0]}`) }));
}

function tierAt(markdown: string, position: number, fallback = "1"): string {
  const matches = [...markdown.slice(0, position < 0 ? markdown.length : position).matchAll(/TIER\s+(\d)/giu)];
  return matches.at(-1)?.[1] ?? fallback;
}

function splitFeature(original: string, translated: string): { 特性名称: string; 特性原文: string; 特性描述: string } {
  if (/^[—–-]$/u.test(plain(original))) return { 特性名称: "", 特性原文: "", 特性描述: "" };
  const match = /^([^:]+):\s*([\s\S]*)$/u.exec(plain(original));
  if (!match) return { 特性名称: "", 特性原文: "", 特性描述: plain(translated) };
  const originalName = plain(match[1]!);
  const index = translated.toLocaleLowerCase().indexOf(originalName.toLocaleLowerCase());
  const colon = translated.slice(Math.max(0, index) + originalName.length).search(/[：:]/u);
  return {
    特性名称: index >= 0 ? plain(translated.slice(0, index)) : originalName,
    特性原文: originalName,
    特性描述: plain(index >= 0 && colon >= 0 ? translated.slice(index + originalName.length + colon + 1) : translated),
  };
}

function extractWeapons(): SourceResource[] {
  const result: SourceResource[] = [];
  const validTraits = new Set(["agility", "strength", "finesse", "instinct", "presence", "knowledge", "spellcast"]);
  let inheritedTier = "1";
  for (const record of records.filter((item) => sectionNumber(item) >= 300 && sectionNumber(item) <= 314)) {
    if (sectionNumber(record) !== 313 && /\| Name \| Trait \| Range \| Damage \| Burden \| Feature \|/iu.test(record.original)) {
      for (const row of tablePairs(record, 6, "Name")) {
        const malformedNameSuffix = ({ "Legendary Rope": "Dart", "Severed Dragon": "Claw" } as Record<string, string>)[plain(row.original[0]!)];
        const originalTrait = malformedNameSuffix ? plain(row.original[1]!).replace(new RegExp(`\\s+${malformedNameSuffix}$`, "u"), "") : plain(row.original[1]!);
        if (!validTraits.has(originalTrait.toLocaleLowerCase())) continue;
        const originalName = `${plain(row.original[0]!)}${malformedNameSuffix ? ` ${malformedNameSuffix}` : ""}`;
        const feature = splitFeature(row.original[5]!, row.translated[5]!);
        const damage = plain(row.translated[3]!);
        const tier = tierAt(record.original, row.position, inheritedTier);
        const extractedName = localizedCell(row.translated[0]!, originalName);
        const name = normalizeWeaponName(extractedName);
        result.push({
          ID: `武器:${extractedName}:${tier}:${sectionNumber(record) >= 314 ? "副武器" : "主武器"}`,
          名称: name, 原文: originalName, 类型: sectionNumber(record) >= 314 ? "副武器" : "主武器",
          属性: plain(row.translated[1]!), 距离: plain(row.translated[2]!).replace(/范围$/u, ""), 伤害: damage.replace(/\s*(物理|魔法)$/u, ""),
          负荷: /^双手/u.test(plain(row.translated[4]!)) ? "双手" : "单手", 伤害类型: /魔法$/u.test(damage) ? "魔法" : "物理", ...feature,
          简介: "", 位阶: tier,
        });
      }
    }
    inheritedTier = tierAt(record.original, record.original.length, inheritedTier);
  }
  const frames = records.find((record) => sectionNumber(record) === 315)!;
  for (const row of tablePairs(frames, 7, "Name")) {
    if (!/^(Agility|Strength|Finesse|Instinct|Presence|Knowledge|Spellcast)$/iu.test(plain(row.original[2]!))) continue;
    const originalName = plain(row.original[0]!);
    const feature = splitFeature(row.original[6]!, row.translated[6]!);
    const damage = plain(row.translated[4]!);
    const extractedName = localizedCell(row.translated[0]!, originalName);
    const name = normalizeWeaponName(extractedName);
    result.push({ ID: `武器:${extractedName}:${plain(row.original[1]!)}:主武器`, 名称: name, 原文: originalName, 类型: "主武器", 属性: plain(row.translated[2]!), 距离: plain(row.translated[3]!).replace(/范围$/u, ""), 伤害: damage.replace(/\s*(物理|魔法)$/u, ""), 负荷: /^双手/u.test(plain(row.translated[5]!)) ? "双手" : "单手", 伤害类型: /魔法$/u.test(damage) ? "魔法" : "物理", ...feature, 简介: "", 位阶: plain(row.original[1]!) });
  }
  return result;
}

function normalizeWeaponName(value: string): string {
  return value.replace(/^高级\s+(?=\p{Script=Han})/u, "高级");
}

function extractArmor(): SourceResource[] {
  const result: SourceResource[] = [];
  for (const record of records.filter((item) => sectionNumber(item) >= 319 && sectionNumber(item) <= 321 && /\| Name \| Base Thresholds \| Base Score \| Feature \|/iu.test(item.original))) {
    for (const row of tablePairs(record, 4, "Name")) {
      const originalName = plain(row.original[0]!);
      const name = localizedCell(row.translated[0]!, originalName);
      const thresholds = plain(row.translated[1]!).split("/").map(plain);
      result.push({ ID: `护甲:${name}:${tierAt(record.original, row.position)}`, 名称: name, 原文: originalName, 类型: "护甲", 护甲值: plain(row.translated[2]!), 重度伤害阈值: thresholds[0] ?? "", 严重伤害阈值: thresholds[1] ?? "", ...splitFeature(row.original[3]!, row.translated[3]!), 简介: "", 位阶: tierAt(record.original, row.position) });
    }
  }
  return result;
}

function extractItems(): SourceResource[] {
  const result: SourceResource[] = [];
  for (const record of records.filter((item) => /\| ROLL \| Loot \| description \|/iu.test(item.original))) {
    for (const row of tablePairs(record, 3, "ROLL")) {
      const rolls = plain(row.original[0]!).split(/\s+/u).filter((value) => /^\d+$/u.test(value));
      if (rolls.length === 0) continue;
      if (rolls.length > 1) {
        if (plain(row.original[1]!) !== "Death Tea Mirror of Marigold Stardrop") throw new Error(`${record.key}: unsupported combined loot row`);
        const originals = ["Death Tea", "Mirror of Marigold", "Stardrop"];
        const chinese = ["死亡茶", "玛丽戈尔德之镜", "星落花"];
        const descriptions = plain(row.translated[2]!).split(/(?<=[。！？])/u).filter(Boolean);
        for (let index = 0; index < 3; index += 1) result.push({ ID: `物品:${chinese[index]}`, 名称: chinese[index]!, 原文: originals[index]!, 类型: "消耗品", 掷骰: rolls[index]!, 特性描述: descriptions[index] ?? plain(row.translated[2]!), 简介: "" });
        continue;
      }
      const originalName = plain(row.original[1]!);
      const name = localizedCell(row.translated[1]!, originalName);
      result.push({ ID: `物品:${name}`, 名称: name, 原文: originalName, 类型: sectionNumber(record) === 324 ? "消耗品" : "物品", 掷骰: rolls[0]!, 特性描述: plain(row.translated[2]!), 简介: "" });
    }
  }
  return result;
}

function extractDomainCards(): SourceResource[] {
  return records.filter((record) => sectionNumber(record) >= 884 && /(Recall Cost|LEVEL \d)/iu.test(record.original)).map((record) => {
    const names = localizedHeadingPrefix(record);
    const meta = /Level\s+(\d+)\s+(.+?)\s+(Spell|Ability|Grimoire)\s*$/imu.exec(record.original);
    if (!meta) throw new Error(`${record.key}: invalid domain metadata`);
    const typeMap: Record<string, string> = { Spell: "法术", Ability: "能力", Grimoire: "术典" };
    const stripped = record.translation.replace(/^#{2,4}\s+.+\n+/u, "").replace(/^item\(\s*\n?/u, "");
    const lines = stripped.split("\n");
    const separator = lines.findIndex((line) => /^\s*-\s*$/u.test(line));
    const bodyLines = separator >= 0 ? lines.slice(separator + 1) : lines.filter((line, index) => index > 0 || !/[级,，].*回想/u.test(line));
    const mechanic = clean(stripDomainCardTail(bodyLines).join("\n"));
    return { ID: `领域卡:${domainName(plain(meta[2]!))}:${names.name}`, 名称: names.name, 原文: names.original, 类型: "领域卡", 领域: domainName(plain(meta[2]!)), 等级: meta[1]!, 属性: typeMap[meta[3]!]!, 回想: /Recall Cost:\*\*\s*(\d+)/iu.exec(record.original)?.[1] ?? "", 特性描述: mechanic, 简介: "" };
  });
}

// 领域卡翻译体的尾部会残留 ParaTranz 合并噪声：item( 的闭合 `)`、分隔符 `|`/`/`/`=`、
// `=卡牌名` 泄漏以及 `（与上文合并）`/`（与下文合并）` 标记。从末尾向前逐行剥离这些噪声。
function stripDomainCardTail(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0) {
    const line = lines[end - 1]!.trim();
    if (line === "" || line === ")" || line === "|" || line === "/" || line === "=" || /^=/.test(line) || /（与[上下]文合并）/.test(line)) {
      end -= 1;
    } else {
      break;
    }
  }
  return lines.slice(0, end);
}

function domainName(value: string): string {
  const map: Record<string, string> = { Arcana: "奥术", Blade: "利刃", Bone: "骸骨", Codex: "典籍", Dread: "恐怖", Grace: "优雅", Midnight: "午夜", Sage: "贤者", Splendor: "辉耀", Valor: "勇气" };
  return map[value] ?? value;
}

function localizedAttackWeapon(value: string): string {
  const stripped = value.replace(/\s+[A-Za-z][A-Za-z\s&'’\-]*$/u, "").trim();
  return stripped || value;
}

function statBlockIntroduction(markdown: string, stopLabels: string[]): { typeLine: string; introduction: string } {
  const lines = afterHeading(markdown).split("\n").map(clean).filter(Boolean);
  const stopPattern = new RegExp(`^(?:[*_#\\s]*)(?:${stopLabels.map(escaped).join("|")})(?:[*_\\s]*[：:]|[*_\\s]*$)`, "iu");
  const stopIndex = lines.findIndex((line, index) => index > 0 && stopPattern.test(line));
  return {
    typeLine: lines[0] ?? "",
    introduction: clean(lines.slice(1, stopIndex < 0 ? lines.length : stopIndex).join("\n")),
  };
}

function parseAdversaryAttack(translated: string): { 攻击命中: string; 攻击武器: string; 攻击范围: string; 攻击伤害: string; 攻击属性: string } {
  const attack = /(?:\*\*)?攻击[：:](?:\*\*)?\s*([^|｜]+)[|｜]\s*(?:\*\*)?([^：:*|｜]+)[：:](?:\*\*)?\s*([^|｜]+)[|｜]\s*(.+)$/imu.exec(translated);
  if (!attack) return { 攻击命中: "", 攻击武器: "", 攻击范围: "", 攻击伤害: "", 攻击属性: "" };
  const rawDamage = plain(attack[4] ?? "");
  const type = /物理\/魔法/.test(rawDamage) ? "物理/魔法" : /魔法/.test(rawDamage) ? "魔法" : "物理";
  const damage = plain(rawDamage
    .replace(/\s+经历\s*[：:].*$/u, "")
    .replace(/\s+物理\/魔法(?:伤害)?/u, "")
    .replace(/\s+(?:物理|魔法)(?:伤害)?/u, "")
    .replace(/\s+direct\b/iu, ""));
  return {
    攻击命中: plain(attack[1] ?? ""),
    攻击武器: localizedAttackWeapon(plain(attack[2] ?? "")),
    攻击范围: plain(attack[3] ?? "").replace(/范围$/u, ""),
    攻击伤害: damage,
    攻击属性: type,
  };
}

function extractAdversaries(): SourceResource[] {
  return records.filter((record) => {
    const number = sectionNumber(record);
    return ((number >= 415 && number < 680) || number === 690 || number === 691) && /^### .+\n\nTier \d/imu.test(record.original);
  }).map((record) => {
    const names = localizedName(record);
    const tier = /Tier\s+(\d+)\s+([^\n]+)/iu.exec(record.original);
    const summary = statBlockIntroduction(record.translation, ["动机与战术", "难度", "伤害阈值", "阈值", "生命点", "压力点", "压力", "攻击", "经历", "特性"]);
    const attack = parseAdversaryAttack(record.translation);
    const features = pairedTypedFeatures(record, "敌人");
    const thresholds = field(record.translation, "阈值").split("/").map(plain);
    return {
      ID: `敌人:${names.name}:${tier?.[1] ?? ""}:${names.original}`, 名称: names.name, 原文: names.original, 位阶: tier?.[1] ?? "", 种类: localizedAdversaryType(summary.typeLine, tier?.[2] ?? ""), 特性: features, 类型: "敌人",
      简介: summary.introduction, 动机与战术: field(record.translation, "动机与战术"), 难度: field(record.translation, "难度"),
      重度伤害阈值: thresholds[0] ?? "", 严重伤害阈值: thresholds[1] ?? "",
      生命点: field(record.translation, "生命点"), 压力点: field(record.translation, "压力点") || field(record.translation, "压力"), ...attack, 经历: localizedExperience(record),
    };
  });
}

function pairedTypedFeatures(record: RecordEntry, kind: "敌人" | "环境"): Array<Record<string, string>> {
  const original = record.original.split(/^#### FEATURES\s*$/imu)[1] ?? "";
  const translated = record.translation.split(/^####\s+(?:\*+)?特性(?:\*+)?(?:\s+FEATURES?)?\s*$/imu)[1] ?? "";
  const markers = [...original.matchAll(/^\*\*(.+?)\s+-\s+(Passive|Action|Reaction|Evolution):\*\*\s*/gimu)].map((match) => ({ name: plain(match[1]!), type: match[2]!, start: match.index!, bodyStart: match.index! + match[0].length }));
  const translatedMarkers = [...translated.matchAll(/^(?:[-*•]\s*)?(?:\*{1,2}|_{1,2})?(.+?)\s*(被动|动作|反应|进化|演化)(?:\s+Evolution)?(?:（[^）]+）)?(?:\*{1,2}|_{1,2})?\s*[：:]\s*/gmu)].map((match) => ({ title: plain(match[1]!), start: match.index!, bodyStart: match.index! + match[0].length }));
  if (markers.length !== translatedMarkers.length) throw new Error(`${record.key}: ${kind} feature count mismatch ${markers.length}/${translatedMarkers.length}`);
  const result: Array<Record<string, string>> = [];
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index]!;
    const translatedMarker = translatedMarkers[index]!;
    const bodyStart = translatedMarker.bodyStart;
    const bodyEnd = translatedMarkers[index + 1]?.start ?? translated.length;
    let body = clean(translated.slice(bodyStart, bodyEnd));
    let question = "";
    if (kind === "环境") {
      const parts = body.split("\n");
      const questionLines = parts.filter((line) => /？/u.test(line));
      question = clean(questionLines.join("\n"));
      body = clean(parts.filter((line) => !questionLines.includes(line)).join("\n"));
    }
    const localizedTitle = plain(translatedMarker.title.replace(/\s+[“"]?[A-Za-z][\s\S]*$/u, "").replace(/\s*[-–—]\s*$/u, ""));
    result.push({ 特性名称: localizedTitle || translatedMarker.title, 特性原文: marker.name, 特性类型: ({ Passive: "被动", Action: "动作", Reaction: "反应", Evolution: "进化" } as Record<string, string>)[marker.type]!, 特性描述: body, ...(kind === "环境" ? { 引导问题: question } : {}) });
  }
  return result;
}

function originalTypedFeatures(record: RecordEntry): Array<Record<string, string>> {
  const original = record.original.split(/^#### FEATURES\s*$/imu)[1] ?? "";
  const markers = [...original.matchAll(/^\*\*(.+?)\s+-\s+(Passive|Action|Reaction|Evolution):\*\*\s*/gimu)].map((match) => ({ name: plain(match[1]!), type: match[2]!, start: match.index!, bodyStart: match.index! + match[0].length }));
  return markers.map((marker, index) => {
    const body = clean(original.slice(marker.bodyStart, markers[index + 1]?.start ?? original.length));
    const lines = body.split("\n");
    const questions = lines.filter((line) => /\?\s*$/u.test(line));
    return { 特性名称: marker.name, 特性原文: marker.name, 特性类型: ({ Passive: "被动", Action: "动作", Reaction: "反应", Evolution: "进化" } as Record<string, string>)[marker.type]!, 特性描述: clean(lines.filter((line) => !questions.includes(line)).join("\n")), 引导问题: clean(questions.join("\n")) };
  });
}

function localizedType(line: string, englishType: string): string {
  const englishLabel = plain(englishType).split(/[\s(]/u)[0] ?? "";
  return plain(line
    .replace(/^#{1,4}\s*/u, "")
    .replace(/^\*|\*$/gu, "")
    .replace(/位阶\s*\d+/u, "")
    .replace(new RegExp(escaped(englishType), "iu"), "")
    .replace(englishLabel ? new RegExp(`\\b${escaped(englishLabel)}\\b`, "iu") : /$^/u, ""));
}

function localizedAdversaryType(line: string, englishType: string): string {
  const horde = /^Horde\s*\((\d+)\s*\/\s*HP\)$/iu.exec(plain(englishType));
  return horde ? `集群(${horde[1]}/生命点)` : localizedType(line, englishType);
}

function extractEnvironments(): SourceResource[] {
  return records.filter((record) => sectionNumber(record) >= 697 && sectionNumber(record) < 760 && /^### .+\n\nTier \d/imu.test(record.original)).map((record) => {
    const names = localizedName(record);
    const tier = /Tier\s+(\d+)\s+([^\n]+)/iu.exec(record.original);
    const summary = statBlockIntroduction(record.translation, ["趋向", "难度", "潜在敌人", "特性"]);
    return { ID: `环境:${names.name}`, 名称: names.name, 原文: names.original, 类型: "环境", 位阶: tier?.[1] ?? "", 种类: localizedType(summary.typeLine, tier?.[2] ?? ""), 简介: summary.introduction, 趋向: field(record.translation, "趋向"), 难度: field(record.translation, "难度"), 潜在敌人: field(record.translation, "潜在敌人"), 特性: pairedTypedFeatures(record, "环境") };
  });
}
