import "fake-indexeddb/auto";

import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, test } from "vitest";

import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import {
  createTabletopDocument,
  executeTabletopCommand,
  type TabletopCapability,
} from "@pbdh/tabletop/core";
import { adversaryTemplate } from "@pbdh/templates/core";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import { createWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { snapshotWorkspaceResourceForTabletop } from "../../apps/creator/src/workspace-prototype/tabletop-placement.ts";
import { TabletopDocumentRepository } from "../../apps/creator/src/workspace-prototype/tabletop-document-repository.ts";

const databases: PbDHLocalDatabase[] = [];
const capabilities = new Set<TabletopCapability>([
  "place",
  "move",
  "uniform-scale",
  "template-state-command",
]);

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => {
    database.close();
    await database.delete();
  }));
});

describe("Market enemy handoff to local GM tabletop", () => {
  test("places a self-contained minotaur copy and restores commands independently of its Workspace", async () => {
    const assetId = minotaurPackage.assets[0]!.id;
    const bytes = new Uint8Array(await readFile(new URL(
      `../../contracts/conformance/resource-package/1.0.0/media/${assetId.slice("sha256:".length)}.webp`,
      import.meta.url,
    )));
    const workspace = createWorkspace({
      document: structuredClone(minotaurPackage) as ResourcePackageLogicalDocument,
      media: new Map([[assetId, bytes]]),
    });
    const resourceId = workspace.document.resources[0]!.id;
    const snapshot = snapshotWorkspaceResourceForTabletop(workspace, resourceId);

    let tabletop = createTabletopDocument("01989f4e-7b2c-7000-8000-000000000010", "荒野伏击");
    tabletop = executeTabletopCommand(tabletop, {
      type: "place",
      instanceId: "01989f4e-7b2c-7000-8000-000000000011",
      resource: snapshot.resource,
      state: adversaryTemplate.tabletop.defaultState(snapshot.resource.data as never),
      position: { x: 120, y: 80 },
      assets: snapshot.assets,
    }, { capabilities }).document;
    tabletop = executeTabletopCommand(tabletop, {
      type: "move",
      instanceId: "01989f4e-7b2c-7000-8000-000000000011",
      position: { x: 260, y: 180 },
    }, { capabilities }).document;
    tabletop = executeTabletopCommand(tabletop, {
      type: "uniform-scale",
      instanceId: "01989f4e-7b2c-7000-8000-000000000011",
      scale: 1.25,
    }, { capabilities }).document;
    tabletop = executeTabletopCommand(tabletop, {
      type: "template-state",
      instanceId: "01989f4e-7b2c-7000-8000-000000000011",
      commandId: "adjust-hp",
      value: "-2",
    }, {
      capabilities,
      templateCommands: () => adversaryTemplate.tabletop.commands,
    }).document;

    (workspace.document.resources[0]!.data as Record<string, unknown>).名称 = "来源已修改";
    workspace.media.clear();

    const database = new PbDHLocalDatabase(`pbdh-platform-test-${crypto.randomUUID()}`);
    databases.push(database);
    const repository = new TabletopDocumentRepository(new DexieLocalDocumentStore(database));
    await repository.save(tabletop, snapshot.media);
    const [restored] = await repository.list();
    const instance = restored!.model.instances[0]!;

    expect(instance.resource.data.名称).toBe("牛头人破坏者");
    expect(instance.position).toEqual({ x: 260, y: 180 });
    expect(instance.scale).toBe(1.25);
    expect(instance.state.currentHp).toBe("5");
    expect(restored!.media.get(assetId)).toEqual(bytes);
  });

  test("rejects missing source media before creating a placement snapshot", () => {
    const workspace = createWorkspace({
      document: structuredClone(minotaurPackage) as ResourcePackageLogicalDocument,
      media: new Map(),
    });
    expect(() => snapshotWorkspaceResourceForTabletop(
      workspace,
      workspace.document.resources[0]!.id,
    )).toThrow("tabletop.source-media-bytes.not-found");
  });
});
