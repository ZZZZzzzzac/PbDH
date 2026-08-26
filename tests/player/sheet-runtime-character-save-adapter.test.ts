import { describe, expect, it } from "vitest";

import { validateCharacterSaveCandidate } from "../../apps/player/src/character-saves/character-save-validator.ts";
import {
  characterSaveToSheet,
  sheetCharacterToSave,
} from "../../apps/player/src/sheet-runtime/storage/characterSaveAdapter.ts";
import type { CharacterData as SheetCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import type { SystemPackage as SheetSystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import type { ResourceLibrary } from "../../apps/player/src/resources/resource-library.ts";

const systemPackageId = "00000000-0000-7000-8000-000000000010";
const resourcePackageId = "00000000-0000-7000-8000-000000000020";
const standardCardId = "00000000-0000-7000-8000-000000000030";
const compositeCardId = "00000000-0000-7000-8000-000000000031";

describe("Sheet Runtime Character Save adapter", () => {
  it("保存最终字段和自包含桌面副本，不保存资源选择快照", async () => {
    const data = sheetCharacterData();
    const candidate = await sheetCharacterToSave({
      name: "测试角色",
      data,
      currentSystem: {
        id: systemPackageId,
        version: "1.0.0",
        resourceCompatibility: [
          {
            templateId: "种族",
            versionRange: { minimumInclusive: "0.0.0-dev.1" },
            nativeEntry: { id: "ancestries" },
          },
          {
            templateId: "社群",
            versionRange: { minimumInclusive: "0.0.0-dev.1" },
            nativeEntry: { id: "communities" },
          },
        ],
      },
      sheetSystemPackage: sheetSystemPackage(),
      installedPackages: installedPackages(),
    });

    expect(candidate.document.characterData.values).toEqual({ name: "阿斯特里德" });
    expect(candidate.document.characterData).not.toHaveProperty("resourceSelections");
    expect(candidate.document.characterData.tabletop.instances).toHaveLength(2);
    expect(candidate.document.characterData.tabletop.instances[0]?.resourceCopy.source).toEqual({
      packageId: resourcePackageId,
      resourceId: "community:forest",
    });
    expect(candidate.document.characterData.tabletop.instances[1]?.resourceCopy).toMatchObject({
      source: null,
      template: { id: "种族", version: "0.0.0-dev.1" },
      data: {
        名称: "人类 / 精灵",
        特性: [{ 描述: "**适应**：说明" }, { 描述: "**冥想**：说明" }],
      },
    });
    expect(await validateCharacterSaveCandidate(candidate.document, candidate.media)).toEqual([]);
  });

  it("即使来源资源库不存在，也能从 Character Save 恢复卡面条目", async () => {
    const candidate = await sheetCharacterToSave({
      name: "测试角色",
      data: sheetCharacterData(),
      currentSystem: {
        id: systemPackageId,
        version: "1.0.0",
        resourceCompatibility: [
          { templateId: "种族", versionRange: { minimumInclusive: "0.0.0-dev.1" }, nativeEntry: { id: "ancestries" } },
          { templateId: "社群", versionRange: { minimumInclusive: "0.0.0-dev.1" }, nativeEntry: { id: "communities" } },
        ],
      },
      sheetSystemPackage: sheetSystemPackage(),
      installedPackages: installedPackages(),
    });
    const restored = characterSaveToSheet({
      candidate,
      currentSystem: {
        resourceCompatibility: [
          {
            templateId: "种族",
            versionRange: { minimumInclusive: "0.0.0-dev.1", maximumExclusive: "1.0.0" },
            nativeEntry: { id: "ancestries" },
          },
          {
            templateId: "社群",
            versionRange: { minimumInclusive: "0.0.0-dev.1", maximumExclusive: "1.0.0" },
            nativeEntry: { id: "communities" },
          },
        ],
      },
      mediaUrl: (assetId) => `blob:${assetId}`,
    });

    expect(restored.resourceSelections).toEqual({});
    expect(restored.cards.instances).toHaveLength(2);
    expect(restored.embeddedResourceEntries[`character-copy:${standardCardId}`]).toMatchObject({
      libraryId: "communities",
      entry: { fields: { 名称: "荒野之民", 描述: "**通晓地形**：说明" } },
    });
    expect(restored.embeddedResourceEntries[`character-copy:${compositeCardId}`]).toMatchObject({
      libraryId: "ancestries",
      entry: { fields: { 名称: "人类 / 精灵", 特性A: "**适应**：说明", 特性B: "**冥想**：说明" } },
    });

    const duplicateId = "00000000-0000-7000-8000-000000000041";
    const duplicate = await sheetCharacterToSave({
      name: "测试角色副本",
      data: { ...restored, character: { ...restored.character, id: duplicateId } },
      currentSystem: {
        id: systemPackageId,
        version: "1.0.0",
        resourceCompatibility: [
          { templateId: "种族", versionRange: { minimumInclusive: "0.0.0-dev.1" }, nativeEntry: { id: "ancestries" } },
          { templateId: "社群", versionRange: { minimumInclusive: "0.0.0-dev.1" }, nativeEntry: { id: "communities" } },
        ],
      },
      sheetSystemPackage: sheetSystemPackage(),
      installedPackages: new Map(),
    });
    expect(duplicate.document.documentId).toBe(duplicateId);
    expect(duplicate.document.characterData.tabletop.instances).toHaveLength(2);
    expect(await validateCharacterSaveCandidate(duplicate.document, duplicate.media)).toEqual([]);
  });
});

function sheetCharacterData(): SheetCharacterData {
  return {
    kind: "pbdh-character-data",
    schemaVersion: "0.1.0",
    systemPackage: { id: systemPackageId, version: "1.0.0" },
    character: { id: "00000000-0000-7000-8000-000000000040", values: { name: "阿斯特里德" } },
    cards: {
      instances: [
        {
          instanceId: standardCardId,
          tableModuleId: "character-card-table",
          definitionRef: { type: "resourceLibrary", libraryId: "communities", entryId: `${resourcePackageId}:community:forest` },
          state: "配置",
          xPct: 10,
          yPct: 20,
          zIndex: 1,
          face: "front",
          rotation: 0,
          scale: 1,
          indicators: [],
        },
        {
          instanceId: compositeCardId,
          tableModuleId: "character-card-table",
          definitionRef: { type: "compositeResource", compositeResourceId: "composite:pick-ancestry" },
          state: "配置",
          xPct: 30,
          yPct: 40,
          zIndex: 2,
          face: "front",
          rotation: 0,
          scale: 1,
          indicators: [],
        },
      ],
    },
    compositeResources: {
      "pick-ancestry": {
        ID: "composite:pick-ancestry",
        composerModuleId: "pick-ancestry",
        fields: {
          ID: "composite:pick-ancestry",
          种族A名称: "人类",
          种族B名称: "精灵",
          特性A: "**适应**：说明",
          特性B: "**冥想**：说明",
        },
      },
    },
    embeddedResourceEntries: {},
    resourceSelections: { "pick-community": { libraryId: "communities", entryIds: [`${resourcePackageId}:community:forest`] } },
    playerImages: {},
    updatedAt: "2026-08-26T00:00:00.000Z",
  };
}

function sheetSystemPackage(): SheetSystemPackage {
  return {
    manifest: { ID: systemPackageId, 名称: "测试系统", 版本: "1.0.0", schemaVersion: "0.2.0" },
    pages: [],
    modules: [{
      ID: "pick-ancestry",
      类型: "resourceComposer",
      按钮文本: "选择种族",
      来源槽位: [
        { ID: "a", 标签: "A", 资源库ID: "ancestries" },
        { ID: "b", 标签: "B", 资源库ID: "ancestries" },
      ],
      输出字段: [{ 字段: "特性A", 来源槽位ID: "a", 来源字段: "特性A" }],
    }],
  } as SheetSystemPackage;
}

function installedPackages(): ResourceLibrary {
  const resource = {
    id: "community:forest",
    path: "社群/荒野之民.json",
    template: { id: "社群", version: "0.0.0-dev.1" },
    presentation: { width: "63", height: "88", unit: "mm", mode: "text", fixedRatio: true },
    data: {
      名称: "荒野之民",
      简介: "荒野社群",
      性格: "坚韧",
      特性: { 名称: "通晓地形", 描述: "**通晓地形**：说明" },
    },
    media: {},
  };
  return new Map([[resourcePackageId, {
    document: {
      package: { id: resourcePackageId },
      assets: [],
      resources: [resource],
    },
    media: new Map(),
    routes: [{ resource, destination: "native", nativeEntry: { id: "communities", label: "社群" } }],
  }]]) as unknown as ResourceLibrary;
}
