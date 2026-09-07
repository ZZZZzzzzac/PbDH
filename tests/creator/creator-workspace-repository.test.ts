import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import { CreatorWorkspaceRepository } from "../../apps/creator/src/workspace-prototype/creator-workspace-repository.ts";
import {
  createBlankWorkspace,
  createWorkspace,
  createWorkspaceFolder,
  updateWorkspaceResourceData,
} from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

const databases: PbDHLocalDatabase[] = [];

function database(name = `pbdh-creator-workspace-test-${crypto.randomUUID()}`) {
  const value = new PbDHLocalDatabase(name);
  databases.push(value);
  return value;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (value) => {
    value.close();
    await value.delete();
  }));
});

describe("Creator Workspace local repository", () => {
  test("restores edited resources, workspace tree, tabs, and media after reopening", async () => {
    const document = minotaurPackage as ResourcePackageLogicalDocument;
    const asset = document.assets[0]!;
    const media = new Map([[asset.id, new Uint8Array(readFileSync(path.join(
      process.cwd(),
      "contracts/conformance/resource-package/1.0.0/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
    )))]]);
    let workspace = createWorkspace({ document, media });
    workspace = updateWorkspaceResourceData(workspace, (data) => { data.名称 = "刷新后仍存在"; });
    workspace = createWorkspaceFolder(workspace, null, "遭遇");

    const firstDatabase = database();
    const databaseName = firstDatabase.name;
    await new CreatorWorkspaceRepository(new DexieLocalDocumentStore(firstDatabase)).save(workspace);
    firstDatabase.close();

    const reopenedDatabase = database(databaseName);
    const restored = await new CreatorWorkspaceRepository(new DexieLocalDocumentStore(reopenedDatabase)).list();

    expect(restored).toHaveLength(1);
    expect(restored[0]!.document.resources[0]!.data).toMatchObject({ 名称: "刷新后仍存在" });
    expect(restored[0]!.document.resources[0]!.template.version).toBe("1.0.0");
    expect(restored[0]!.folders.map((folder) => folder.name)).toContain("遭遇");
    expect(restored[0]!.openResourceIds).toEqual(workspace.openResourceIds);
    expect(restored[0]!.dirtyResourceIds).toEqual(workspace.dirtyResourceIds);
    expect(restored[0]!.media.get(asset.id)).toEqual(media.get(asset.id));
  });

  test("removes the Creator Workspace document when its package is closed", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new CreatorWorkspaceRepository(store);
    const workspace = await createBlankWorkspace("待关闭资源包");

    await repository.save(workspace);
    expect(await store.get("creator-workspace", workspace.key)).toBeDefined();

    await repository.remove(workspace.key);
    expect(await store.get("creator-workspace", workspace.key)).toBeUndefined();
  });

  test("moves a local Creator Workspace through the shared recoverable trash lifecycle", async () => {
    const repository = new CreatorWorkspaceRepository(
      new DexieLocalDocumentStore(database()),
      () => "2026-08-20T10:00:00.000Z",
    );
    const workspace = await createBlankWorkspace("待恢复资源包");
    await repository.save(workspace);

    await repository.trash(workspace.key);
    expect(await repository.list()).toEqual([]);
    expect(await repository.listTrash()).toMatchObject([{
      workspace: { key: workspace.key },
      deletedAt: "2026-08-20T10:00:00.000Z",
      purgeAfter: "2026-09-19T10:00:00.000Z",
    }]);

    const restored = await repository.restore(workspace.key);
    expect(restored.workspace.document.package.name).toBe("待恢复资源包");
    expect(await repository.list()).toHaveLength(1);
  });

  test("only marks a cloud workspace pending when its persisted content changes", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new CreatorWorkspaceRepository(store);
    let workspace = await createBlankWorkspace("云端工作区");

    await repository.save(workspace, "account-1");
    const first = await store.get("creator-workspace", workspace.key);
    expect(first?.sync).toMatchObject({ scope: "cloud", state: "pending", baseRevision: null });

    first!.sync = { scope: "cloud", state: "clean", baseRevision: "1", accountId: "account-1" };
    await store.put(first!);
    await repository.save(workspace, "account-1");
    expect((await store.get("creator-workspace", workspace.key))?.sync.state).toBe("clean");

    workspace = createWorkspaceFolder(workspace, null, "发生变化");
    await repository.save(workspace, "account-1");
    expect((await store.get("creator-workspace", workspace.key))?.sync).toMatchObject({
      scope: "cloud",
      state: "pending",
      baseRevision: "1",
    });
  });

  test("explicitly converts the same local document id to cloud without a duplicate", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new CreatorWorkspaceRepository(store);
    const workspace = await createBlankWorkspace("本地工作区");

    await repository.save(workspace);
    await repository.save(workspace, "account-1", true);

    expect(await repository.list()).toHaveLength(1);
    expect((await store.get("creator-workspace", workspace.key))?.sync).toMatchObject({
      scope: "cloud",
      state: "pending",
      accountId: "account-1",
    });
  });
});
