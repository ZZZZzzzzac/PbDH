function normalize(value) { return value === undefined || value === null ? "" : String(value).normalize("NFKC").trim(); }
function convert(value, kind) {
  if (value === undefined || value === null) return undefined;
  if (kind === "number") { const number = Number(value); return Number.isFinite(number) ? number : undefined; }
  if (kind === "domainLevel" || kind === "recall") {
    const text = normalize(value); if (!text) return undefined;
    const suffix = kind === "domainLevel" ? "级" : "⚡";
    return text.endsWith(suffix) ? text : `${text}${suffix}`;
  }
  return value;
}
function mapping(type) {
  const common = {
    主职: ["classes", [["名称", "名称"], ["描述", "简介"], ["领域", "领域"], ["闪避值", "初始闪避值", "number"], ["生命点", "初始生命点", "number"], ["希望特性", "希望特性"], ["职业特性", "职业特性"], ["背景问题", "背景问题"], ["关系问题", "关系问题"]]],
    子职: ["subclasses", [["名称", "名称"], ["主职", "主职"], ["等级", "等级"], ["施法属性", "施法属性"], ["描述", "描述"]]],
    社群: ["communities", [["名称", "名称"], ["简介", "简介"], ["性格", "性格"], ["描述", "描述"]]],
    领域卡: ["domain-cards", [["名称", "名称"], ["领域", "领域"], ["等级", "等级", "domainLevel"], ["属性", "属性"], ["回想", "回想", "recall"], ["描述", "描述"]]],
  };
  return common[type];
}
function dhMapping(type) {
  const result = mapping(type);
  if (!result) return result;
  const fields = result[1].map((item) => item.slice());
  if (type === "主职") fields.forEach((item) => { if (item[0] === "闪避值") item[1] = "起始闪避"; if (item[0] === "生命点") item[1] = "起始生命"; });
  if (type === "子职") fields.forEach((item) => { if (item[0] === "施法属性") item[1] = "施法"; });
  return [result[0], fields];
}
function addLibrary(map, id, name, entry) { const library = map.get(id) || { ID: id, 名称: name, entries: [] }; library.entries.push(entry); map.set(id, library); }
function convertedEntry(record, fields, fallbackId, counts) {
  const entry = { ID: normalize(record.原名 || record.id) || fallbackId };
  for (const [target, source, kind] of fields) { const value = convert(record[source], kind); if (value === undefined) counts.skippedFields += 1; else { entry[target] = value; counts.convertedFields += 1; } }
  return entry;
}
function hasFeatureHeading(value) {
  const text = value === undefined || value === null ? "" : String(value).trim();
  const colon = text.search(/[:：]/u); const sentence = text.search(/[。！？.!?\n]/u);
  return colon > 0 && colon <= 80 && (sentence < 0 || colon < sentence);
}
function convertedZzzAncestry(record, fallbackId, counts) {
  const name = normalize(record.名称);
  const explicitIntro = record.简介 === undefined || record.简介 === null ? "" : String(record.简介).trim();
  const description = record.描述 === undefined || record.描述 === null ? "" : String(record.描述).trim();
  const parts = description.split(/\r?\n\s*\r?\n/u).map((item) => item.trim()).filter(Boolean);
  const explicitFeatures = [record.特性A, record.特性B];
  let intro = explicitIntro; let features;
  if (explicitFeatures.every((value) => value !== undefined && value !== null && normalize(value) !== "")) features = explicitFeatures;
  else if (explicitFeatures.some((value) => value !== undefined && value !== null && normalize(value) !== "")) return undefined;
  else if (explicitIntro && parts.length === 2 && parts.every(hasFeatureHeading)) features = parts;
  else if (!explicitIntro && parts.length === 2 && parts.every(hasFeatureHeading)) features = parts;
  else if (!explicitIntro && parts.length === 3 && !hasFeatureHeading(parts[0]) && parts.slice(1).every(hasFeatureHeading)) { intro = parts[0]; features = parts.slice(1); }
  else return undefined;
  const entry = { ID: normalize(record.原名 || record.id) || (name ? `种族:${name}` : fallbackId), 名称: name, 类型: "种族" };
  counts.convertedFields += 2;
  if (intro) { entry.简介 = intro; counts.convertedFields += 1; } else counts.skippedFields += 1;
  for (const [index, value] of features.entries()) {
    if (value === undefined || value === null || normalize(value) === "") counts.skippedFields += 1;
    else { entry[index === 0 ? "特性A" : "特性B"] = value; counts.convertedFields += 1; }
  }
  return entry;
}
function importZzz(input) {
  const records = Array.isArray(input.document) ? input.document : [];
  const libraries = new Map(); const diagnostics = [];
  const counts = { sourceEntries: records.length, convertedEntries: 0, skippedEntries: 0, convertedFields: 0, skippedFields: 0, boundImages: 0, orphanImages: 0 };
  records.forEach((record, index) => {
    if (!record || typeof record !== "object") { counts.skippedEntries += 1; return; }
    const type = normalize(record.类型); const known = mapping(type);
    let entry; let libraryId; let libraryName;
    const ancestry = type === "种族" ? convertedZzzAncestry(record, `external:zzz:${index}`, counts) : undefined;
    if (ancestry) { libraryId = "ancestries"; libraryName = input.resourceLibraries.find((item) => item.ID === libraryId)?.名称 || type; entry = ancestry; }
    else if (known) { libraryId = known[0]; libraryName = input.resourceLibraries.find((item) => item.ID === libraryId)?.名称 || type; entry = convertedEntry(record, known[1], `external:zzz:${index}`, counts); }
    else { libraryId = `外部类型:${type}`; libraryName = type; entry = { ID: normalize(record.原名) || `external:zzz:${index}` }; Object.entries(record).forEach(([key, value]) => { if (!["原名", "imageUrl", "hasLocalImage", "localId"].includes(key)) { entry[key] = value; counts.convertedFields += 1; } }); if (type === "种族") diagnostics.push({ level: "warning", code: "RESOURCE_ADAPTER_ANCESTRY_AMBIGUOUS", text: `种族「${normalize(record.名称) || index + 1}」无法可靠拆分为两个特性，已保留为其他资源。` }); }
    if (!normalize(entry.名称)) { counts.skippedEntries += 1; diagnostics.push({ level: "warning", code: "RESOURCE_ADAPTER_ENTRY_NAME_MISSING", text: `记录 ${index + 1} 转换后缺少名称，已跳过。` }); return; }
    addLibrary(libraries, libraryId, libraryName, entry); counts.convertedEntries += 1;
  });
  return { name: input.fileName.replace(/\.[^.]+$/u, ""), version: "未声明", resourceLibraries: [...libraries.values()], diagnostics, retainedAssets: [], counts };
}
function importDh(input) {
  const document = input.document || {}; const cards = document.cards || {}; const records = [];
  [["profession", "主职"], ["ancestry", "种族"], ["community", "社群"], ["subclass", "子职"], ["domain", "领域卡"], ["variant", "变体"]].forEach(([key, type]) => { if (Array.isArray(cards[key])) cards[key].forEach((record) => records.push({ record, type })); });
  const libraries = new Map(); const diagnostics = []; const retainedAssets = [];
  const counts = { sourceEntries: records.length, convertedEntries: 0, skippedEntries: 0, convertedFields: 0, skippedFields: 0, boundImages: 0, orphanImages: 0 };
  const ancestry = new Map();
  records.forEach(({ record, type }, index) => {
    if (!record || typeof record !== "object") { counts.skippedEntries += 1; return; }
    if (type === "种族") { const key = normalize(record.ancestryName); const group = ancestry.get(key) || []; group.push({ record, index }); ancestry.set(key, group); return; }
    const known = dhMapping(type); let entry; let libraryId; let libraryName;
    if (known) { libraryId = known[0]; libraryName = input.resourceLibraries.find((item) => item.ID === libraryId)?.名称 || type; entry = convertedEntry(record, known[1], `external:dhsheet:${index}`, counts); }
    else { libraryId = `外部类型:${type}`; libraryName = type; entry = { ID: normalize(record.id) || `external:dhsheet:${index}` }; Object.entries(record).forEach(([key, value]) => { if (!["id", "imageUrl", "hasLocalImage", "localId"].includes(key)) { entry[key] = value; counts.convertedFields += 1; } }); }
    if (!normalize(entry.名称)) { counts.skippedEntries += 1; return; }
    addLibrary(libraries, libraryId, libraryName, entry); counts.convertedEntries += 1;
  });
  for (const [name, group] of ancestry) {
    const slots = new Map(); group.forEach(({ record }) => { const slot = Number(record.category) === 1 ? "A" : Number(record.category) === 2 ? "B" : ""; const list = slots.get(slot) || []; list.push(record); slots.set(slot, list); });
    if (!name || [...slots.values()].some((items) => items.length > 1)) { counts.skippedEntries += group.length; diagnostics.push({ level: "warning", code: "RESOURCE_ADAPTER_GROUP_AMBIGUOUS", text: `种族分组 ${name || "（无名称）"} 无法唯一配对，已跳过。` }); continue; }
    const first = group[0].record; const entry = { ID: normalize(first.id) || `external:ancestry:${name}`, 名称: name, 简介: first.hint };
    if (slots.get("A")?.[0]) entry.特性A = slots.get("A")[0].description; else counts.skippedFields += 1;
    if (slots.get("B")?.[0]) entry.特性B = slots.get("B")[0].description; else counts.skippedFields += 1;
    counts.convertedFields += 1 + (entry.特性A !== undefined ? 1 : 0) + (entry.特性B !== undefined ? 1 : 0);
    addLibrary(libraries, "ancestries", input.resourceLibraries.find((item) => item.ID === "ancestries")?.名称 || "种族", entry); counts.convertedEntries += 1;
  }
  return { name: normalize(document.manifest && document.manifest.name) || input.fileName.replace(/\.[^.]+$/u, ""), version: normalize(document.manifest && document.manifest.version) || "未声明", resourceLibraries: [...libraries.values()], diagnostics, retainedAssets, counts };
}
module.exports = function (input) { return Array.isArray(input.document) ? importZzz(input) : importDh(input); };
