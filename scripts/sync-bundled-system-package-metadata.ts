import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SystemPackageDocument } from "../packages/contract-runtime/src/index.ts";
import type { PresetSystemPackage } from "../apps/player/src/sheet-runtime/loaders/presetSystemPackageLoader.ts";

const runtimeInventoryName = ".pbdh-runtime-files.json";
const checkOnly = process.argv.includes("--check");
const directories = ["heart-of-hopefind", "witchy", "hows-my-driving", "tttri"] as const;

for (const directory of directories) await syncPackage(directory);

async function syncPackage(directory: typeof directories[number]) {
  const publicRoot = path.resolve("apps/player/public/system-packages", directory);
  const systemPath = path.join(publicRoot, "system.json");
  const generatedSystemPath = path.resolve("apps/player/src", `${directory}-system.generated.json`);
  const generatedPresetPath = path.resolve("apps/player/src", `${directory}-preset.generated.json`);
  const inventoryPath = path.join(publicRoot, runtimeInventoryName);

  const system = JSON.parse(await readFile(systemPath, "utf8")) as SystemPackageDocument;
  const existingPreset = JSON.parse(await readFile(generatedPresetPath, "utf8")) as PresetSystemPackage;
  if (!system.embeddedResources.some((embedded) => embedded.path === `resources/${directory}.pbres`)) {
    throw new Error(`${directory}/system.json 未引用对应的内嵌 PBRES。`);
  }

  const runtimeFiles = [...await collectPublishedRuntimePaths(publicRoot), "system.json"].sort();
  const systemJson = `${JSON.stringify(system, null, 2)}\n`;
  const inventoryJson = `${JSON.stringify({ schemaVersion: 1, files: runtimeFiles })}\n`;
  const presetJson = `${JSON.stringify({
    ...existingPreset,
    id: system.package.id,
    name: system.package.name,
    version: system.package.version,
    directory,
    inventoryPath: runtimeInventoryName,
    fileCount: runtimeFiles.length,
    metadataFileCount: runtimeFiles.filter((file) => !file.startsWith("assets/")).length,
    embeddedResourceIndex: existingPreset.embeddedResourceIndex.map(({ path, packageId }) => ({ path, packageId })),
  }, null, 2)}\n`;

  await syncText(generatedSystemPath, systemJson);
  await syncText(inventoryPath, inventoryJson);
  await syncText(generatedPresetPath, presetJson);
  console.log(`${checkOnly ? "checked" : "synced"}: ${directory}@${system.package.version}`);
}

async function syncText(filePath: string, expected: string) {
  const actual = await readFile(filePath, "utf8").catch(() => "");
  if (actual === expected) return;
  if (checkOnly) throw new Error(`派生元数据未同步：${path.relative(process.cwd(), filePath)}`);
  await writeFile(filePath, expected, "utf8");
}

async function collectPublishedRuntimePaths(sourceDirectory: string, relative = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relative, entry.name);
    if (relativePath === "resources" || relativePath.startsWith("resources/")) continue;
    if (relativePath === "system.json" || relativePath === runtimeInventoryName) continue;
    if (entry.isDirectory()) files.push(...await collectPublishedRuntimePaths(path.join(sourceDirectory, entry.name), relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}
