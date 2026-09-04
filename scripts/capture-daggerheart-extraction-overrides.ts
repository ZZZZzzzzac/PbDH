import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceResource = Record<string, unknown> & { ID: string; 原文: string };
type PackagedResource = { id: string; template: { id: string }; data: Record<string, unknown> };
type ExtractionOverride = {
  kind: string;
  original: string;
  fields: Array<{ field: string; expected: unknown; value: unknown }>;
};
type FeatureNameOverride = {
  kind: string;
  featureOriginal: string;
  value: string;
  changes: Array<{ resourceOriginal: string; expected: string }>;
};
type FeatureDescriptionOverride = {
  kind: string;
  featureOriginal: string;
  value?: string;
  changes: Array<{ resourceOriginal: string; expected: string; value?: string }>;
};
type ParameterizedFeatureNameOverride = {
  kind: string;
  baseOriginal: string;
  baseName: string;
  expected: Record<string, Record<string, number>>;
};

const sourceRoot = path.resolve("apps/player/system-package-sources/daggerheart-core");
const packageDocument = JSON.parse(await readFile(
  path.join(sourceRoot, "daggerheart-core-gm.resource-package.json"),
  "utf8",
)) as { resources: PackagedResource[] };
const definitions = [["adversaries", "敌人"], ["environments", "环境"]] as const;
const overridePath = path.join(sourceRoot, "extraction-overrides.json");
const existing = JSON.parse(await readFile(overridePath, "utf8")) as {
  schemaVersion: number;
  overrides: ExtractionOverride[];
  featureNameOverrides: FeatureNameOverride[];
  featureDescriptionOverrides: FeatureDescriptionOverride[];
  parameterizedFeatureNameOverrides: ParameterizedFeatureNameOverride[];
};
const overrides = structuredClone(existing.overrides);

for (const [kind, templateId] of definitions) {
  const source = JSON.parse(await readFile(path.join(sourceRoot, "resources", `${kind}.json`), "utf8")) as SourceResource[];
  const packagedById = new Map(packageDocument.resources
    .filter((resource) => resource.template.id === templateId)
    .map((resource) => [resource.id, resource]));
  for (const entry of source) {
    const packaged = packagedById.get(entry.ID);
    if (!packaged) throw new Error(`GM 审阅 JSON 缺少 ${kind}/${entry.ID}`);
    const { ID: _id, 卡图: _portrait, 卡背: _back, ...sourceData } = entry;
    const changedFields = [...new Set([...Object.keys(sourceData), ...Object.keys(packaged.data)])]
      .filter((field) => JSON.stringify(sourceData[field]) !== JSON.stringify(packaged.data[field]));
    if (changedFields.length === 0) continue;
    let override = overrides.find((candidate) => candidate.kind === kind && candidate.original === entry.原文);
    if (!override) {
      override = { kind, original: entry.原文, fields: [] };
      overrides.push(override);
    }
    for (const field of changedFields) {
      const previous = override.fields.find((candidate) => candidate.field === field);
      if (previous) previous.value = packaged.data[field];
      else override.fields.push({ field, expected: sourceData[field], value: packaged.data[field] });
    }
  }
}

if (!process.argv.includes("--accept")) {
  console.log(JSON.stringify(overrides.map((override) => ({
    kind: override.kind,
    original: override.original,
    fields: override.fields.map((field) => field.field),
  })), null, 2));
  throw new Error("仅完成差异预览；追加 --accept 才会保存提取覆盖。\n");
}

await writeFile(
  overridePath,
  `${JSON.stringify({
    schemaVersion: existing.schemaVersion,
    overrides,
    featureNameOverrides: existing.featureNameOverrides,
    featureDescriptionOverrides: existing.featureDescriptionOverrides,
    parameterizedFeatureNameOverrides: existing.parameterizedFeatureNameOverrides,
  }, null, 2)}\n`,
  "utf8",
);
console.log(`Captured ${overrides.length} reviewed GM resource overrides.`);
