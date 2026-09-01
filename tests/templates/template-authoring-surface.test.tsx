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
      expect(frontend.authoring.layout.templateId).toBe(frontend.templateId);
      expect(frontend.authoring.layout.templateVersion).toBe(frontend.templateVersion);
      for (const control of frontend.authoring.previewControls) {
        expect(template!.tabletop.commands.some((command) => command.id === control.commandId), `${frontend.templateId}/${control.commandId}`).toBe(true);
      }

      const markup = renderToStaticMarkup(<TemplateAuthoringSurface
        authoring={frontend.authoring}
        data={structuredClone(template!.defaultData) as Record<string, unknown>}
        onValue={() => undefined}
      />);

      expect(markup).toContain(`data-template-authoring="${frontend.templateId}@${frontend.templateVersion}"`);
      for (const section of frontend.authoring.layout.sections) {
        expect(section.columns, `${frontend.templateId}/${section.id}`).toBeGreaterThan(0);
        expect(markup).toContain(`data-authoring-section="${section.id}"`);
        for (const repeat of section.repeats ?? []) {
          expect(repeat.columns, `${frontend.templateId}/${repeat.path}`).toBeGreaterThan(0);
          expect(Object.keys(repeat.itemDefaults).sort()).toEqual(repeat.itemFields.map((field) => field.path).sort());
        }
      }
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
