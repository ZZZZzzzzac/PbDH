import { describe, expect, it } from "vitest";

import { resourceConversionRegistry } from "@pbdh/resource-conversion";
import type { SystemPackageDocument } from "@pbdh/contract-runtime";

import systemJson from "../../apps/player/src/daggerheart-core-system.generated.json";
import { materializePlayerResourceConversion } from "../../apps/player/src/resources/materialize-resource-conversion.ts";
import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";

describe("Player third-party resource conversion", () => {
  it("先保留逐记录报告，再生成可验证、可安装和可导出的标准资源包", async () => {
    const imported = await resourceConversionRegistry.import("rinkcx", {
      bytes: new TextEncoder().encode(JSON.stringify({
        name: "夜巡者",
        rank: "1",
        type: "潜行者",
        health: "4",
        threshold: "7/13",
      })),
      fileName: "night-watch.json",
      container: "json",
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const result = await materializePlayerResourceConversion(
      imported.batch,
      systemJson as SystemPackageDocument,
    );

    expect(result).toMatchObject({ converted: 1, skipped: 0, candidate: { document: { package: { version: "1.0.0" } } } });
    expect(result.candidate?.document.targets).toEqual([{
      systemPackageId: (systemJson as SystemPackageDocument).package.id,
      version: (systemJson as SystemPackageDocument).package.version,
    }]);
    expect(result.candidate?.document.resources[0]).toMatchObject({
      template: { id: "敌人", version: "1.0.3" },
      data: { 名称: "夜巡者" },
      media: {},
    });
    expect(result.candidate).not.toBeNull();
    if (result.candidate) {
      await expect(validateResourcePackageCandidate(result.candidate.document, result.candidate.media)).resolves.toEqual([]);
    }
  });

  it("把 dhsheet 未知 variant 明确降级为自由卡，而不是让整包导入失败", async () => {
    const imported = await resourceConversionRegistry.import("dhsheet", {
      bytes: new TextEncoder().encode(JSON.stringify({
        name: "疯狂机制扩展包",
        variant: [{
          id: "madness-01",
          名称: "疯狂机制说明",
          类型: "疯狂",
          效果: "承受压力时检定。",
          子类别: "规则说明",
          简略信息: "疯狂规则",
          imageUrl: "",
        }],
      })),
      fileName: "madness.json",
      container: "json",
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const result = await materializePlayerResourceConversion(
      imported.batch,
      systemJson as SystemPackageDocument,
    );

    expect(result).toMatchObject({ converted: 1, skipped: 0 });
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({
      code: "player.resource-conversion.unmapped",
    }));
    expect(result.candidate?.document.resources[0]).toMatchObject({
      template: { id: "自由", version: "1.0.2" },
      data: {
        名称: "疯狂机制说明",
        类型: "疯狂",
        子类别: "规则说明",
        疯狂规则: "",
        内容: [
          { 名称: "效果", 原文: "", 描述: "承受压力时检定。" },
        ],
      },
    });
  });

  it("把 dhsheet 对象型简略信息转换为自由字段，而不是 JSON 自由特性", async () => {
    const imported = await resourceConversionRegistry.import("dhsheet", {
      bytes: new TextEncoder().encode(JSON.stringify({
        name: "裁决之剑额外卡牌包",
        variant: [{
          id: "creed-01",
          名称: "奉献准则",
          类型: "圣道准则",
          效果: "坚守诚实本心。",
          子类别: "",
          简略信息: {
            item1: "圣道骑士",
            item2: "准则",
            item3: "",
            item4: "",
          },
        }],
      })),
      fileName: "creed.json",
      container: "json",
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const result = await materializePlayerResourceConversion(
      imported.batch,
      systemJson as SystemPackageDocument,
    );

    expect(result.candidate?.document.resources[0]).toMatchObject({
      template: { id: "自由", version: "1.0.2" },
      data: {
        名称: "奉献准则",
        类型: "圣道准则",
        圣道骑士: "",
        准则: "",
        内容: [{ 名称: "效果", 原文: "", 描述: "坚守诚实本心。" }],
      },
    });
  });
});
