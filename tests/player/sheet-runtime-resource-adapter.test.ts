import { describe, expect, it } from "vitest";

import type { SystemPackageDocument } from "@pbdh/contract-runtime";

import { buildSheetResourceLibraries } from "../../apps/player/src/sheet-runtime/adapters/platformResourceLibraries.ts";
import type { ResourceLibrary } from "../../apps/player/src/resources/resource-library.ts";

const currentSystem = {
  resourceCompatibility: [
    { templateId: "种族", nativeEntry: { id: "ancestries", label: "种族" } },
    { templateId: "护甲", nativeEntry: { id: "armor", label: "护甲" } },
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
});

function libraryWith(resources: ReturnType<typeof resource>[]): ResourceLibrary {
  const installed = installedPackage("00000000-0000-7000-8000-000000000001", resources);
  return new Map([[installed.document.package.id, installed]]) as unknown as ResourceLibrary;
}

function installedPackage(packageId: string, resources: ReturnType<typeof resource>[]) {
  return {
    document: {
      package: { id: packageId },
      resources,
    },
    media: new Map(),
    routes: resources.map((candidate) => ({
      resource: candidate,
      destination: "native" as const,
      nativeEntry: candidate.template.id === "护甲"
        ? { id: "armor", label: "护甲" }
        : { id: "ancestries", label: "种族" },
    })),
  };
}

function resource(
  id: string,
  templateId: string,
  data: Record<string, unknown>,
  media: Record<string, string> = {},
) {
  return {
    id,
    path: `${id}.json`,
    template: { id: templateId, version: "1.0.0" },
    presentation: { mode: "text" as const, fixedRatio: false },
    data,
    media,
  };
}
