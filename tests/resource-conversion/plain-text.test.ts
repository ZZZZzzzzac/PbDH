import { describe, expect, it } from "vitest";
import { mapTemporaryResourceToCandidate as mapWithTemplates } from "../../packages/resource-conversion/src/index.ts";
import { currentTemplates } from "@pbdh/templates/core";
import { markdownToPlainText } from "../../packages/resource-conversion/src/plain-text.ts";
import type { ResourceFormatId, TemporaryResource } from "../../packages/resource-conversion/src/types.ts";
const mapTemporaryResourceToCandidate = (resource: TemporaryResource) => mapWithTemplates(resource, currentTemplates);

describe("third-party plain text fields", () => {
  it.each(["近距离范围", "近距离", "极远距离范围", "", " **近距离范围** "])("normalizes weapon range %s", (range) => {
    const source: TemporaryResource = {
      sourceId: "weapon", kind: "weapon", name: "长弓", fields: { 距离: range, 特性描述: "攻击近距离范围内的目标。" },
      source: { formatId: "zzz", upstreamRevision: "test", path: "weapon", raw: {} },
    };
    const candidate = mapTemporaryResourceToCandidate(source)!;
    expect(candidate.data.距离).toBe(range.replaceAll("范围", "").replaceAll("**", "").trim());
    expect(candidate.data.特性描述).toBe("攻击近距离范围内的目标。");
    expect(source.fields.距离).toBe(range);
    expect(mapTemporaryResourceToCandidate({ ...source, source: { ...source.source, formatId: "pbres" } })!.data.距离).toBe(range);
  });

  it.each<ResourceFormatId>(["zzz", "kid", "rinkcx", "dhsheet"])("normalizes %s only at PBRES mapping", (formatId) => {
    const source: TemporaryResource = {
      sourceId: "enemy", kind: "adversary", name: "**牛头人**",
      fields: { 特性: [{ 特性名称: "***冲撞***", 特性原文: "_Charge_", 特性类型: "**动作**", 特性描述: "**标记 1 压力点**。" }] },
      source: { formatId, upstreamRevision: "test", path: "enemy", raw: {} },
    };
    const candidate = mapTemporaryResourceToCandidate(source)!;
    expect(candidate.diagnostics).toEqual([]);
    expect(candidate.data).toMatchObject({ 名称: "牛头人", 特性: [{ 特性名称: "冲撞", 特性原文: "Charge", 特性类型: "动作", 特性描述: "**标记 1 压力点**。" }] });
    expect(source.name).toBe("**牛头人**");
    expect(mapTemporaryResourceToCandidate({ ...source, source: { ...source.source, formatId: "pbres" } })!.data.名称).toBe("**牛头人**");
  });

  it("preserves supported Markdown and normalizes nested free titles", () => {
    const source = (kind: TemporaryResource["kind"], fields: TemporaryResource["fields"]): TemporaryResource => ({
      sourceId: "resource", kind, name: "**名称**", fields,
      source: { formatId: "zzz", upstreamRevision: "test", path: "resource", raw: {} },
    });
    for (const kind of ["weapon", "armor"] as const) {
      expect(mapTemporaryResourceToCandidate(source(kind, { 特性名称: "**坚固**" }))!.data.特性名称).toBe("**坚固**");
    }
    expect(mapTemporaryResourceToCandidate(source("free", { 内容: [{ 名称: "**标题**", 原文: "*Title*", 描述: "**正文**" }] }))!.data.内容)
      .toEqual([{ 名称: "标题", 原文: "Title", 描述: "**正文**" }]);
  });

  it.each([
    ["**强力**与*迅捷*", "强力与迅捷"],
    ["# [冲撞](https://example.com)", "冲撞"],
    ["~~旧名~~ `新名`", "旧名 新名"],
    ["snake_case 和 2 * 3，+2，1d6", "snake_case 和 2 * 3，+2，1d6"],
  ])("converts %s without losing text", (input, expected) => {
    expect(markdownToPlainText(input)).toBe(expected);
  });
});
