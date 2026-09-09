import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { computeResourcePackageSnapshotDigest, loadPbres, writePbres } from "../packages/contract-runtime/src/index.ts";
import { validateResourcePackageCandidate } from "../apps/player/src/resources/resource-package-validator.ts";
import { namedFeatures } from "../packages/resource-conversion/src/shared.ts";

const source = process.argv[2];
if (!source) throw new Error("请传入只读 PbDH_sheet 仓库路径。");
const baseline = "0e44fa69b12209c172e4189e273615ba3a4d07a6";
const revision = "fe1de3f";
const root = "apps/player/public/system-packages/tttri";
const sourcePath = "public/system-packages/tttri";
const readSource = (file: string, commit = revision) => execFileSync("git", ["-C", source, "show", `${commit}:${sourcePath}/${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }).replace(/\r\n/g, "\n");

// 只复制已核对无平台差异的文件；资源库与模块使用增量映射。
for (const file of ["adapters/scripts/character-import.js", "adapters/scripts/character-export.js", "checks/character-consistency.js", "guides/character-creation.json", "layouts/base.css", "questionnaires/subclass-recommendation.html"]) {
  await writeFile(path.join(root, file), readSource(file));
}
type Row = Record<string, any>;
const sourceModules = JSON.parse(readSource("modules.json")) as Row[];
const modulePath = path.join(root, "modules.json");
let modules = await readFile(modulePath, "utf8");
const parsedModules = JSON.parse(modules) as Row[];
for (const target of parsedModules.filter((module) => module.ID.startsWith("advancement-tier-"))) {
  const next = sourceModules.find((module) => module.ID === target.ID)!;
  if (next.内容) {
    modules = modules.replace(JSON.stringify(target.内容), JSON.stringify(next.内容));
  } else {
    const index = modules.indexOf(`"ID": "${target.ID}"`);
    const start = modules.indexOf("[", index);
    const end = modules.indexOf("]", start);
    modules = modules.slice(0, start) + "[\n" + next.选项.map((option: Row) => `      { ${Object.entries(option).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(", ")} }`).join(",\n") + "\n    " + modules.slice(end);
  }
}
JSON.parse(modules);
await writeFile(modulePath, modules);

const file = path.join(root, "resources/tttri.pbres");
const loaded = await loadPbres(new Uint8Array(await readFile(file)), validateResourcePackageCandidate);
if (!loaded.candidate) throw new Error(JSON.stringify(loaded.diagnostics));
const { document, media } = loaded.candidate;
const previous = new Map<string, Row>((JSON.parse(readSource("resources/subclasses.json", baseline)) as Row[]).map((row) => [row.ID, row]));
const current = JSON.parse(readSource("resources/subclasses.json")) as Row[];
const stageFeatures = (row: Row) => String(row.子职提升).split(/\n\n(?=(?:职业|子职|希望)特性)/u)
  .flatMap((section) => namedFeatures(section.replace(/^(?:职业|子职|希望)特性[^：:]*[：:]\s*/u, "")));
let added = 0;
let updated = 0;
for (const row of current) {
  const before = previous.get(row.ID);
  const existing = document.resources.find((resource) => resource.id === row.ID);
  if (!before) {
    if (existing) continue;
    const { ID, ...fields } = row;
    document.resources.push({
      id: ID, path: `干员/${row.主职}/${row.名称}/${row.阶段}.json`, template: { id: "子职业", version: "1.0.1" },
      presentation: { mode: "text", fixedRatio: true }, media: {},
      attribution: { artworkCredit: "", sourceLabel: document.package.name },
      data: { ...fields, 原文: "", 简介: "", 施法属性: "", 特性: stageFeatures(row) },
    });
    added += 1;
    continue;
  }
  if (!existing) throw new Error(`缺少已迁移资源 ${row.ID}`);
  const changed = Object.keys(row).filter((key) => key !== "ID" && JSON.stringify(row[key]) !== JSON.stringify(before[key]));
  if (!changed.length) continue;
  const data = existing.data as Row;
  for (const key of changed) {
    if (key === "子职提升") data.特性 = stageFeatures(row);
    data[key] = row[key];
  }
  updated += 1;
}
document.package.version = "2.1.0";
const systemFile = path.join(root, "system.json");
const system = JSON.parse(await readFile(systemFile, "utf8"));
system.package.version = "1.1.0";
system.runtime.characterDataVersion = "1.1.0";
system.runtime.characterDataMigrations = [{ fromVersion: "1.0.6", toVersion: "1.1.0", script: "adapters/scripts/upgrade-advancement.js" }];
for (const target of document.targets) if (target.systemPackageId === system.package.id) target.version = "1.1.0";
document.snapshotDigest = await computeResourcePackageSnapshotDigest(document, media);
const diagnostics = await validateResourcePackageCandidate(document, media);
if (diagnostics.length) throw new Error(JSON.stringify(diagnostics));
const bytes = writePbres(document, media);
const checked = await loadPbres(bytes, validateResourcePackageCandidate);
if (!checked.candidate) throw new Error(JSON.stringify(checked.diagnostics));
await writeFile(file, bytes);
await writeFile(systemFile, `${JSON.stringify(system, null, 2)}\n`);
const presetFile = "apps/player/src/tttri-preset.generated.json";
const preset = JSON.parse(await readFile(presetFile, "utf8"));
for (const entry of preset.embeddedResourceIndex) if (entry.packageId === document.package.id) entry.snapshotDigest = document.snapshotDigest;
await writeFile(presetFile, `${JSON.stringify(preset, null, 2)}\n`);
console.log(JSON.stringify({ added, updated, resources: document.resources.length, media: media.size, bytes: bytes.length }));
