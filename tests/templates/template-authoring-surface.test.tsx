import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { templateRegistry } from "@pbdh/templates/core";
import {
  TemplateAuthoringSurface,
  supportedTemplateFrontends,
} from "@pbdh/templates/frontend";

const root = process.cwd();

describe("Template-owned authoring surfaces", () => {
  test("renders every exact Template through one authoring seam", () => {
    expect(supportedTemplateFrontends).toHaveLength(11);

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
});
