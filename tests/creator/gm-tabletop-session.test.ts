import { readFileSync } from "node:fs";

import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { createTabletopDocument } from "@pbdh/tabletop/core";
import { describe, expect, test, vi } from "vitest";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import {
  arrangeGmTabletop,
  executeGmTabletopCommand,
  placeWorkspaceResourcesOnTabletop,
  selectTabletopInstances,
} from "../../apps/creator/src/workspace-prototype/gm-tabletop-session.ts";
import { createWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

const document = minotaurPackage as unknown as ResourcePackageLogicalDocument;
const asset = document.assets[0]!;
const bytes = new Uint8Array(readFileSync(new URL(
  `../../contracts/conformance/resource-package/1.0.0/media/${asset.id.replace("sha256:", "")}.webp`,
  import.meta.url,
)));
const workspace = createWorkspace({ document, media: new Map([[asset.id, bytes]]) });

describe("GM Tabletop session", () => {
  test("几何命令不读取模板能力，状态命令只使用显式注入的定义", () => {
    const empty = createTabletopDocument("00000000-0000-7000-8000-000000000001", "测试桌面");
    const placed = placeWorkspaceResourcesOnTabletop(empty, [workspace], [{ workspaceKey: workspace.key, resourceId: document.resources[0]!.id }]);
    if (!placed.ok) throw new Error(placed.error);
    const instanceId = placed.tabletop.instances[0]!.id;
    const definitions = vi.fn(() => [{ id: "test", capability: "set-string" as const, field: "value", values: ["测试"] }]);
    expect(executeGmTabletopCommand(placed.tabletop, { type: "move", instanceId, position: { x: 100, y: 100 } }, definitions).ok).toBe(true);
    expect(definitions).not.toHaveBeenCalled();
    const command = { type: "template-state" as const, instanceId, commandId: "test", value: "测试" };
    expect(executeGmTabletopCommand(placed.tabletop, command).ok).toBe(false);
    const result = executeGmTabletopCommand(placed.tabletop, command, definitions);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tabletop.instances[0]!.state.value).toBe("测试");
    expect(definitions).toHaveBeenCalledOnce();
    expect(placed.tabletop.instances[0]!.state.value).not.toBe("测试");
  });
  test("keeps multi-selection rules behind one deterministic interface", () => {
    expect(selectTabletopInstances(["a"], "b", "replace")).toEqual(["b"]);
    expect(selectTabletopInstances(["a"], "b", "add")).toEqual(["a", "b"]);
    expect(selectTabletopInstances(["a", "b"], "a", "toggle")).toEqual(["b"]);
    expect(selectTabletopInstances(["a"], "a", "add")).toEqual(["a"]);
  });

  test("places a batch atomically with independent resource copies and required media", () => {
    const tabletop = createTabletopDocument("00000000-0000-7000-8000-000000000001", "测试桌面");
    let sequence = 1;
    const result = placeWorkspaceResourcesOnTabletop(
      tabletop,
      [workspace],
      [
        { workspaceKey: workspace.key, resourceId: document.resources[0]!.id },
        { workspaceKey: workspace.key, resourceId: document.resources[0]!.id },
      ],
      undefined,
      () => `00000000-0000-7000-8000-${String(sequence++).padStart(12, "0")}`,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tabletop.instances).toHaveLength(2);
    expect(result.selectedInstanceIds).toEqual([
      "00000000-0000-7000-8000-000000000001",
      "00000000-0000-7000-8000-000000000002",
    ]);
    expect(result.tabletop.instances[0]!.resource).not.toBe(result.tabletop.instances[1]!.resource);
    expect(result.media?.get(asset.id)).toEqual(bytes);
    expect(tabletop.instances).toEqual([]);
  });

  test("leaves the tabletop untouched when any item in a placement batch is invalid", () => {
    const tabletop = createTabletopDocument("00000000-0000-7000-8000-000000000010", "测试桌面");
    const result = placeWorkspaceResourcesOnTabletop(tabletop, [workspace], [
      { workspaceKey: workspace.key, resourceId: document.resources[0]!.id },
      { workspaceKey: workspace.key, resourceId: "missing" },
    ]);

    expect(result).toMatchObject({ ok: false, error: "找不到要放置的资源" });
    expect(tabletop.instances).toEqual([]);
  });

  test("arranges cards through the same session command and expands the canvas only when needed", () => {
    const tabletop = createTabletopDocument("00000000-0000-7000-8000-000000000020", "整理桌面");
    let sequence = 1;
    const placed = placeWorkspaceResourcesOnTabletop(
      tabletop,
      [workspace],
      Array.from({ length: 5 }, () => ({ workspaceKey: workspace.key, resourceId: document.resources[0]!.id })),
      undefined,
      () => `00000000-0000-7000-8000-${String(sequence++).padStart(12, "0")}`,
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    const arranged = arrangeGmTabletop(placed.tabletop, 620);
    expect(arranged.ok).toBe(true);
    if (!arranged.ok) return;
    expect(new Set(arranged.tabletop.instances.map((instance) => `${instance.position.x}:${instance.position.y}`)).size).toBe(5);
    expect(arranged.tabletop.instances.map((instance) => instance.layer)).toEqual([0, 1, 2, 3, 4]);
  });
});
