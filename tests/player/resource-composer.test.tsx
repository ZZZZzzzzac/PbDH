import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { TabletopResourceCopy } from "@pbdh/contract-runtime";
import { ancestryTemplate } from "../../packages/templates/src/core/index.ts";
import { composeResource } from "../../apps/player/src/sheet-runtime/domain/resourceComposer.ts";
import type { ResourceLibraryEntry } from "../../apps/player/src/sheet-runtime/domain/resourceLibrary.ts";
import type { CardTableModule, ResourceComposerModule } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { CardFace } from "../../apps/player/src/sheet-runtime/rendering/cardTable/CardFace.tsx";

const composer = {
  ID: "pick-ancestry",
  类型: "resourceComposer",
  按钮文本: "选择种族",
  来源槽位: [
    { ID: "ancestry-a", 标签: "特性 A 来源", 资源库ID: "ancestries" },
    { ID: "ancestry-b", 标签: "特性 B 来源", 资源库ID: "ancestries" },
  ],
  输出字段: [
    { 字段: "种族A名称", 来源槽位ID: "ancestry-a", 来源字段: "名称" },
    { 字段: "种族B名称", 来源槽位ID: "ancestry-b", 来源字段: "名称" },
    { 字段: "特性A", 来源槽位ID: "ancestry-a", 来源字段: "特性A" },
    { 字段: "特性B", 来源槽位ID: "ancestry-b", 来源字段: "特性B" },
    { 字段: "卡图", 来源槽位ID: "ancestry-a", 来源字段: "卡图" },
  ],
  选择关系输出: {
    字段: "卡牌显示方式",
    全部相同时: "image",
    全部相同时来源字段: "卡牌显示方式",
    不全相同时: "text",
  },
} satisfies ResourceComposerModule;

describe("Player Resource Composer 规范卡面", () => {
  it("混血种族组合为种族模板的结构化资源副本", () => {
    const dwarf = ancestryEntry("dwarf", "矮人", "DWARF", "厚实皮肤", "减免伤害", "增强坚韧", "伤害减半");
    const elf = ancestryEntry("elf", "精灵", "ELF", "快速反应", "提高闪避", "自然感知", "察觉魔法");
    const composite = composeResource(composer, { "ancestry-a": dwarf, "ancestry-b": elf });

    expect(composite?.resourceCopy).toMatchObject({
      source: null,
      template: { id: "种族", version: ancestryTemplate.version },
      presentation: { mode: "text" },
      data: {
        名称: "矮人 / 精灵",
        原文: "DWARF / ELF",
        类型: "种族",
        简介: "",
        特性: [
          { 特性名称: "厚实皮肤", 特性原文: "THICK SKIN", 特性描述: "减免伤害" },
          { 特性名称: "自然感知", 特性原文: "NATURAL SENSE", 特性描述: "察觉魔法" },
        ],
      },
      media: {},
    });

    const markup = renderToStaticMarkup(<CardFace
      definition={composite ?? undefined}
      definitionRef={{ type: "compositeResource", compositeResourceId: composite!.ID }}
      module={{
        类型: "cardTable",
        ID: "cards",
        标签: "卡牌",
        资源来源: [{ 类型: "resourceComposer", ID: composer.ID }],
      } as CardTableModule}
      fallbackName="矮人 / 精灵"
    />);
    expect(markup).toContain("矮人 / 精灵规范卡面");
    expect(markup).toContain("data-pbdh-canonical-surface");
    expect(markup).not.toContain("play-card-text");
  });

  it("纯血组合直接继承来源种族的模板、卡面和媒体", () => {
    const dwarf = ancestryEntry("dwarf", "矮人", "DWARF", "厚实皮肤", "减免伤害", "增强坚韧", "伤害减半", "image");
    const composite = composeResource(composer, { "ancestry-a": dwarf, "ancestry-b": dwarf });

    expect(composite?.fields.卡牌显示方式).toBe("image");
    expect(composite?.resourceCopy).toEqual(dwarf.resourceCopy);
    expect(composite?.resourceCopy).not.toBe(dwarf.resourceCopy);
  });
});

function ancestryEntry(
  id: string,
  name: string,
  original: string,
  firstName: string,
  firstDescription: string,
  secondName: string,
  secondDescription: string,
  mode: "text" | "image" = "text",
): ResourceLibraryEntry {
  const portraitId = `sha256:${id.padEnd(64, "0")}`;
  const resourceCopy: TabletopResourceCopy = {
    source: { packageId: "00000000-0000-7000-8000-000000000001", resourceId: id },
    template: { id: "种族", version: ancestryTemplate.version },
    presentation: { ...ancestryTemplate.defaultPresentation, mode },
    data: {
      名称: name,
      原文: original,
      类型: "种族",
      简介: `${name}简介`,
      特性: [
        { 特性名称: firstName, 特性原文: "THICK SKIN", 特性描述: firstDescription },
        { 特性名称: secondName, 特性原文: "NATURAL SENSE", 特性描述: secondDescription },
      ],
    },
    labels: [],
    media: { portrait: portraitId },
  };
  return {
    ID: `package:${id}`,
    fields: {
      ID: `package:${id}`,
      名称: name,
      特性A: `${firstName}：${firstDescription}`,
      特性B: `${secondName}：${secondDescription}`,
      卡图: `platform-resources/package/${encodeURIComponent(portraitId)}.webp`,
      卡牌显示方式: mode,
    },
    resourceCopy,
  };
}
