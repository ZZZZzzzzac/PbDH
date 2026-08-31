import "fake-indexeddb/auto";

import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, test } from "vitest";

import {
  computeResourcePackageSnapshotDigest,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import {
  createTabletopDocument,
  executeTabletopCommand,
  type TabletopCapability,
} from "@pbdh/tabletop/core";
import { adversaryTemplate } from "@pbdh/templates/core";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import {
  createWorkspace,
  planImport,
} from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { creatorMarketHandoffMismatch } from "../../apps/creator/src/workspace-prototype/market-handoff.ts";
import {
  containGmTabletopInstances,
  prepareWorkspaceReplacement,
  snapshotWorkspaceResourceForTabletop,
} from "../../apps/creator/src/workspace-prototype/tabletop-placement.ts";
import { TabletopDocumentRepository } from "../../apps/creator/src/workspace-prototype/tabletop-document-repository.ts";

const databases: PbDHLocalDatabase[] = [];
const capabilities = new Set<TabletopCapability>([
  "place",
  "move",
  "uniform-scale",
  "template-state-command",
  "replace",
]);

test("repairs existing GM cards that were saved almost entirely outside the tabletop", () => {
  const document = executeTabletopCommand(createTabletopDocument("table-contained", "边界修复"), {
    type: "place",
    instanceId: "enemy-outside",
    resource: {
      source: { packageId: "package-1", resourceId: "enemy-1" },
      template: { id: "敌人", version: "1.0.0" },
      presentation: { mode: "text", fixedRatio: true },
      data: { 名称: "越界敌人" },
      labels: [],
      replacements: [],
      media: {},
    },
    state: {},
    position: { x: -202, y: -302 },
  }, { capabilities }).document;

  expect(containGmTabletopInstances(document).instances[0]?.position).toEqual({ x: 0, y: 0 });
});

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
    const sourceMedia = new Map([[assetId, bytes]]);
    const workspace = createWorkspace({
      document: structuredClone(minotaurPackage) as ResourcePackageLogicalDocument,
      media: sourceMedia,
    });
    const resourceId = workspace.document.resources[0]!.id;
    const snapshot = snapshotWorkspaceResourceForTabletop(workspace, resourceId);

    expect(snapshot.resource.presentation).toEqual(workspace.document.resources[0]!.presentation);

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

    const updatedDocument = structuredClone(minotaurPackage) as ResourcePackageLogicalDocument;
    (updatedDocument.resources[0]!.data as Record<string, unknown>).名称 = "牛头人破坏者·新版";
    updatedDocument.snapshotDigest = await computeResourcePackageSnapshotDigest(updatedDocument, sourceMedia);
    const updateCandidate = { document: updatedDocument, media: sourceMedia };
    expect(creatorMarketHandoffMismatch({
      target: "gm",
      publicationId: "publication-minotaur",
      packageId: updatedDocument.package.id,
      packageVersion: updatedDocument.package.version,
      snapshotDigest: updatedDocument.snapshotDigest,
      creatorMode: "import",
      focusResourceId: updatedDocument.resources[0]!.id,
    }, updateCandidate)).toBeNull();
    expect(planImport(workspace, updateCandidate)).toBe("update");
    const updatedWorkspace = createWorkspace(updateCandidate);

    (workspace.document.resources[0]!.data as Record<string, unknown>).名称 = "来源已修改";
    workspace.media.clear();

    const database = new PbDHLocalDatabase(`pbdh-platform-test-${crypto.randomUUID()}`);
    databases.push(database);
    const repository = new TabletopDocumentRepository(new DexieLocalDocumentStore(database));
    await repository.save(tabletop, snapshot.media);
    const [restored] = await repository.list();
    const instance = restored!.model.instances[0]!;

    expect(instance.resource.data.名称).toBe("牛头人破坏者");
    expect((updatedWorkspace.document.resources[0]!.data as Record<string, unknown>).名称)
      .toBe("牛头人破坏者·新版");
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

  test("switches A to B to C from current Workspace content without caching old forms", () => {
    const document = structuredClone(minotaurPackage) as ResourcePackageLogicalDocument;
    document.assets = [];
    const source = document.resources[0]!;
    source.media = {};
    const form = (id: string, name: string, targetResourceId: string) => ({
      ...structuredClone(source),
      id,
      path: `${id}.json`,
      data: { ...(source.data as Record<string, unknown>), 名称: name },
      replacements: [{ replacementId: "alternate-form", targetResourceId }],
    });
    document.resources = [
      form("form-a", "形态 A", "form-b"),
      form("form-b", "形态 B", "form-c"),
      form("form-c", "形态 C", "form-a"),
    ];
    const workspace = createWorkspace({ document, media: new Map() });
    const a = snapshotWorkspaceResourceForTabletop(workspace, "form-a");
    let tabletop = executeTabletopCommand(
      createTabletopDocument("01989f4e-7b2c-7000-8000-000000000020", "多形态"),
      {
        type: "place",
        instanceId: "01989f4e-7b2c-7000-8000-000000000021",
        resource: a.resource,
        state: { currentHp: "1", currentStress: "3" },
        position: { x: 42, y: 64 },
      },
      { capabilities },
    ).document;
    tabletop.instances[0]!.rotation = 12;
    tabletop.instances[0]!.flipped = true;
    tabletop.instances[0]!.scale = 1.3;

    const toB = prepareWorkspaceReplacement(
      [workspace],
      tabletop.instances[0]!,
      "alternate-form",
      "01989f4e-7b2c-7000-8000-000000000022",
    );
    tabletop = executeTabletopCommand(tabletop, toB.command, { capabilities }).document;
    expect(tabletop.instances[0]).toMatchObject({
      id: "01989f4e-7b2c-7000-8000-000000000022",
      position: { x: 42, y: 64 },
      rotation: 12,
      flipped: false,
      scale: 1.3,
    });
    expect(tabletop.instances[0]?.resource.data.名称).toBe("形态 B");
    expect(tabletop.instances[0]?.state).toEqual(adversaryTemplate.tabletop.defaultState(
      workspace.document.resources[1]!.data as never,
    ));

    (workspace.document.resources[2]!.data as Record<string, unknown>).名称 = "形态 C·修改后";
    const toC = prepareWorkspaceReplacement(
      [workspace],
      tabletop.instances[0]!,
      "alternate-form",
      "01989f4e-7b2c-7000-8000-000000000023",
    );
    tabletop = executeTabletopCommand(tabletop, toC.command, { capabilities }).document;
    expect(tabletop.instances).toHaveLength(1);
    expect(tabletop.instances[0]?.resource.data.名称).toBe("形态 C·修改后");
    expect(tabletop.instances[0]?.resource.replacements).toEqual([
      { replacementId: "alternate-form", targetResourceId: "form-a" },
    ]);
  });

  test("fails without changing the current instance when the target was deleted", () => {
    const document = structuredClone(minotaurPackage) as ResourcePackageLogicalDocument;
    document.assets = [];
    const source = document.resources[0]!;
    source.media = {};
    source.replacements = [{ replacementId: "alternate-form", targetResourceId: "deleted-form" }];
    const workspace = createWorkspace({ document, media: new Map() });
    const snapshot = snapshotWorkspaceResourceForTabletop(workspace, source.id);
    const tabletop = executeTabletopCommand(
      createTabletopDocument("01989f4e-7b2c-7000-8000-000000000030", "断裂目标"),
      {
        type: "place",
        instanceId: "01989f4e-7b2c-7000-8000-000000000031",
        resource: snapshot.resource,
        state: { currentHp: "4" },
        position: { x: 10, y: 20 },
      },
      { capabilities },
    ).document;

    expect(() => prepareWorkspaceReplacement(
      [workspace],
      tabletop.instances[0]!,
      "alternate-form",
      "01989f4e-7b2c-7000-8000-000000000032",
    )).toThrow("tabletop.replacement.target-not-found");
    expect(tabletop.instances[0]).toMatchObject({
      id: "01989f4e-7b2c-7000-8000-000000000031",
      state: { currentHp: "4" },
      position: { x: 10, y: 20 },
    });
  });

  test("switches A to B and back by looking up both targets again", () => {
    const document = structuredClone(minotaurPackage) as ResourcePackageLogicalDocument;
    document.assets = [];
    const source = document.resources[0]!;
    source.media = {};
    const form = (id: string, name: string, targetResourceId: string) => ({
      ...structuredClone(source),
      id,
      path: `${id}.json`,
      data: { ...(source.data as Record<string, unknown>), 名称: name },
      replacements: [{ replacementId: "alternate-form", targetResourceId }],
    });
    document.resources = [form("form-a", "形态 A", "form-b"), form("form-b", "形态 B", "form-a")];
    const workspace = createWorkspace({ document, media: new Map() });
    const placed = snapshotWorkspaceResourceForTabletop(workspace, "form-a");
    let tabletop = executeTabletopCommand(
      createTabletopDocument("01989f4e-7b2c-7000-8000-000000000040", "往返形态"),
      {
        type: "place",
        instanceId: "01989f4e-7b2c-7000-8000-000000000041",
        resource: placed.resource,
        state: {},
        position: { x: 1, y: 2 },
      },
      { capabilities },
    ).document;
    const toB = prepareWorkspaceReplacement(
      [workspace], tabletop.instances[0]!, "alternate-form", "01989f4e-7b2c-7000-8000-000000000042",
    );
    tabletop = executeTabletopCommand(tabletop, toB.command, { capabilities }).document;
    (workspace.document.resources[0]!.data as Record<string, unknown>).名称 = "形态 A·最新";
    const backToA = prepareWorkspaceReplacement(
      [workspace], tabletop.instances[0]!, "alternate-form", "01989f4e-7b2c-7000-8000-000000000043",
    );
    tabletop = executeTabletopCommand(tabletop, backToA.command, { capabilities }).document;
    expect(tabletop.instances).toHaveLength(1);
    expect(tabletop.instances[0]?.resource.data.名称).toBe("形态 A·最新");
  });
});
