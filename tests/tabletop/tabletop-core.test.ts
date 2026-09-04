import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  clampTabletopPosition,
  createTabletopDocument,
  executeTabletopCommand,
  executeTemplateStateCommand,
  type TabletopCapability,
  type TabletopInstanceResourceCopy,
  type TemplateStateCommandDefinition,
} from "@pbdh/tabletop/core";
import { TabletopSurface } from "@pbdh/tabletop/react";

const allCapabilities = new Set<TabletopCapability>([
  "place",
  "move",
  "uniform-scale",
  "rotate",
  "flip",
  "layer",
  "arrange",
  "clear",
  "duplicate",
  "delete",
  "replace",
  "edit-instance-data",
  "template-state-command",
]);

const resource: TabletopInstanceResourceCopy = {
  source: { packageId: "package-1", resourceId: "minotaur" },
  template: { id: "敌人", version: "1.0.0" },
  presentation: { mode: "split", fixedRatio: true },
  data: { 名称: "牛头人破坏者", 生命点: "7" },
  labels: ["敌人"],
  replacements: [{ replacementId: "alternate-form", targetResourceId: "minotaur-rage" }],
  media: { portrait: "sha256:portrait" },
};

const templateCommands: TemplateStateCommandDefinition[] = [
  { id: "adjust-hp", capability: "adjust-decimal-string", field: "currentHp" },
  { id: "set-notes", capability: "set-string", field: "notes" },
];

test("Creator 状态模拟与桌面共用同一状态命令处理", () => {
  const source = { currentHp: "7", notes: "" };
  const adjusted = executeTemplateStateCommand(source, templateCommands[0], "adjust-hp", "-2");
  expect(adjusted).toEqual({ state: { currentHp: "5", notes: "" }, diagnostic: null });
  expect(source).toEqual({ currentHp: "7", notes: "" });

  const noted = executeTemplateStateCommand(adjusted.state, templateCommands[1], "set-notes", "角部受伤");
  expect(noted.state.notes).toBe("角部受伤");
});

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
  test("can keep the whole card inside finite tabletop bounds", () => {
    expect(clampTabletopPosition(
      { resource, scale: 1, rotation: 0 },
      { width: 2400, height: 1600, containment: "full" },
      { x: -1000, y: -1000 },
    )).toEqual({ x: 0, y: 0 });
  });

  test("each placement owns a deep independent resource copy and runtime state", () => {
    const first = place();
    const second = place(first, "enemy-2");
    const edited = executeTabletopCommand(second, {
      type: "edit-instance-data",
      instanceId: "enemy-1",
      path: ["名称"],
      value: "伤痕牛头人",
    }, {
      capabilities: allCapabilities,
    }).document;

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

  test("replaces one instance atomically while keeping only its geometry", () => {
    const document = place();
    document.instances[0]!.rotation = 18;
    document.instances[0]!.flipped = true;
    document.instances[0]!.scale = 1.4;
    const target: TabletopInstanceResourceCopy = {
      ...structuredClone(resource),
      source: { packageId: "package-1", resourceId: "minotaur-rage" },
      data: { 名称: "狂暴牛头人", 生命点: "9" },
      replacements: [{ replacementId: "alternate-form", targetResourceId: "minotaur" }],
      media: {},
    };
    const result = executeTabletopCommand(document, {
      type: "replace",
      instanceId: "enemy-1",
      newInstanceId: "enemy-rage",
      replacementId: "alternate-form",
      resource: target,
      state: { currentHp: "9", notes: "" },
    }, { capabilities: allCapabilities });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.instances).toEqual([expect.objectContaining({
      id: "enemy-rage",
      position: { x: 120, y: 80 },
      layer: 0,
      rotation: 18,
      flipped: false,
      scale: 1.4,
      state: { currentHp: "9", notes: "" },
    })]);
    expect(result.document.instances[0]?.resource.data.名称).toBe("狂暴牛头人");
  });

  test("keeps the original instance when a replacement target does not match", () => {
    const document = place();
    const result = executeTabletopCommand(document, {
      type: "replace",
      instanceId: "enemy-1",
      newInstanceId: "enemy-wrong",
      replacementId: "alternate-form",
      resource: { ...structuredClone(resource), source: { packageId: "package-1", resourceId: "wrong" } },
      state: {},
    }, { capabilities: allCapabilities });
    expect(result.document).toBe(document);
    expect(result.diagnostics[0]?.code).toBe("tabletop.replacement.target-mismatch");
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

    const invalidValue = executeTabletopCommand(document, {
      type: "template-state",
      instanceId: "enemy-1",
      commandId: "set-focused",
      value: "maybe",
    }, {
      capabilities: allCapabilities,
      templateCommands: () => [{
        id: "set-focused",
        capability: "set-string",
        field: "focused",
        values: ["true", "false"],
      }],
    });
    expect(invalidValue.document).toBe(document);
    expect(invalidValue.diagnostics[0]?.code).toBe("tabletop.state.value-not-allowed");
  });

  test("moves a multi-selection atomically with one explicit command", () => {
    const document = place(place(), "enemy-2");
    const moved = executeTabletopCommand(document, {
      type: "move-many",
      moves: [
        { instanceId: "enemy-1", position: { x: 20, y: 30 } },
        { instanceId: "enemy-2", position: { x: 44, y: 54 } },
      ],
    }, { capabilities: allCapabilities });
    expect(moved.diagnostics).toEqual([]);
    expect(moved.document.instances.map((instance) => instance.position)).toEqual([
      { x: 20, y: 30 },
      { x: 44, y: 54 },
    ]);

    const rejected = executeTabletopCommand(document, {
      type: "move-many",
      moves: [
        { instanceId: "enemy-1", position: { x: 1, y: 2 } },
        { instanceId: "missing", position: { x: 3, y: 4 } },
      ],
    }, { capabilities: allCapabilities });
    expect(rejected.document).toBe(document);
    expect(rejected.diagnostics[0]?.code).toBe("tabletop.instance.not-found");
  });

  test("shares rotation, flip, layer, arrange and clear as guarded commands", () => {
    let document = place(place(), "enemy-2");
    document = executeTabletopCommand(document, {
      type: "rotate-quarter", instanceId: "enemy-1", quarterTurns: 1,
    }, { capabilities: allCapabilities }).document;
    document = executeTabletopCommand(document, {
      type: "flip", instanceId: "enemy-1",
    }, { capabilities: allCapabilities }).document;
    document = executeTabletopCommand(document, {
      type: "layer", instanceId: "enemy-1", action: "front",
    }, { capabilities: allCapabilities }).document;
    expect(document.instances.find((item) => item.id === "enemy-1")).toMatchObject({
      rotation: 90,
      flipped: true,
      layer: 1,
    });

    document = executeTabletopCommand(document, {
      type: "arrange",
      placements: [
        { instanceId: "enemy-1", position: { x: 16, y: 16 }, layer: 0, rotation: 0 },
        { instanceId: "enemy-2", position: { x: 160, y: 16 }, layer: 1, rotation: 0 },
      ],
    }, { capabilities: allCapabilities }).document;
    expect(document.instances.map((item) => ({ position: item.position, layer: item.layer, rotation: item.rotation }))).toEqual([
      { position: { x: 16, y: 16 }, layer: 0, rotation: 0 },
      { position: { x: 160, y: 16 }, layer: 1, rotation: 0 },
    ]);

    document = executeTabletopCommand(document, { type: "clear" }, { capabilities: allCapabilities }).document;
    expect(document.instances).toEqual([]);
    expect(document.assets).toEqual([]);
  });

  test("deletes an explicit multi-selection atomically", () => {
    const document = place(place(), "enemy-2");
    const deleted = executeTabletopCommand(document, {
      type: "delete-many", instanceIds: ["enemy-1", "enemy-2"],
    }, { capabilities: allCapabilities });
    expect(deleted.diagnostics).toEqual([]);
    expect(deleted.document.instances).toEqual([]);

    const rejected = executeTabletopCommand(document, {
      type: "delete-many", instanceIds: ["enemy-1", "missing"],
    }, { capabilities: allCapabilities });
    expect(rejected.document).toBe(document);
  });

  test("edits every instance data field by default", () => {
    const document = place();
    const renamed = executeTabletopCommand(document, {
      type: "edit-instance-data",
      instanceId: "enemy-1",
      path: ["名称"],
      value: "临时名称",
    }, { capabilities: allCapabilities });
    expect(renamed.document.instances[0]?.resource.data.名称).toBe("临时名称");
    expect(renamed.document.instances[0]?.resource.presentation).toEqual(resource.presentation);
    expect(document.instances[0]?.resource.data.名称).toBe("牛头人破坏者");

    const changed = executeTabletopCommand(document, {
      type: "edit-instance-data",
      instanceId: "enemy-1",
      path: ["生命点"],
      value: "99",
    }, { capabilities: allCapabilities });
    expect(changed.document.instances[0]?.resource.data.生命点).toBe("99");
    expect(changed.diagnostics).toEqual([]);

    const replacedFeatures = executeTabletopCommand(document, {
      type: "edit-instance-data",
      instanceId: "enemy-1",
      path: ["特性"],
      value: [{ 名称: "新特性", 描述: "可编辑结构化字段" }],
    }, { capabilities: allCapabilities });
    expect(replacedFeatures.document.instances[0]?.resource.data.特性).toEqual([
      { 名称: "新特性", 描述: "可编辑结构化字段" },
    ]);

    const replacedData = executeTabletopCommand(document, {
      type: "replace-instance-data",
      instanceId: "enemy-1",
      data: { 名称: "预设敌人", 特性: [{ 特性名称: "无情(X)" }] },
    }, { capabilities: allCapabilities });
    expect(replacedData.document.instances[0]?.resource.data).toEqual({
      名称: "预设敌人",
      特性: [{ 特性名称: "无情(X)" }],
    });
    expect(document.instances[0]?.resource.data).toEqual(resource.data);
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
      selectedInstanceIds: ["enemy-1"],
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
