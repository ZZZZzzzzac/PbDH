import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  createTabletopDocument,
  executeTabletopCommand,
  type TabletopCapability,
  type TabletopInstanceResourceCopy,
  type TemplateStateCommandDefinition,
} from "@pbdh/tabletop/core";
import { TabletopSurface } from "@pbdh/tabletop/react";

const allCapabilities = new Set<TabletopCapability>([
  "place",
  "move",
  "uniform-scale",
  "duplicate",
  "delete",
  "edit-instance-resource",
  "template-state-command",
]);

const resource: TabletopInstanceResourceCopy = {
  source: { packageId: "package-1", resourceId: "minotaur" },
  template: { id: "敌人", version: "1.0.0-alpha.1" },
  presentation: { width: "90", height: "142", unit: "mm", mode: "split", fixedRatio: true },
  data: { 名称: "牛头人破坏者", 生命点: "7" },
  labels: ["敌人"],
  media: { portrait: "sha256:portrait" },
};

const templateCommands: TemplateStateCommandDefinition[] = [
  { id: "adjust-hp", capability: "adjust-decimal-string", field: "currentHp" },
  { id: "set-notes", capability: "set-string", field: "notes" },
];

function place(document = createTabletopDocument("table-1", "第一幕"), instanceId = "enemy-1") {
  return executeTabletopCommand(document, {
    type: "place",
    instanceId,
    resource,
    state: { currentHp: "7", notes: "" },
    position: { x: 120, y: 80 },
  }, { capabilities: allCapabilities }).document;
}

describe("Tabletop Core", () => {
  test("each placement owns a deep independent resource copy and runtime state", () => {
    const first = place();
    const second = place(first, "enemy-2");
    const edited = executeTabletopCommand(second, {
      type: "replace-instance-resource",
      instanceId: "enemy-1",
      resource: {
        presentation: resource.presentation,
        data: { ...resource.data, 名称: "伤痕牛头人" },
        labels: resource.labels,
        media: resource.media,
      },
    }, { capabilities: allCapabilities }).document;

    expect(edited.instances[0]?.resource.data.名称).toBe("伤痕牛头人");
    expect(edited.instances[1]?.resource.data.名称).toBe("牛头人破坏者");
    expect(resource.data.名称).toBe("牛头人破坏者");
    expect(edited.instances[0]?.resource).not.toBe(edited.instances[1]?.resource);
  });

  test("workspace-like source changes never refresh an existing instance", () => {
    const document = place();
    resource.data.名称 = "来源新版";
    expect(document.instances[0]?.resource.data.名称).toBe("牛头人破坏者");
    resource.data.名称 = "牛头人破坏者";
  });

  test("duplicates current private definition and state, then keeps both independent", () => {
    const source = executeTabletopCommand(place(), {
      type: "template-state",
      instanceId: "enemy-1",
      commandId: "adjust-hp",
      value: "-2.5",
    }, { capabilities: allCapabilities, templateCommands: () => templateCommands }).document;
    const duplicated = executeTabletopCommand(source, {
      type: "duplicate",
      instanceId: "enemy-1",
      newInstanceId: "enemy-2",
    }, { capabilities: allCapabilities }).document;

    expect(duplicated.instances[1]).toMatchObject({
      id: "enemy-2",
      position: { x: 144, y: 104 },
      state: { currentHp: "4.5" },
    });
    duplicated.instances[0]!.state.currentHp = "1";
    expect(duplicated.instances[1]?.state.currentHp).toBe("4.5");
  });

  test("requires both host capability and exact Template command declaration", () => {
    const document = place();
    const denied = executeTabletopCommand(document, {
      type: "template-state",
      instanceId: "enemy-1",
      commandId: "adjust-hp",
      value: "-1",
    }, { capabilities: new Set() });
    expect(denied.document).toBe(document);
    expect(denied.diagnostics[0]?.code).toBe("tabletop.capability.denied");

    const undeclared = executeTabletopCommand(document, {
      type: "template-state",
      instanceId: "enemy-1",
      commandId: "host-invented-command",
      value: "-1",
    }, { capabilities: allCapabilities, templateCommands: () => templateCommands });
    expect(undeclared.document).toBe(document);
    expect(undeclared.diagnostics[0]?.code).toBe("tabletop.template-command.unsupported");
  });

  test("rejects invalid commands with stable diagnostics and zero writes", () => {
    const document = place();
    const scaled = executeTabletopCommand(document, {
      type: "uniform-scale",
      instanceId: "enemy-1",
      scale: 0,
    }, { capabilities: allCapabilities });
    expect(scaled.document).toBe(document);
    expect(scaled.diagnostics).toEqual([expect.objectContaining({
      code: "tabletop.scale.invalid",
      location: "/command/scale",
    })]);

    const missing = executeTabletopCommand(document, {
      type: "delete",
      instanceId: "missing",
    }, { capabilities: allCapabilities });
    expect(missing.document).toBe(document);
    expect(missing.diagnostics[0]?.code).toBe("tabletop.instance.not-found");
  });

  test("React Surface consumes the same capability set for selection and scale controls", () => {
    const markup = renderToStaticMarkup(createElement(TabletopSurface, {
      document: place(),
      capabilities: allCapabilities,
      selectedInstanceId: "enemy-1",
      renderInstance: () => createElement("span", null, "规范卡面"),
      onSelect: () => undefined,
      onCommand: () => undefined,
    }));
    expect(markup).toContain("data-tabletop-instance-id=\"enemy-1\"");
    expect(markup).toContain("class=\"tabletop-instance is-selected\"");
    expect(markup).toContain("aria-label=\"等比缩放\"");

    const deniedMarkup = renderToStaticMarkup(createElement(TabletopSurface, {
      document: place(),
      capabilities: new Set<TabletopCapability>(),
      selectedInstanceId: "enemy-1",
      renderInstance: () => createElement("span", null, "规范卡面"),
      onSelect: () => undefined,
      onCommand: () => undefined,
    }));
    expect(deniedMarkup).not.toContain("aria-label=\"等比缩放\"");
  });
});
