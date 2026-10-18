import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { strFromU8 } from "fflate";
import { writePbres } from "@pbdh/contract-runtime";
import { currentTemplates } from "@pbdh/templates/core";

import { exportMarketPublication, marketExportTargets } from "../../apps/market/src/market-export.ts";
import { addTemplateResource, createBlankWorkspace, prepareWorkspaceExport } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

const archive = new Uint8Array(readFileSync("contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.pbres"));
const publication = { id: "publication-export", archiveName: "download.pbres", author: "市场作者" };
const target = (id: string) => marketExportTargets.find((item) => item.id === id)!;

describe("Market third-party export", () => {
  it.each(["dhsheet-cards", "zzz", "rinkcx", "kid"])("exports the complete public archive as %s without an App handoff", async (id) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(archive));
    const result = await exportMarketPublication(publication, target(id), null, fetcher);
    expect(result.ok, JSON.stringify(result.report)).toBe(true);
    expect(result.report.converted).toBe(1);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]![0]).toBe("/api/publications/publication-export/download");
    expect(new Headers(fetcher.mock.calls[0]![1]!.headers).has("Authorization")).toBe(false);
    if (result.ok && id === "zzz") {
      expect(JSON.parse(strFromU8(result.artifact.bytes))).toEqual([expect.objectContaining({ 名称: "牛头人破坏者" })]);
    }
  });

  it("distinguishes cards and equipment, uses archive metadata and reports skipped resources", async () => {
    const template = currentTemplates.find((item) => item.id === "武器")!;
    let workspace = addTemplateResource(await createBlankWorkspace("完整装备包"), template).workspace;
    workspace.document.resources[0]!.data = {
      ...template.defaultData, 名称: "验收长剑", 类型: "主武器", 属性: "敏捷", 距离: "近战",
      伤害: "d8+1", 负荷: "单手", 伤害类型: "物理", 位阶: "1",
    };
    workspace = addTemplateResource(workspace, template).workspace;
    workspace.document.resources[1]!.data = { ...workspace.document.resources[0]!.data, 名称: "奥术框架轮椅", 属性: "施法属性" };
    const prepared = await prepareWorkspaceExport(workspace);
    const bytes = writePbres(prepared.document, prepared.media);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(new Uint8Array(bytes)));
    const cards = await exportMarketPublication(publication, target("dhsheet-cards"), null, fetcher);
    const equipment = await exportMarketPublication(publication, target("dhsheet-equipment"), null, fetcher);
    if (!cards.ok || !equipment.ok) throw new Error(JSON.stringify({ cards, equipment }));
    expect(JSON.parse(strFromU8(cards.artifact.bytes)).variant).toHaveLength(2);
    expect(JSON.parse(strFromU8(equipment.artifact.bytes))).toMatchObject({
      format: "daggerheart.equipment-pack.v1", name: "完整装备包", author: "市场作者",
      equipment: { weapons: [{ name: "验收长剑" }] },
    });
    expect(equipment.report.diagnostics).toContainEqual(expect.objectContaining({ code: "dhsheet.equipment.invalid", severity: "warning" }));
    expect(equipment.report.converted).toBe(1);
  });

  it("returns conversion failure without an artifact for unsupported content", async () => {
    const result = await exportMarketPublication(publication, target("dhsheet-equipment"), null, vi.fn<typeof fetch>().mockResolvedValue(new Response(archive)));
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("artifact");
    expect(result.report.diagnostics.length).toBeGreaterThan(0);
  });

  it("rejects corrupt archives and propagates download failures", async () => {
    const result = await exportMarketPublication(publication, target("zzz"), null, vi.fn<typeof fetch>().mockResolvedValue(new Response("broken")));
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("artifact");
    await expect(exportMarketPublication(publication, target("zzz"), null, vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 })))).rejects.toThrow("无法下载该资源包");
  });
});
