import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadPbres, writePbres } from "@pbdh/contract-runtime";
import { resourceConversionRegistry } from "@pbdh/resource-conversion";
import type { ResourceMediaNormalizer } from "@pbdh/resource-conversion";
import { trustedAuthoringFor, trustedRendererFor } from "@pbdh/templates/frontend";

import { materializeCreatorResourceConversion } from "../../apps/creator/src/workspace-prototype/materialize-resource-conversion.ts";
import { validateResourcePackageCandidate } from "../../apps/creator/src/workspace-prototype/resource-package-validator.ts";

describe("Creator third-party resource conversion", () => {
  it("binds every local dhsheet card image to its converted resource", async () => {
    const sourcePath = path.join(process.cwd(), "docs/third/与龙同行战役框架卡牌包.dhcb");
    const imported = await resourceConversionRegistry.import("dhsheet", {
      bytes: new Uint8Array(readFileSync(sourcePath)),
      fileName: path.basename(sourcePath),
      container: "dhcb",
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    let normalizationCalls = 0;
    const normalizeMedia: ResourceMediaNormalizer = async ({ bytes }) => {
      normalizationCalls += 1;
      const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
      const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
      return {
        id: `sha256:${hash}`,
        mediaType: "image/webp",
        byteLength: bytes.byteLength,
        width: 630,
        height: 450,
        bytes,
      };
    };
    const converted = await materializeCreatorResourceConversion(imported.batch, normalizeMedia);

    expect(normalizationCalls).toBe(159);
    expect(converted.candidate?.document.resources).toHaveLength(159);
    expect(converted.candidate?.document.assets).toHaveLength(141);
    expect(converted.candidate?.media.size).toBe(141);
    expect(converted.candidate?.document.assets.every((asset) => asset.mediaType === "image/webp" && asset.width === "630")).toBe(true);
    expect(converted.candidate?.document.resources.every((resource) => Boolean(resource.media.portrait))).toBe(true);
    expect(converted.candidate?.document.resources.every((resource) => resource.presentation.mode === "split")).toBe(true);
    expect(converted.diagnostics).toEqual([]);
    if (!converted.candidate) return;
    await expect(validateResourcePackageCandidate(
      converted.candidate.document,
      converted.candidate.media,
    )).resolves.toEqual([]);
    const roundTrip = await loadPbres(
      writePbres(converted.candidate.document, converted.candidate.media),
      validateResourcePackageCandidate,
    );
    expect(roundTrip.diagnostics).toEqual([]);
    expect(roundTrip.candidate?.document.resources.every((resource) => Boolean(resource.media.portrait))).toBe(true);
  });

  it("uses the shared adapter result to build a target-neutral pbres candidate", async () => {
    const imported = await resourceConversionRegistry.import("dhsheet", {
      bytes: new TextEncoder().encode(JSON.stringify({
        name: "工坊测试包",
        version: "1.2.3",
        profession: [],
        ancestry: [],
        community: [],
        subclass: [],
        domain: [],
        variant: [{
          id: "weapon-1",
          名称: "测试长剑",
          类型: "主武器",
          属性: "力量",
          距离: "近战",
          伤害: "d10",
          负荷: "双手",
          伤害类型: "物理",
          描述: "沉重",
          位阶: "1",
        }],
      })),
      fileName: "creator-test.json",
      container: "json",
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const converted = await materializeCreatorResourceConversion(imported.batch);

    expect(converted).toMatchObject({ converted: 1, skipped: 0 });
    expect(converted.candidate?.document.targets).toEqual([]);
    expect(converted.candidate?.document.package).toMatchObject({ name: "工坊测试包", version: "1.2.3" });
    expect(converted.candidate?.document.resources[0]).toMatchObject({
      template: { id: "武器" },
      data: { 名称: "测试长剑" },
    });
    expect(converted.candidate).not.toBeNull();
    if (!converted.candidate) return;
    await expect(validateResourcePackageCandidate(
      converted.candidate.document,
      converted.candidate.media,
    )).resolves.toEqual([]);

    const roundTrip = await loadPbres(
      writePbres(converted.candidate.document, converted.candidate.media),
      validateResourcePackageCandidate,
    );
    expect(roundTrip.candidate?.document.package.id).toBe(converted.candidate.document.package.id);
  });

  it("materializes imported weapons with matching editing and rendering support", async () => {
    const imported = await resourceConversionRegistry.import("dhsheet", {
      bytes: new TextEncoder().encode(JSON.stringify({
        format: "daggerheart.equipment-pack.v1",
        name: "装备测试包",
        version: "1.0.0",
        equipment: {
          weapons: [{
            id: "weapon-cleaver",
            name: "砍刀",
            tier: "T1",
            weaponType: "primary",
            trait: "agility",
            range: "melee",
            damage: "d8",
            burden: "oneHanded",
            damageType: "physical",
            featureName: "可靠",
            description: "你的攻击掷骰+1。",
          }],
          armor: [],
        },
      })),
      fileName: "equipment-pack.json",
      container: "json",
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const converted = await materializeCreatorResourceConversion(imported.batch);
    const weapon = converted.candidate?.document.resources[0];

    expect(weapon?.template).toEqual({ id: "武器", version: "1.0.1" });
    expect(trustedAuthoringFor(weapon!.template.id, weapon!.template.version)).toBeDefined();
    expect(trustedRendererFor(weapon!.template.id, weapon!.template.version)).toBeDefined();
  });

  it("upgrades old pbres Template versions before Creator can export them", async () => {
    const bytes = new Uint8Array(readFileSync(path.join(
      process.cwd(),
      "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.pbres",
    )));
    const imported = await resourceConversionRegistry.import("pbres", {
      bytes,
      fileName: "legacy.pbres",
      container: "pbres",
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const converted = await materializeCreatorResourceConversion(imported.batch);

    expect(converted.candidate?.document.resources.map((resource) => resource.template)).toEqual([
      { id: "敌人", version: "1.0.1" },
    ]);
    expect(converted.candidate).not.toBeNull();
    if (!converted.candidate) return;
    const exported = await loadPbres(
      writePbres(converted.candidate.document, converted.candidate.media),
      validateResourcePackageCandidate,
    );
    expect(exported.candidate?.document.resources[0]?.template).toEqual({ id: "敌人", version: "1.0.1" });
  });
});
