import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadPbcha, loadPbres, writePbcha } from "@pbdh/contract-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test } from "vitest";
import { playerSystemPackageCatalog } from "../../apps/player/src/playerSystemPackageCatalog.ts";
import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";
import { createEmptyCharacterData, type CharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { applyResourceSelectionToDraft } from "../../apps/player/src/sheet-runtime/domain/resourceSelection.ts";
import { runValidationChecks } from "../../apps/player/src/sheet-runtime/domain/validationRunner.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { ValidationIssueDialog } from "../../apps/player/src/sheet-runtime/rendering/app/AppDiagnostics.tsx";
import { validateCharacterSaveCandidate } from "../../apps/player/src/character-saves/character-save-validator.ts";
import { characterSaveToSheet, sheetCharacterToSave } from "../../apps/player/src/sheet-runtime/storage/characterSaveAdapter.ts";

let system: SystemPackage;
let coreSystem: SystemPackage;
async function loadSystem(resourcePaths: string[]) {
  const catalog = playerSystemPackageCatalog.find((entry) => entry.preset.directory === "daggerheart-core")!;
  const root = path.resolve("apps/player/public/system-packages/daggerheart-core");
  const installedPackages = new Map();
  for (const resourcePath of resourcePaths) {
    const loaded = await loadPbres(new Uint8Array(await readFile(resourcePath)), validateResourcePackageCandidate);
    if (!loaded.candidate) throw new Error(JSON.stringify(loaded.diagnostics));
    installedPackages.set(loaded.candidate.document.package.id, {
      ...loaded.candidate,
      routes: routeResourcePackage({ currentSystem: catalog.system, resourcePackage: loaded.candidate.document }),
    });
  }
  const loaded = await catalog.load({ currentSystem: catalog.system, installedPackages, baseUrl: "/", fetchFile: async (url) => {
    const pathname = new URL(String(url), "https://preset.invalid").pathname;
    const relative = decodeURIComponent(pathname.split("/system-packages/daggerheart-core/")[1]!);
    return new Response(await readFile(path.join(root, relative)));
  } });
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
  return loaded.package;
}
beforeAll(async () => {
  coreSystem = await loadSystem(["docs/third/daggerheart-core-book.pbres"]);
  system = await loadSystem(["docs/third/daggerheart-core-book.pbres", "docs/third/daggerheart-hope-and-fear.pbres"]);
}, 60000);

const traits = ["agility", "strength", "finesse", "instinct", "presence", "knowledge"];
const baseTraits = [2, 1, 1, 0, 0, -1];
function entry(libraryId: string, name: string, currentSystem = system) {
  const result = currentSystem.resourceLibraries!.find((library) => library.ID === libraryId)!.entries.find((item) => item.fields.名称 === name);
  if (!result) throw new Error(`Missing ${libraryId}/${name}`);
  return result;
}
function select(data: CharacterData, moduleId: string, libraryId: string, name: string, currentSystem = system) {
  return applyResourceSelectionToDraft(data, currentSystem, moduleId, libraryId, [entry(libraryId, name, currentSystem)]).characterData;
}
async function audit(data: CharacterData, currentSystem = system) {
  return (await runValidationChecks({ characterData: data, resourceLibraries: currentSystem.resourceLibraries!, cardState: data.cards,
    packageMetadata: { id: currentSystem.manifest.ID, version: currentSystem.manifest.版本 }, checks: currentSystem.validationChecks!,
  })).map((issue) => issue.code);
}

describe("Daggerheart equipment audit through native resource application", () => {
  function equippedCharacter(armorName: string, currentSystem = system) {
    let data = select(createEmptyCharacterData(currentSystem), "pick-class", "classes", "战士", currentSystem);
    data = select(data, "pick-armor", "armor", armorName, currentSystem);
    const values = data.character.values;
    values.level = "1";
    traits.forEach((trait, index) => { values[trait] = String(baseTraits[index]); });
    values.evasion = String(Number(entry("classes", "战士", currentSystem).fields.闪避值));
    const armor = entry("armor", armorName, currentSystem).fields;
    values["armor-value"] = String(armor.护甲值);
    values["armor-slots"] = { current: 0, max: Number(armor.护甲值) };
    values["major-threshold"] = String(Number(armor.重度阈值) + 1);
    values["severe-threshold"] = String(Number(armor.严重阈值) + 1);
    return data;
  }

  test("core-only libraries do not apply absent expansion equipment modifiers", async () => {
    expect(coreSystem.resourceLibraries!.find((library) => library.ID === "armor")!.entries.some((item) => item.fields.名称 === "鳞甲")).toBe(false);
    const data = equippedCharacter("皮甲", coreSystem);
    const equipmentCodes = ["EQUIPMENT_RESOURCE_UNRESOLVED", "VALIDATION_SCRIPT_ERROR", "TRAIT_DISTRIBUTION_MISMATCH", "EVASION_MISMATCH", "ARMOR_MAX_MISMATCH", "MAJOR_THRESHOLD_MISMATCH", "SEVERE_THRESHOLD_MISMATCH"];
    expect((await audit(data, coreSystem)).filter((code) => equipmentCodes.includes(code!))).toEqual([]);
    expect(await audit(data, coreSystem)).toEqual(await audit(data));
  });

  test("saved expansion armor text survives but requires its library for trait and threshold auditing", async () => {
    const data = equippedCharacter("鳞甲");
    data.character.values.finesse = "0";
    const catalog = playerSystemPackageCatalog.find((item) => item.preset.directory === "daggerheart-core")!;
    const saved = await sheetCharacterToSave({ name: "Expansion armor", data,
      currentSystem: { ...catalog.system.package, resourceCompatibility: catalog.system.resourceCompatibility },
      sheetSystemPackage: system, installedPackages: new Map(),
    });
    const reopened = await loadPbcha(writePbcha(saved.document, saved.media), validateCharacterSaveCandidate);
    expect(reopened.diagnostics).toEqual([]);
    const restored = characterSaveToSheet({ candidate: reopened.candidate!, currentSystem: catalog.system,
      sheetSystemPackage: coreSystem, mediaUrl: (id) => id,
    });
    expect(restored.character.values["armor-name"]).toContain("鳞甲");
    expect(restored.cards.instances).toHaveLength(0);
    const beforeAudit = JSON.stringify(restored);
    expect(await audit(restored)).not.toContain("TRAIT_DISTRIBUTION_MISMATCH");
    expect(await audit(restored, coreSystem)).toContain("EQUIPMENT_RESOURCE_UNRESOLVED");
    expect(await audit(restored, coreSystem)).not.toContain("TRAIT_DISTRIBUTION_MISMATCH");
    expect(await audit(restored)).not.toContain("EQUIPMENT_RESOURCE_UNRESOLVED");
    expect(JSON.stringify(restored)).toBe(beforeAudit);
    restored.character.values["major-threshold"] = "999";
    expect(await audit(restored)).toContain("MAJOR_THRESHOLD_MISMATCH");
    expect(await audit(restored, coreSystem)).not.toContain("MAJOR_THRESHOLD_MISMATCH");
  });

  test("saved expansion weapon text does not substitute for a missing weapon definition", async () => {
    let data = equippedCharacter("皮甲");
    data = select(data, "pick-secondary-weapon", "weapons", "战斗斗篷");
    data.character.values["major-threshold"] = String(Number(data.character.values["major-threshold"]) + 2);
    data.character.values["severe-threshold"] = String(Number(data.character.values["severe-threshold"]) + 2);
    expect(data.character.values["secondary-weapon-name"]).toContain("战斗斗篷");
    expect(await audit(data)).not.toContain("MAJOR_THRESHOLD_MISMATCH");
    expect(await audit(data, coreSystem)).toContain("EQUIPMENT_RESOURCE_UNRESOLVED");
    expect(await audit(data, coreSystem)).not.toContain("MAJOR_THRESHOLD_MISMATCH");
    expect(await audit(data, coreSystem)).not.toContain("SEVERE_THRESHOLD_MISMATCH");
    expect(await audit(data)).not.toContain("EQUIPMENT_RESOURCE_UNRESOLVED");
    data.character.values["major-threshold"] = "999";
    expect(await audit(data)).toContain("MAJOR_THRESHOLD_MISMATCH");
  });

  test.each(["armor-name", "primary-weapon-name", "secondary-weapon-name"])("unknown %s pauses only definition-dependent checks", async (slot) => {
    const data = equippedCharacter("皮甲", coreSystem);
    data.character.values[slot] = "手写自定义装备";
    data.character.values.agility = "99";
    data.character.values.evasion = "99";
    data.character.values["armor-value"] = "99";
    data.character.values["armor-slots"] = { current: 0, max: 98 };
    data.character.values["major-threshold"] = "99";
    data.character.values["severe-threshold"] = "99";
    data.character.values["advancement-tier-2"] = { "hp-1": true };
    data.character.values.hp = { current: 0, max: 99 };
    data.character.values.stress = { current: 0, max: 99 };
    const codes = await audit(data, coreSystem);
    expect(codes).toContain("EQUIPMENT_RESOURCE_UNRESOLVED");
    for (const code of ["TRAIT_DISTRIBUTION_MISMATCH", "EVASION_MISMATCH", "ARMOR_MAX_MISMATCH", "MAJOR_THRESHOLD_MISMATCH", "SEVERE_THRESHOLD_MISMATCH", "VALIDATION_SCRIPT_ERROR"]) expect(codes).not.toContain(code);
    for (const code of ["ARMOR_VALUE_MAX_MISMATCH", "ADVANCEMENT_COUNT_MISMATCH", "ANCESTRY_CARD_COUNT_MISMATCH", "HP_MAX_MISMATCH", "STRESS_MAX_MISMATCH"]) expect(codes).toContain(code);
    const issues = await runValidationChecks({ characterData: data, resourceLibraries: coreSystem.resourceLibraries!, cardState: data.cards,
      packageMetadata: { id: coreSystem.manifest.ID, version: coreSystem.manifest.版本 }, checks: coreSystem.validationChecks!,
    });
    expect(issues.find((issue) => issue.code === "EQUIPMENT_RESOURCE_UNRESOLVED")).toMatchObject({
      level: "warning", path: `character.values.${slot}`, text: expect.stringContaining("自定义装备请人工核对"),
    });
    data.character.values.level = "0";
    expect(await audit(data, coreSystem)).toContain("LEVEL_INVALID");
  });

  test.each(["", "-", " - "])("empty equipment %j is not an unresolved resource", async (placeholder) => {
    const data = equippedCharacter("皮甲", coreSystem);
    for (const slot of ["armor-name", "primary-weapon-name", "secondary-weapon-name"]) data.character.values[slot] = placeholder;
    expect(await audit(data, coreSystem)).not.toContain("EQUIPMENT_RESOURCE_UNRESOLVED");
    data.character.values.agility = "99";
    data.character.values.evasion = "99";
    expect(await audit(data, coreSystem)).toContain("TRAIT_DISTRIBUTION_MISMATCH");
    expect(await audit(data, coreSystem)).toContain("EVASION_MISMATCH");
    const nonWarrior = coreSystem.resourceLibraries!.find((library) => library.ID === "classes")!.entries.find((item) => item.fields.名称 !== "战士")!;
    data.character.values["class-name"] = String(nonWarrior.fields.名称);
    const armed = select(data, "pick-primary-weapon", "weapons", "长弓", coreSystem);
    expect(await audit(armed, coreSystem)).not.toContain("TWO_HANDED_PRIMARY_WITH_SECONDARY");
  });

  test("keeps audit metadata consistent without changing character data or resource targets", async () => {
    const catalog = playerSystemPackageCatalog.find((item) => item.preset.directory === "daggerheart-core")!;
    const published = JSON.parse(await readFile("apps/player/public/system-packages/daggerheart-core/system.json", "utf8"));
    expect(system.manifest.版本).toBe(catalog.system.package.version);
    expect(published).toEqual(catalog.system);
    expect(catalog.preset.version).toBe(catalog.system.package.version);
    expect(published.runtime.characterDataVersion).toBe("1.0.0");
    const loaded = await loadPbres(new Uint8Array(await readFile("apps/player/public/system-packages/daggerheart-core/resources/daggerheart-core.pbres")), validateResourcePackageCandidate);
    expect(loaded.candidate?.document.targets).toEqual([{ systemPackageId: published.package.id, version: "1.0.0" }]);
  });

  test.each([
    { armor: "全板甲", agility: -1, evasion: -2 },
    { armor: "鳞甲", finesse: -1 },
    { armor: "改进鳞甲", finesse: -1 },
    { armor: "高级鳞甲", finesse: -1 },
    { armor: "传奇鳞甲", finesse: -1 },
    { armor: "环片甲", evasion: -1 },
    { armor: "改进环片甲", evasion: -1 },
    { armor: "高级环片甲", evasion: -1 },
    { armor: "传奇环片甲", evasion: -1 },
    { armor: "蛛丝束腰外衣", evasion: 1 },
    { armor: "天空守望者鳞甲", evasion: 2 },
    { armor: "贝拉莫伊精致护甲", presence: 1 },
    { armor: "救世主链甲", allTraits: -1, evasion: -1 },
    { armor: "皮甲", primary: "黑火药蛇铳", agility: -1 },
    { armor: "皮甲", primary: "附魔橡木棍", armorBonus: 1 },
    { armor: "皮甲", secondary: "战斗斗篷", bothThresholds: 2 },
    { armor: "皮甲", secondary: "改良战斗斗篷", bothThresholds: 3 },
    { armor: "皮甲", secondary: "高级战斗斗篷", bothThresholds: 4 },
    { armor: "皮甲", secondary: "传奇战斗斗篷", bothThresholds: 5 },
    { armor: "皮甲", primary: "勇气之剑", majorBonus: 3, evasion: -1 },
    { armor: "鳞甲", primary: "长弓", secondary: "塔盾", finesse: -2, evasion: -1, armorBonus: 2 },
    { armor: "铁木胸甲" },
    { armor: "威能丝甲" },
    { armor: "共振挽具" },
    { armor: "皮甲", secondary: "秘法臂铠" },
    { armor: "皮甲", primary: "扭曲匕首" },
    { armor: "皮甲", primary: "迷惑魔杖" },
  ])("includes current modifiers: $armor / $primary / $secondary", async (sample) => {
    let data = select(createEmptyCharacterData(system), "pick-class", "classes", "战士");
    data = select(data, "pick-armor", "armor", sample.armor);
    if (sample.primary) data = select(data, "pick-primary-weapon", "weapons", sample.primary);
    if (sample.secondary) data = select(data, "pick-secondary-weapon", "weapons", sample.secondary);
    data = select(data, "pick-backup-weapon-1", "weapons", "巨斧");
    const values = data.character.values;
    const armor = entry("armor", sample.armor).fields;
    values.level = "1";
    traits.forEach((trait, index) => {
      const bonus = sample[trait as keyof typeof sample];
      values[trait] = String(baseTraits[index]! + (typeof bonus === "number" ? bonus : 0) + (sample.allTraits ?? 0));
    });
    values.evasion = String(Number(entry("classes", "战士").fields.闪避值) + (sample.evasion ?? 0));
    const armorValue = Number(armor.护甲值) + (sample.armorBonus ?? 0);
    values["armor-value"] = String(armorValue);
    values["armor-slots"] = { current: 0, max: armorValue };
    values["major-threshold"] = String(Number(armor.重度阈值) + 1 + (sample.bothThresholds ?? 0) + (sample.majorBonus ?? 0));
    values["severe-threshold"] = String(Number(armor.严重阈值) + 1 + (sample.bothThresholds ?? 0));
    const equipmentCodes = ["TRAIT_DISTRIBUTION_MISMATCH", "EVASION_MISMATCH", "ARMOR_MAX_MISMATCH", "MAJOR_THRESHOLD_MISMATCH", "SEVERE_THRESHOLD_MISMATCH"];
    const beforeAudit = JSON.stringify(data);
    expect((await audit(data)).filter((code) => equipmentCodes.includes(code!))).toEqual([]);
    expect(JSON.stringify(data)).toBe(beforeAudit);
    if (sample.finesse || sample.agility || sample.presence || sample.allTraits) {
      const incorrect = structuredClone(data);
      traits.forEach((trait, index) => { incorrect.character.values[trait] = String(baseTraits[index]); });
      expect(await audit(incorrect)).toContain("TRAIT_DISTRIBUTION_MISMATCH");
    }
    if (sample.evasion) {
      const incorrect = structuredClone(data);
      incorrect.character.values.evasion = String(Number(values.evasion) - sample.evasion);
      expect(await audit(incorrect)).toContain("EVASION_MISMATCH");
    }
    if (sample.bothThresholds || sample.majorBonus) {
      const incorrect = structuredClone(data);
      incorrect.character.values["major-threshold"] = String(Number(armor.重度阈值) + 1);
      expect(await audit(incorrect)).toContain("MAJOR_THRESHOLD_MISMATCH");
    }
    values["armor-slots"] = { current: 0, max: armorValue + 1 };
    expect(await audit(data)).toContain("ARMOR_MAX_MISMATCH");
  });

  test.each(["法师长袍", "改进法师长袍", "高级法师长袍", "传说法师长袍", "符文锻造外骨骼", "格兰明斯特华服"])("uses character-dependent permanent bonuses for %s", async (name) => {
    let data = select(createEmptyCharacterData(system), "pick-armor", "armor", name);
    data = select(data, "pick-subclass", "subclasses", "知识学派");
    expect(data.cards.instances.length).toBeGreaterThan(0);
    const values = data.character.values;
    values.level = "8";
    values.knowledge = "3";
    values.presence = "2";
    const armor = entry("armor", name).fields;
    const thresholdBonus = name === "符文锻造外骨骼" ? 4 : name === "格兰明斯特华服" ? 0 : 3;
    const armorValue = Number(armor.护甲值) + (name === "格兰明斯特华服" ? 2 : 0);
    values["armor-value"] = String(armorValue);
    values["armor-slots"] = { current: 0, max: armorValue };
    values["major-threshold"] = String(Number(armor.重度阈值) + 8 + thresholdBonus);
    values["severe-threshold"] = String(Number(armor.严重阈值) + 8 + thresholdBonus);
    const codes = ["ARMOR_MAX_MISMATCH", "MAJOR_THRESHOLD_MISMATCH", "SEVERE_THRESHOLD_MISMATCH"];
    expect((await audit(data)).filter((code) => codes.includes(code!))).toEqual([]);
    values["major-threshold"] = String(Number(values["major-threshold"]) + 1);
    expect(await audit(data)).toContain("MAJOR_THRESHOLD_MISMATCH");
  });

  test.each([false, true])("does not guess an ambiguous spellcasting bonus (multiclass: %s)", async (multiclass) => {
    let data = select(createEmptyCharacterData(system), "pick-armor", "armor", "法师长袍");
    if (multiclass) {
      data = select(data, "pick-subclass", "subclasses", "知识学派");
      const other = system.resourceLibraries!.find((library) => library.ID === "subclasses")!.entries
        .find((item) => item.fields.施法属性 === "风度")!;
      expect(other).toBeDefined();
      data = applyResourceSelectionToDraft(data, system, "pick-multiclass", "subclasses", [other]).characterData;
      expect(data.cards.instances).toHaveLength(2);
    }
    data.character.values.level = "1";
    data.character.values["major-threshold"] = "8";
    data.character.values["severe-threshold"] = "14";
    const codes = await audit(data);
    expect(codes).not.toContain("MAJOR_THRESHOLD_MISMATCH");
    expect(codes).not.toContain("SEVERE_THRESHOLD_MISMATCH");
  });

  test("locks Valor Sword's major rather than severe threshold bonus to the current card source", () => {
    expect(entry("weapons", "勇气之剑").resourceCopy?.data).toMatchObject({
      特性描述: "−1闪避值；重度伤害阈值+3。",
    });
  });
});

test.each([{ issues: [] }, { issues: [{ source: "system", level: "warning" as const, text: "待核对" }] }])("audit disclaimer remains visible with or without findings", ({ issues }) => {
  expect(renderToStaticMarkup(<ValidationIssueDialog issues={issues} open onClose={() => {}} />)).toContain("审核仅供参考");
});
