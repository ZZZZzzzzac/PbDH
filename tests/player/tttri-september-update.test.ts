import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";
import { prepareCharacterDataMigration } from "../../apps/player/src/sheet-runtime/domain/characterDataMigration.ts";
import { createEmptyCharacterData, parseCharacterDataJson } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";

const root = "apps/player/public/system-packages/tttri/";
const read = (file: string) => readFileSync(root + file, "utf8");
const system = JSON.parse(read("system.json"));
const modules = JSON.parse(read("modules.json"));
const execute = (script: string, input: unknown) => {
  const context = { module: { exports: undefined as unknown }, input };
  runInNewContext(`${script}\nmodule.exports = module.exports(input);`, context, { timeout: 1000 });
  return context.module.exports;
};

describe("TTTRI September rules migrated from Sheet fe1de3f", () => {
  function auditCards(level: number, choices: Record<string, unknown>, domains: Array<[string, number]>) {
    const entries = [
      { libraryId: "ancestries", entry: { ID: "saved-ancestry", fields: { 名称: "乌萨斯" } } },
      { libraryId: "communities", entry: { ID: "saved-community", fields: { 名称: "高城之民" } } },
      ...domains.map(([domain, cardLevel], index) => ({ libraryId: "domain-cards", entry: { ID: `saved-domain-${index}`, fields: { 名称: `领域卡${index}`, 领域: domain, 等级: String(cardLevel) } } })),
    ];
    const characterData = {
      character: { values: { level: String(level), "primary-domain": "迅攻", "secondary-domain": "心界", ...choices } },
      cards: { instances: entries.map(({ libraryId, entry }) => ({ definitionRef: { type: "resourceLibrary", libraryId, entryId: entry.ID }, state: "配置" })) },
      embeddedResourceEntries: Object.fromEntries(entries.map((entry) => [entry.entry.ID, entry])),
    };
    return (execute(read("checks/character-consistency.js"), { characterData, resourceLibraries: [] }) as Array<{ code: string }>).map(issue => issue.code);
  }

  test("审核存档内种族、社群和领域卡副本，不依赖原资源库", () => {
    const codes = auditCards(1, {}, [["迅攻", 1], ["心界", 1]]);
    for (const code of ["ANCESTRY_CARD_COUNT_MISMATCH", "COMMUNITY_CARD_COUNT_MISMATCH", "DOMAIN_CARD_COUNT_MISMATCH", "DOMAIN_CARD_AFFILIATION_MISMATCH"]) expect(codes).not.toContain(code);
    expect(auditCards(1, {}, [["迅攻", 1]])).toContain("DOMAIN_CARD_COUNT_MISMATCH");
    expect(auditCards(1, {}, [["迅攻", 1]])).not.toContain("DOMAIN_CARD_AFFILIATION_MISMATCH");
  });

  test("技艺交流必须勾两格且按 T2/T3/T4 的 2/4/5 级限额匹配外领域卡", () => {
    const normal: Array<[string, number]> = Array.from({ length: 11 }, () => ["迅攻", 1]);
    for (const [tier, cap] of [[2, 2], [3, 4], [4, 5]]) {
      const choice = { [`advancement-tier-${tier}`]: { "multiclass-1": true, "multiclass-2": true } };
      expect(auditCards(10, choice, [...normal, ["工业", cap]])).not.toContain("DOMAIN_CARD_AFFILIATION_MISMATCH");
      expect(auditCards(10, choice, [...normal, ["工业", cap + 1]])).toContain("DOMAIN_CARD_AFFILIATION_MISMATCH");
      expect(auditCards(10, choice, [...normal, ["迅攻", 1]])).toContain("DOMAIN_CARD_AFFILIATION_MISMATCH");
      expect(auditCards(10, { [`advancement-tier-${tier}`]: { "multiclass-1": true } }, [...normal, ["工业", 1]])).toContain("DOMAIN_CARD_AFFILIATION_MISMATCH");
    }
    const allChoices = Object.fromEntries([2, 3, 4].map(tier => [`advancement-tier-${tier}`, { "multiclass-1": true, "multiclass-2": true }]));
    expect(auditCards(10, allChoices, [...normal, ["工业", 5], ["秘行", 2], ["奇迹", 4]])).not.toContain("DOMAIN_CARD_AFFILIATION_MISMATCH");
    const fourNormal: Array<[string, number]> = Array.from({ length: 4 }, () => ["迅攻", 1]);
    expect(auditCards(3, allChoices, [...fourNormal, ["工业", 2]])).toContain("DOMAIN_CARD_AFFILIATION_MISMATCH");
  });

  test("declares native character upgrade and free stage rewards with double-slot multiclass", () => {
    expect(system.package.version).toBe("1.1.0");
    expect(system.runtime.characterDataVersion).toBe("1.1.0");
    for (const tier of [2, 3, 4]) {
      const module = modules.find((item: { ID: string }) => item.ID === `advancement-tier-${tier}`);
      expect(module.选项.filter((item: { 分组: string }) => item.分组 === "multiclass")).toHaveLength(2);
      expect(module.选项.some((item: { ID: string }) => item.ID.startsWith("subclass"))).toBe(false);
      expect(modules.find((item: { ID: string }) => item.ID === `advancement-tier-${tier}-reward`).内容).toContain("不耗格");
    }
  });

  test("upgrades native 1.0.6 saves without changing valid choices or authored feature text", async () => {
    const original = {
      "subclass-current": "手工修改的特性",
      "advancement-tier-2": { subclass: true, "traits-1": true, "multiclass-1": true },
      "advancement-tier-3": { subclass: false, "hp-1": true },
      "advancement-tier-4": { "subclass-elite": true, "proficiency-1": true },
    };
    const result = await prepareCharacterDataMigration({
      fromVersion: "1.0.6", toVersion: "1.1.0", characterData: original,
      migrations: system.runtime.characterDataMigrations.map((step: { script: string }) => ({ ...step, scriptContent: read(step.script) })),
      execute: async (script, input) => execute(script, input),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error(JSON.stringify(result));
    expect(result.candidate.characterData).toEqual({
      "subclass-current": "手工修改的特性",
      "advancement-tier-2": { "traits-1": true, "multiclass-1": true, "multiclass-2": false },
      "advancement-tier-3": { "hp-1": true, "multiclass-2": false },
      "advancement-tier-4": { "proficiency-1": true, "multiclass-2": false },
    });
    expect(original["advancement-tier-2"].subclass).toBe(true);
  });

  test("warns instead of discarding every checkbox when one imported option is obsolete", () => {
    const runtime = {
      manifest: { ID: system.package.id, 名称: system.package.name, 版本: "1.1.0", 角色数据版本: "1.1.0" }, pages: [], modules,
    } as SystemPackage;
    const data = createEmptyCharacterData(runtime);
    data.character.values["advancement-tier-2"] = { subclass: true, "traits-1": true, "multiclass-1": false };
    const result = parseCharacterDataJson(JSON.stringify(data), runtime);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.character.values["advancement-tier-2"]).toMatchObject({ "traits-1": true, "multiclass-1": false, "multiclass-2": false });
    expect(result.data.character.values["advancement-tier-2"]).not.toHaveProperty("subclass");
    expect(result.report.diagnostics.some((item) => item.code === "CHARACTER_DATA_CHECKBOX_OPTIONS_SKIPPED")).toBe(true);
  });

  test("checks promotion by level and reports incomplete double-slot multiclass", () => {
    const check = (values: Record<string, unknown>) => (execute(read("checks/character-consistency.js"), {
      characterData: { character: { values } }, resourceLibraries: [],
    }) as Array<{ code: string }>).map((issue) => issue.code);
    expect(check({ level: "2", "subclass-stage": "预备" })).toContain("T2_SUBCLASS_UPGRADE_MISSING");
    expect(check({ level: "8", "subclass-stage": "精英Y" })).not.toContain("T4_ELITE_SUBCLASS_MISSING");
    expect(check({ level: "2", "advancement-tier-2": { "multiclass-1": true } })).toContain("MULTICLASS_UPGRADE_INCOMPLETE");
    expect(check({ level: "2", "advancement-tier-2": { "multiclass-1": true, "multiclass-2": true } })).not.toContain("MULTICLASS_UPGRADE_INCOMPLETE");
  });
});
