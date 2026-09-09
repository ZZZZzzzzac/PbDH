import { readFileSync } from "node:fs";
import { currentTemplates } from "@pbdh/templates/core";
import { describe, expect, it } from "vitest";
import { mapBatchToRegisteredCandidates, createResourceConversionRegistry, createPbresCandidateValidator } from "../../packages/resource-conversion/src/index.ts";
import { loadTemplateCore } from "@pbdh/templates/core/lazy";
import { namedFeature, namedFeatures } from "../../packages/resource-conversion/src/shared.ts";

describe("Markdown headings inside third-party feature strings", () => {
  const resourceConversionRegistry = createResourceConversionRegistry(createPbresCandidateValidator(loadTemplateCore));
  it.each(["*__名称：__*", "**名称：**", "***名称：***", "__名称：__"])("consumes the entire %s heading", (heading) => {
    expect(namedFeature(`${heading}**正文**`)).toEqual({ 名称: "名称", 描述: "**正文**" });
  });

  it("keeps unmarked introductory text instead of dropping it", () => {
    const value = "介绍文字\n\n*__名称：__*正文";
    expect(namedFeatures(value)).toEqual([{ 特性名称: "", 特性原文: "", 特性描述: value }]);
  });

  it("converts the Xiashi record extracted from 九州志异1.5（猫猫头卡包）.dhcb", async () => {
    const imported = await resourceConversionRegistry.import("dhsheet", {
      fileName: "jiuzhou-xiashi.json",
      bytes: new Uint8Array(readFileSync("tests/resource-conversion/fixtures/jiuzhou-xiashi.json")),
    });
    if (!imported.ok) throw new Error(JSON.stringify(imported.report));
    const mapped = mapBatchToRegisteredCandidates(imported.batch.resources, currentTemplates);
    const xiashi = mapped.candidates.find((candidate) => candidate.data.名称 === "侠士")!;
    expect(xiashi.diagnostics).toEqual([]);
    expect(xiashi.data.希望特性).toMatchObject({ 特性名称: "内力冲穴", 特性描述: "花费3希望点，解除一个影响你的状态。" });
    expect(xiashi.data.特性).toEqual([
      { 特性名称: "轻侠胆色", 特性原文: "", 特性描述: expect.stringContaining("- 立刻解决你产生造成的麻烦") },
      { 特性名称: "独门绝学", 特性原文: "", 特性描述: "你掌握一种独门绝学，一项符合该绝学的经历获得+1加值。" },
    ]);
    expect(JSON.stringify(xiashi.data)).not.toContain("__");
  });
});
