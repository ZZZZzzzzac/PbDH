import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { SystemPackageDocument } from "@pbdh/contract-runtime";

import {
  buildSheetResourceLibraries,
  buildSheetRuntimeMediaAssets,
  replacePlatformResourceLibraries,
  replacePlatformRuntimeMediaAssets,
  sheetRuntimeMediaPath,
} from "../../apps/player/src/sheet-runtime/adapters/platformResourceLibraries.ts";
import { getResourceLibraryFields } from "../../apps/player/src/sheet-runtime/domain/resourceLibrary.ts";
import type { ResourceLibrary as SheetResourceLibrary } from "../../apps/player/src/sheet-runtime/domain/resourceLibrary.ts";
import { getOtherResourceLibraries } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { ResourceLibraryBrowser } from "../../apps/player/src/sheet-runtime/rendering/ResourceLibraryBrowser.tsx";
import type { ResourceLibrary } from "../../apps/player/src/resources/resource-library.ts";

const currentSystem = {
  resourceCompatibility: [
    { templateId: "种族", nativeEntry: { id: "ancestries", label: "种族" } },
    { templateId: "护甲", nativeEntry: { id: "armor", label: "护甲" } },
    { templateId: "自由", nativeEntry: { id: "free-resources", label: "自由资源" } },
  ],
} as SystemPackageDocument;

describe("Sheet Runtime 平台资源适配", () => {
  it("按模板恢复 Sheet 字段并把媒体变为运行时 URL", () => {
    const libraries = buildSheetResourceLibraries({
      currentSystem,
      installedPackages: libraryWith([
        resource("ancestry", "种族", {
          名称: "械灵",
          简介: "机械生命",
          特性: [
            { 名称: "定制设计", 描述: "特性一" },
            { 名称: "高效休整", 描述: "特性二" },
          ],
        }, { portrait: "sha256:portrait", back: "sha256:back" }),
        resource("armor", "护甲", {
          名称: "锁甲",
          重度伤害阈值: "7",
          严重伤害阈值: "14",
        }),
      ]),
      resolveMediaReference: ({ assetId }) => `blob:${assetId}`,
    });

    expect(libraries.find((library) => library.ID === "ancestries")?.entries[0]).toMatchObject({
      ID: "00000000-0000-7000-8000-000000000001:ancestry",
      fields: {
        名称: "械灵",
        类型: "种族",
        特性A: "特性一",
        特性B: "特性二",
        卡图: "blob:sha256:portrait",
        卡背: "blob:sha256:back",
      },
    });
    expect(libraries.find((library) => library.ID === "armor")?.entries[0]?.fields).toMatchObject({
      重度阈值: "7",
      严重阈值: "14",
    });
  });

  it("用资源包 ID 隔离相同的包内资源 ID", () => {
    const first = installedPackage("00000000-0000-7000-8000-000000000001", [resource("same", "种族", { 名称: "甲", 特性: [] })]);
    const second = installedPackage("00000000-0000-7000-8000-000000000002", [resource("same", "种族", { 名称: "乙", 特性: [] })]);
    const libraries = buildSheetResourceLibraries({
      currentSystem,
      installedPackages: new Map([
        [first.document.package.id, first],
        [second.document.package.id, second],
      ]) as unknown as ResourceLibrary,
    });

    expect(libraries[0]?.entries.map((entry) => entry.ID)).toEqual([
      "00000000-0000-7000-8000-000000000001:same",
      "00000000-0000-7000-8000-000000000002:same",
    ]);
  });

  it("不把仅供资源包展示的封面注入 Sheet Runtime", () => {
    const packageId = "00000000-0000-7000-8000-000000000001";
    const portraitId = "sha256:portrait";
    const coverId = "sha256:cover";
    const installed = installedPackage(
      packageId,
      [resource("ancestry", "种族", { 名称: "械灵", 特性: [] }, { portrait: portraitId })],
      [imageAsset(portraitId), imageAsset(coverId)],
      new Map([
        [portraitId, new Uint8Array([1])],
        [coverId, new Uint8Array([2])],
      ]),
    );

    expect(buildSheetRuntimeMediaAssets(
      new Map([[packageId, installed]]) as unknown as ResourceLibrary,
    )).toEqual([{
      路径: sheetRuntimeMediaPath(packageId, portraitId),
      类型: "image/webp",
      sourceType: "resourceExtension",
      sourceId: packageId,
      bytes: new Uint8Array([1]),
    }]);
  });

  it("把 Picker 字段模板作为显示白名单", () => {
    const library = buildSheetResourceLibraries({
      currentSystem,
      installedPackages: libraryWith([
        resource("armor", "护甲", { 名称: "锁甲", 护甲值: "4", 描述: "结实", 内部备注: "不应展示" }),
      ]),
    }).find((candidate) => candidate.ID === "armor")!;

    expect(getResourceLibraryFields(library, [
      { 键: "名称", 列宽: "normal" },
      { 键: "护甲值", 标签: "护甲" },
    ]).map((field) => field.key)).toEqual(["名称", "护甲值"]);
  });

  it("把自由 Template 的具名内容段投影为 Sheet Resource 字段", () => {
    const library = buildSheetResourceLibraries({
      currentSystem,
      installedPackages: libraryWith([
        resource("survivor-style", "自由", {
          名称: "孤独",
          类型: "求生者风格",
          简介: "独自求生",
          内容: [
            { 标题: "第一特性名称", 正文: "独行智慧" },
            { 标题: "第一特性规则", 正文: "没有队友时具有优势。" },
          ],
        }),
      ]),
    }).find((candidate) => candidate.ID === "free-resources")!;

    expect(library.entries[0]?.fields).toMatchObject({
      名称: "孤独",
      类型: "求生者风格",
      简介: "独自求生",
      第一特性名称: "独行智慧",
      第一特性规则: "没有队友时具有优势。",
    });
  });

  it("把资源包卡面显示方式传给 Sheet 卡牌", () => {
    const imageResource = resource("ancestry", "种族", { 名称: "械灵", 特性: [] }, { portrait: "sha256:portrait" }, "image");
    const libraries = buildSheetResourceLibraries({
      currentSystem,
      installedPackages: libraryWith([imageResource]),
    });

    const entry = libraries.find((library) => library.ID === "ancestries")?.entries[0];
    expect(entry?.fields.卡牌显示方式).toBe("image");
    expect(entry?.resourceCopy).toMatchObject({
      template: { id: "种族", version: "1.0.0" },
      presentation: { mode: "image" },
      media: { portrait: "sha256:portrait" },
    });
  });

  it("领域卡名称再长也保持名称列居中", () => {
    const library = {
      ID: "domain-cards",
      名称: "领域卡",
      路径: "test:domain-cards",
      fields: [{ key: "名称", label: "名称", visible: true, filterable: true, sortable: true, searchable: true, width: "normal" }],
      entries: [{ ID: "long-name", fields: { ID: "long-name", 名称: "这是一个超过十个字的自制领域卡名称" } }],
    } satisfies SheetResourceLibrary;

    const markup = renderToStaticMarkup(createElement(ResourceLibraryBrowser, {
      library,
      multiSelect: false,
      selectedIds: [],
      onCommit: () => undefined,
      onClose: () => undefined,
    }));

    expect(markup).toMatch(/<th class="resource-table-cell-centered"[^>]*>[\s\S]*?名称/);
    expect(markup).toMatch(/<td class="[^"]*resource-table-cell-centered[^"]*">/);
  });

  it("把没有原生入口的资源统一接到系统可选的其他资源库", () => {
    const packageId = "00000000-0000-7000-8000-000000000001";
    const portraitId = "sha256:other-portrait";
    const other = resource("madness", "自由", {
      名称: "记忆障碍",
      内容: [
        { 标题: "类型", 正文: "疯狂" },
        { 标题: "简介", 正文: "一张疯狂卡" },
        { 标题: "效果", 正文: "无法清晰回忆。" },
      ],
    }, { portrait: portraitId }, "image");
    const installed = installedPackage(
      packageId,
      [other],
      [imageAsset(portraitId)],
      new Map([[portraitId, new Uint8Array([1])]]),
    );
    const installedPackages = new Map([[packageId, {
      ...installed,
      routes: [{ resource: other, destination: "other-resources", reason: "template-incompatible" }],
    }]]) as unknown as ResourceLibrary;

    const libraries = buildSheetResourceLibraries({ currentSystem, installedPackages });
    expect(libraries.filter((library) => library.ID === "其他")).toHaveLength(1);
    expect(libraries.find((library) => library.ID === "其他")?.entries[0]).toMatchObject({
      fields: { 名称: "记忆障碍", 类型: "疯狂", 效果: "无法清晰回忆。" },
    });
    const packageWithOtherPicker = {
      modules: [{ ID: "pick-other-resources", 类型: "resourcePicker", 按钮文本: "选择其他资源", 资源库: "其他" }],
      resourceLibraries: libraries,
    } as unknown as SystemPackage;
    expect(getOtherResourceLibraries(packageWithOtherPicker).map((library) => library.ID)).toEqual(["其他"]);
    expect(buildSheetRuntimeMediaAssets(installedPackages)).toMatchObject([{
      路径: sheetRuntimeMediaPath(packageId, portraitId),
    }]);
  });

  it("局部替换平台资源，同时保留系统自己的资源条目", () => {
    const oldPackageId = "00000000-0000-7000-8000-000000000001";
    const nextPackageId = "00000000-0000-7000-8000-000000000002";
    const oldLibraries = buildSheetResourceLibraries({
      currentSystem,
      installedPackages: libraryWith([resource("old", "种族", { 名称: "旧资源", 特性: [] })]),
    });
    const basePackage = {
      manifest: { ID: "test-system", 名称: "测试系统", 版本: "1.0.0" },
      resourceLibraries: oldLibraries.map((library) => library.ID === "ancestries" ? {
        ...library,
        路径: "legacy:ancestries",
        entries: [{ ID: "system-entry", fields: { ID: "system-entry", 名称: "系统自带" } }, ...library.entries],
      } : library),
    } as unknown as SystemPackage;
    const nextInstalled = installedPackage(nextPackageId, [
      resource("next", "护甲", { 名称: "新资源", 重度伤害阈值: "7", 严重伤害阈值: "14" }),
    ]);

    const refreshed = replacePlatformResourceLibraries({
      currentSystem,
      basePackage,
      installedPackages: new Map([[nextPackageId, nextInstalled]]) as unknown as ResourceLibrary,
    });

    expect(refreshed.resourceLibraries?.find((library) => library.ID === "ancestries")?.entries.map((entry) => entry.ID))
      .toEqual(["system-entry"]);
    expect(refreshed.resourceLibraries?.find((library) => library.ID === "armor")?.entries.map((entry) => entry.ID))
      .toEqual([`${nextPackageId}:next`]);
    expect(refreshed.resourceLibraries?.flatMap((library) => library.entries).some((entry) => entry.ID === `${oldPackageId}:old`))
      .toBe(false);
  });

  it("局部替换平台卡图，同时保留系统包与旧扩展的图片", () => {
    const packageId = "00000000-0000-7000-8000-000000000002";
    const portraitId = "sha256:new";
    const nextInstalled = installedPackage(
      packageId,
      [resource("next", "种族", { 名称: "新资源", 特性: [] }, { portrait: portraitId }, "image")],
      [imageAsset(portraitId)],
      new Map([[portraitId, new Uint8Array([3])]]),
    );

    const refreshed = replacePlatformRuntimeMediaAssets([
      { 路径: "assets/system.webp", 类型: "image/webp", bytes: new Uint8Array([1]) },
      { 路径: "platform-resources/old/old.webp", 类型: "image/webp", sourceType: "resourceExtension", sourceId: "old", bytes: new Uint8Array([2]) },
      { 路径: "assets/legacy.webp", 类型: "image/webp", sourceType: "resourceExtension", sourceId: "legacy", bytes: new Uint8Array([4]) },
    ], new Map([[packageId, nextInstalled]]) as unknown as ResourceLibrary);

    expect(refreshed.map((asset) => asset.路径)).toEqual([
      "assets/system.webp",
      "assets/legacy.webp",
      sheetRuntimeMediaPath(packageId, portraitId),
    ]);
  });
});

function libraryWith(resources: ReturnType<typeof resource>[]): ResourceLibrary {
  const installed = installedPackage("00000000-0000-7000-8000-000000000001", resources);
  return new Map([[installed.document.package.id, installed]]) as unknown as ResourceLibrary;
}

function installedPackage(
  packageId: string,
  resources: ReturnType<typeof resource>[],
  assets: ReturnType<typeof imageAsset>[] = [],
  media = new Map<string, Uint8Array>(),
) {
  return {
    document: {
      package: { id: packageId },
      resources,
      assets,
    },
    media,
    routes: resources.map((candidate) => ({
      resource: candidate,
      destination: "native" as const,
      nativeEntry: candidate.template.id === "护甲"
        ? { id: "armor", label: "护甲" }
        : candidate.template.id === "自由"
          ? { id: "free-resources", label: "自由资源" }
          : { id: "ancestries", label: "种族" },
    })),
  };
}

function resource(
  id: string,
  templateId: string,
  data: Record<string, unknown>,
  media: Record<string, string> = {},
  mode: "text" | "image" = "text",
) {
  return {
    id,
    path: `${id}.json`,
    template: { id: templateId, version: "1.0.0" },
    presentation: { mode, fixedRatio: false },
    data,
    media,
  };
}

function imageAsset(id: string) {
  return {
    id,
    mediaType: "image/webp" as const,
    byteLength: "1",
    width: "1",
    height: "1",
  };
}
