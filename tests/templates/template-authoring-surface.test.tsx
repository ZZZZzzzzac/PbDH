import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { templateRegistry } from "@pbdh/templates/core";
import {
  TemplateAuthoringSurface,
  supportedTemplateFrontends,
} from "@pbdh/templates/frontend";
import {
  adversaryFeaturePresets,
  armorFeaturePresets,
  weaponFeaturePresets,
} from "../../packages/templates/src/frontend/feature-presets.ts";

const root = process.cwd();

describe("Template-owned authoring surfaces", () => {
  test("renders every exact Template through one authoring seam", () => {
    expect(supportedTemplateFrontends).toHaveLength(26);

    for (const frontend of supportedTemplateFrontends) {
      const template = templateRegistry.resolve(frontend.templateId, frontend.templateVersion);
      expect(template).toBeDefined();
      expect(frontend.authoring.templateId).toBe(frontend.templateId);
      expect(frontend.authoring.templateVersion).toBe(frontend.templateVersion);
      expect(frontend.authoring.Editor).toBeTypeOf("function");

      const markup = renderToStaticMarkup(<TemplateAuthoringSurface
        authoring={frontend.authoring}
        data={structuredClone(template!.defaultData) as Record<string, unknown>}
        onValue={() => undefined}
        onData={() => undefined}
      />);

      expect(markup).toContain(`data-template-authoring="${frontend.templateId}@${frontend.templateVersion}"`);
      expect(markup).toContain("<input");
    }
  });

  test("keeps Template identities and specialized editor commands out of Creator and GM hosts", () => {
    const sources = [
      "apps/creator/src/workspace-prototype/creator-workbench.tsx",
      "apps/creator/src/workspace-prototype/gm-tabletop-workbench.tsx",
      "apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx",
      "apps/creator/src/workspace-prototype/creator-dialogs.tsx",
      "apps/creator/src/workspace-prototype/resource-authoring.tsx",
      "apps/creator/src/workspace-prototype/resource-preview.tsx",
      "apps/creator/src/workspace-prototype/workspace-authoring.ts",
    ].map((file) => readFileSync(path.join(root, file), "utf8")).join("\n");

    for (const forbidden of [
      "adversaryTemplate",
      "weaponTemplate",
      "armorTemplate",
      "AdversaryEditor",
      "WeaponEditor",
      "ArmorEditor",
      'type: "adversary-field"',
      'type: "adversary-feature"',
      'type: "weapon-field"',
      'type: "armor-field"',
      'type: "add-feature"',
      'type: "clear-feature"',
      'type: "delete-feature"',
    ]) {
      expect(sources, forbidden).not.toContain(forbidden);
    }
  });

  test("offers reviewed repeated features as parameterized authoring presets", () => {
    expect(armorFeaturePresets).toHaveLength(7);
    expect(new Set(armorFeaturePresets.map((item) => item.original))).toHaveLength(6);
    expect(armorFeaturePresets.filter((item) => item.original === "Heavy").map((item) => item.name))
      .toEqual(["沉重", "极重"]);
    expect(weaponFeaturePresets).toHaveLength(22);
    expect(adversaryFeaturePresets).toHaveLength(10);

    for (const presets of [armorFeaturePresets, weaponFeaturePresets, adversaryFeaturePresets]) {
      expect(new Set(presets.map((item) => item.label))).toHaveLength(presets.length);
      for (const preset of presets) {
        expect(preset.label).not.toMatch(/[A-Za-z]/u);
        expect(preset.name).not.toBe("");
        expect(preset.original).not.toBe("");
        expect(preset.description).not.toBe("");
      }
    }

    expect(weaponFeaturePresets.find((item) => item.original === "Protective")?.description)
      .toContain("<+1/2/3/4>");
    expect(adversaryFeaturePresets.find((item) => item.original.startsWith("Relentless"))?.description)
      .toContain("<该敌人>");
    expect(adversaryFeaturePresets.find((item) => item.label === "无情")?.name).toBe("无情(X)");
    expect(adversaryFeaturePresets.find((item) => item.label === "杂兵")?.name).toBe("杂兵(X)");
    expect(adversaryFeaturePresets.find((item) => item.label === "集群")?.name).toBe("集群(X)");
    for (const preset of adversaryFeaturePresets) {
      expect(preset.description).not.toMatch(/<[^>]*\/[^>]*>/u);
    }
  });
});
