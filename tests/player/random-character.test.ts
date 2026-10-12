import "fake-indexeddb/auto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadPbres, type SystemPackageDocument } from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import systemJson from "../../apps/player/src/daggerheart-core-system.generated.json";
import { CharacterSaveRepository } from "../../apps/player/src/character-saves/character-save-repository.ts";
import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";
import type { ResourceLibrary } from "../../apps/player/src/resources/resource-library.ts";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { generateDaggerheartCharacter } from "../../apps/player/src/sheet-runtime/domain/daggerheartRandomCharacter.ts";
import { runValidationChecks } from "../../apps/player/src/sheet-runtime/domain/validationRunner.ts";
import { executePackageScriptInContext } from "../../apps/player/src/sheet-runtime/domain/packageScript.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { daggerheartCorePreset, loadDaggerheartCoreRuntimePackage } from "../../apps/player/src/sheet-runtime/loaders/daggerheartCoreRuntimeLoader.ts";
import { sheetCharacterToSave, characterSaveToSheet } from "../../apps/player/src/sheet-runtime/storage/characterSaveAdapter.ts";
import { unconfiguredRuntimeStorage, type CharacterSaveRecord } from "../../apps/player/src/sheet-runtime/storage/runtimeStorage.ts";
import { configureRuntimeEnvironment, createRuntimeEnvironment } from "../../apps/player/src/sheet-runtime/store/runtimeEnvironment.ts";
import { createRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";
import { playerSystemPackageCatalog } from "../../apps/player/src/playerSystemPackageCatalog.ts";

const root = path.resolve("apps/player/public/system-packages/daggerheart-core");
const system = systemJson as SystemPackageDocument;
const coreIds = new Set(daggerheartCorePreset.embeddedResourceIndex.map(entry => entry.packageId));
let runtimePackage: SystemPackage;
let installedPackages: ResourceLibrary;

beforeAll(async () => {
  const installed = new Map();
  installedPackages = installed;
  for (const embedded of system.embeddedResources) {
    const archive = await loadPbres(new Uint8Array(await readFile(path.join(root, embedded.path))), validateResourcePackageCandidate);
    if (!archive.candidate) throw new Error(JSON.stringify(archive.diagnostics));
    installed.set(archive.candidate.document.package.id, {
      ...archive.candidate, routes: routeResourcePackage({ currentSystem: system, resourcePackage: archive.candidate.document }),
    });
  }
  const loaded = await loadDaggerheartCoreRuntimePackage({ currentSystem: system, installedPackages,
    fetchFile: async url => {
      const pathname = new URL(String(url), "https://preset.invalid").pathname;
      const relative = decodeURIComponent(pathname.split("/system-packages/daggerheart-core/")[1]!);
      return new Response(await readFile(path.join(root, relative)));
    },
  });
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
  runtimePackage = loaded.package;
});

const entries = (id: string) => runtimePackage.resourceLibraries!.find(library => library.ID === id)!.entries;
const audit = (data: ReturnType<typeof generateDaggerheartCharacter>["data"]) => runValidationChecks({
  characterData: data, resourceLibraries: runtimePackage.resourceLibraries!, cardState: data.cards,
  packageMetadata: { id: system.package.id, version: system.package.version }, checks: runtimePackage.validationChecks!,
});
function draw(indices: number[], sizes: number[]) {
  let cursor = 0;
  return () => { const index = cursor++; return (indices[index]! + 0.5) / sizes[index]!; };
}

describe("Daggerheart 完全随机", () => {
  it.each(["吟游诗人", "德鲁伊", "守护者", "游侠", "游荡者", "神使", "术士", "战士", "法师"])(
    "%s：每个种族、基础子职及1级领域卡组合都通过真实审核", async name => {
      const classes = entries("classes");
      const classIndex = classes.findIndex(entry => entry.fields.名称 === name);
      const subclasses = entries("subclasses").filter(entry => entry.fields.主职 === name && entry.fields.等级 === "基础");
      const domains = classes[classIndex]!.resourceCopy!.data.领域 as string[];
      const pool = entries("domain-cards").filter(entry => entry.fields.等级 === "1" && domains.includes(entry.fields.领域!));
      let count = 0;
      for (let ancestry = 0; ancestry < entries("ancestries").length; ancestry += 1) {
        for (let subclass = 0; subclass < subclasses.length; subclass += 1) {
          const cards = subclasses[subclass]!.fields.名称 === "知识学派" ? 3 : 2;
          for (let first = 0; first < pool.length; first += 1) for (let second = first + 1; second < pool.length; second += 1) {
            const thirds = cards === 3 ? Array.from({ length: pool.length - second - 1 }, (_, index) => second + index + 1) : [-1];
            for (const third of thirds) {
              const generated = generateDaggerheartCharacter(runtimePackage, coreIds, draw(
                [ancestry, count % entries("communities").length, classIndex, subclass, first, second - 1, third - 2],
                [entries("ancestries").length, entries("communities").length, classes.length, subclasses.length, pool.length, pool.length - 1, pool.length - 2],
              ));
              expect(await executePackageScriptInContext(runtimePackage.validationChecks![0]!.scriptContent,
                { characterData: generated.data, resourceLibraries: runtimePackage.resourceLibraries }, "核心审核"),
                `${name}/${entries("ancestries")[ancestry]!.fields.名称}/${subclasses[subclass]!.fields.名称}/${first},${second},${third}`).toEqual([]);
              expect(generated.data.character.values).toMatchObject({
                "experience-1": "一条战斗相关经历",
                "experience-modifier-1": entries("ancestries")[ancestry]!.fields.名称 === "械灵" ? "3" : "2",
                "experience-2": "一条非战斗相关经历", "experience-modifier-2": "2",
              });
              expect(generated.data.character.values.level).toBe("1");
              expect(generated.data.cards.instances).toHaveLength(cards + 3);
              const refs = generated.data.cards.instances.filter(card => card.definitionRef?.type === "resourceLibrary" && card.definitionRef.libraryId === "domain-cards")
                .map(card => card.definitionRef!.type === "resourceLibrary" ? card.definitionRef.entryId : "");
              expect(new Set(refs).size).toBe(cards);
              count += 1;
            }
          }
        }
      }
      expect(count).toBeGreaterThan(0);
    },
  );

  it("只有 daggerheart-core 注册生成器，资源缺失时明确失败", () => {
    expect(playerSystemPackageCatalog.filter(entry => entry.randomCharacterGenerator).map(entry => entry.preset.directory)).toEqual(["daggerheart-core"]);
    expect(() => generateDaggerheartCharacter({ ...runtimePackage, resourceLibraries: [] }, coreIds)).toThrow("种族资源不可用");
    expect(() => generateDaggerheartCharacter(runtimePackage, coreIds, () => 1)).toThrow("随机数");
  });

  it("新角色经正式 Repository 保存、重开后仍通过审核并保留经历占位名称", async () => {
    const generated = generateDaggerheartCharacter(runtimePackage, coreIds, () => 0);
    const candidate = await sheetCharacterToSave({ name: generated.name, data: generated.data, currentSystem: { ...system.package, resourceCompatibility: system.resourceCompatibility },
      sheetSystemPackage: runtimePackage, installedPackages });
    const database = new PbDHLocalDatabase(`pbdh-random-character-test-${crypto.randomUUID()}`);
    const repository = new CharacterSaveRepository(new DexieLocalDocumentStore(database));
    const saved = await repository.save(candidate.document, candidate.media);
    const reopened = await repository.get(saved.document.documentId);
    expect(reopened).not.toBeNull();
    const restored = characterSaveToSheet({ candidate: reopened!, currentSystem: system,
      sheetSystemPackage: runtimePackage, installedPackages: new Map(), mediaUrl: () => "" });
    expect(restored.cards.instances).toHaveLength(generated.data.cards.instances.length);
    expect(restored.character.values).toMatchObject({ "experience-1": "一条战斗相关经历", "experience-2": "一条非战斗相关经历" });
    expect(await audit(restored)).toEqual([]);
    database.close();
  });

  it("公共创建流程审核成功后才写入，失败不覆盖原人物", async () => {
    const generated = generateDaggerheartCharacter(runtimePackage, coreIds, () => 0);
    const original = createEmptyCharacterData(runtimePackage);
    const records: CharacterSaveRecord[] = [];
    const saveCharacterSave = vi.fn(async (record: CharacterSaveRecord) => { records.push(record); });
    const checks = vi.fn(runValidationChecks);
    const environment = createRuntimeEnvironment();
    configureRuntimeEnvironment(environment, { runValidationChecks: checks, storage: {
      ...unconfiguredRuntimeStorage, saveCharacterSave, setActiveCharacterSaveId: vi.fn(async () => undefined),
      listCharacterSaves: async () => [],
      listAllCharacterSaves: async () => [],
    } });
    const runtime = createRuntimeStore(environment);
    runtime.setState({ currentPackage: runtimePackage, characterData: original, activeCharacterSaveId: original.character.id });
    const invalid = structuredClone(generated);
    invalid.data.character.values.agility = "99";
    await runtime.getState().createGeneratedCharacterSave(() => invalid);
    expect(saveCharacterSave).not.toHaveBeenCalled();
    expect(runtime.getState().characterData).toBe(original);
    expect(runtime.getState().importError).toContain("未通过车卡审核");
    await runtime.getState().createGeneratedCharacterSave(() => generated);
    expect(checks).toHaveBeenCalledTimes(2);
    expect(records.some(record => record.id === generated.data.character.id)).toBe(true);
    expect(runtime.getState().activeCharacterSaveId).toBe(generated.data.character.id);
    expect(runtime.getState().validationStatus).toBe("complete");
    expect(runtime.getState().validationIssues).toEqual([]);
    expect(runtime.getState().pendingCardTablePlacements["character-card-table"]).toHaveLength(generated.data.cards.instances.length);
  });
});
