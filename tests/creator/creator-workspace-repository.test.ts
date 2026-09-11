import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import type { RemoteCloudDocument } from "@pbdh/cloud-documents";
import { DexieLocalDocumentStore, LocalDocumentChangedError, PbDHLocalDatabase } from "@pbdh/local-storage";

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

function workspaceDocument(
  packageId: string,
  assetIds: string[],
  name: string,
): ResourcePackageLogicalDocument {
  const base = structuredClone(minotaurPackage) as ResourcePackageLogicalDocument;
  const template = base.assets[0]!;
  return {
    ...base,
    package: { ...base.package, id: packageId, name },
    assets: assetIds.map((id) => ({ ...template, id })),
  } as unknown as ResourcePackageLogicalDocument;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (value) => {
    value.close();
    await value.delete();
  }));
});

describe("Creator Workspace local repository", () => {
  test("旧删除确认不能把后来修改的活动工作区移入回收站", async () => {
    const repository = new CreatorWorkspaceRepository(new DexieLocalDocumentStore(database()));
    const original = await createBlankWorkspace("删除确认时的内容");
    await repository.save(original);
    const edited = createWorkspaceFolder(original, null, "后来新增的目录");
    await repository.save(edited);
    await expect(repository.trash(original.key, original)).rejects.toThrow("已被其他操作更新");
    expect((await repository.list())[0]?.folders.map((folder) => folder.name)).toContain("后来新增的目录");
    expect(await repository.listTrash()).toEqual([]);
  });
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

  test("keeps a legacy closed workspace record and its media when listing", async () => {
    // 回归：修正前“关闭但保留”产生的本地记录，不应在 listStored/list 时被删除。
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new CreatorWorkspaceRepository(store);
    const document = minotaurPackage as ResourcePackageLogicalDocument;
    const asset = document.assets[0]!;
    const bytes = new Uint8Array(readFileSync(path.join(
      process.cwd(),
      "contracts/conformance/resource-package/1.0.0/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
    )));
    const workspace = createWorkspace({ document, media: new Map([[asset.id, bytes]]) });
    await repository.save(workspace);

    const stored = (await store.get("creator-workspace", workspace.key))!;
    (stored.payload as { closed?: boolean }).closed = true;
    await store.put(stored);

    expect((await repository.listStored()).map((item) => item.workspace.key)).toEqual([workspace.key]);
    expect((await repository.list()).map((item) => item.key)).toEqual([workspace.key]);
    expect(await store.get("creator-workspace", workspace.key)).toBeDefined();
    expect((await store.getMedia([asset.id])).get(asset.id)).toEqual(bytes);

    // 回归：再次保存后，历史未知字段 closed 被自然消除。
    await repository.save((await repository.list())[0]!);
    const resaved = (await store.get("creator-workspace", workspace.key))!;
    expect(resaved.payload).not.toHaveProperty("closed");
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

  test("普通 save 不能复活回收站文档", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new CreatorWorkspaceRepository(store);
    const assetId = `sha256:${"a".repeat(64)}`;
    const workspace = createWorkspace({
      document: workspaceDocument("01a05400-0000-7000-8000-000000000401", [assetId], "回收站资源包"),
      media: new Map([[assetId, new Uint8Array([1])]]),
    });
    await repository.save(workspace);
    await repository.trash(workspace.key);

    await expect(repository.save(workspace)).rejects.toThrow();
    expect(await repository.list()).toEqual([]);
    expect(await repository.listTrash()).toMatchObject([{ workspace: { key: workspace.key } }]);
    expect(await store.get("creator-workspace", workspace.key)).toBeUndefined();
  });

  test("saveImported 用新的初始同步替换同编号回收站文档并保留共享旧媒体", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new CreatorWorkspaceRepository(store);
    const sharedAssetId = `sha256:${"b".repeat(64)}`;
    const uniqueAssetId = `sha256:${"c".repeat(64)}`;
    const newAssetId = `sha256:${"d".repeat(64)}`;
    const packageA = "01a05400-0000-7000-8000-000000000402";
    const packageB = "01a05400-0000-7000-8000-000000000403";

    const workspaceA = createWorkspace({
      document: workspaceDocument(packageA, [sharedAssetId, uniqueAssetId], "待替换资源包"),
      media: new Map([
        [sharedAssetId, new Uint8Array([1, 1])],
        [uniqueAssetId, new Uint8Array([2, 2])],
      ]),
    });
    const workspaceB = createWorkspace({
      document: workspaceDocument(packageB, [sharedAssetId], "共享媒体资源包"),
      media: new Map([[sharedAssetId, new Uint8Array([1, 1])]]),
    });
    await repository.save(workspaceA);
    await repository.save(workspaceB);
    await repository.trash(workspaceA.key);
    expect(await repository.listTrash()).toHaveLength(1);

    const imported = createWorkspace({
      document: workspaceDocument(packageA, [newAssetId], "导入后的资源包"),
      media: new Map([[newAssetId, new Uint8Array([3, 3])]]),
    });
    await repository.saveImported(imported, "account-1");

    const active = await store.get("creator-workspace", packageA);
    expect(active?.assetIds).toEqual([newAssetId]);
    expect(active?.sync).toMatchObject({
      scope: "cloud",
      state: "pending",
      baseRevision: null,
      accountId: "account-1",
    });
    expect(await repository.listTrash()).toEqual([]);
    // 新媒体完整，旧回收站独有媒体被清理，其他文档共享的旧媒体保留。
    expect((await store.getMedia([newAssetId])).get(newAssetId)).toEqual(new Uint8Array([3, 3]));
    expect((await store.getMedia([sharedAssetId])).get(sharedAssetId)).toEqual(new Uint8Array([1, 1]));
    expect(await store.getMedia([uniqueAssetId])).toEqual(new Map());

    // 旧回收站条目的恢复、永久删除与清理都不能改变已替换的活动包。
    await expect(repository.restore(packageA)).rejects.toThrow();
    await expect(repository.deleteFromTrash(packageA)).rejects.toThrow();
    await repository.listTrash();
    const after = await store.get("creator-workspace", packageA);
    expect(after?.assetIds).toEqual([newAssetId]);
    expect(after?.payload).toMatchObject({ document: { package: { name: "导入后的资源包" } } });
    expect((await store.getMedia([newAssetId])).get(newAssetId)).toEqual(new Uint8Array([3, 3]));
  });

  test("restoreRemote 用调用方的旧快照拒绝覆盖本地更新", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new CreatorWorkspaceRepository(store);
    const document = minotaurPackage as ResourcePackageLogicalDocument;
    const asset = document.assets[0]!;
    const media = new Map([[asset.id, new Uint8Array(readFileSync(path.join(
      process.cwd(),
      "contracts/conformance/resource-package/1.0.0/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
    )))]]);
    await repository.save(createWorkspace({ document, media }));
    const snapshot = (await store.get("creator-workspace", document.package.id))!;

    let updated = createWorkspace({ document, media });
    updated = updateWorkspaceResourceData(updated, (data) => { data.名称 = "本地新增修改"; });
    await repository.save(updated);

    const remote = {
      documentId: document.package.id,
      documentKind: "creator-workspace",
      contractFamily: "creator-workspace-draft",
      contractVersion: "1",
      deletedAt: null,
      revision: 9,
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-08-21T10:00:00.000Z",
      assetIds: [asset.id],
      payload: structuredClone(snapshot.payload),
    } as unknown as RemoteCloudDocument;

    await expect(repository.restoreRemote(remote, media, "account-1", snapshot))
      .rejects.toBeInstanceOf(LocalDocumentChangedError);

    const stored = (await store.get("creator-workspace", document.package.id))!;
    expect(stored.payload).toMatchObject({
      document: { resources: [{ data: { 名称: "本地新增修改" } }] },
    });
  });

  test("restoreRemote 未传 expected 时以当前本地记录为基准写入", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new CreatorWorkspaceRepository(store);
    const document = minotaurPackage as ResourcePackageLogicalDocument;
    const asset = document.assets[0]!;
    const media = new Map([[asset.id, new Uint8Array(readFileSync(path.join(
      process.cwd(),
      "contracts/conformance/resource-package/1.0.0/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
    )))]]);
    await repository.save(createWorkspace({ document, media }));
    const snapshot = (await store.get("creator-workspace", document.package.id))!;

    const remote = {
      documentId: document.package.id,
      documentKind: "creator-workspace",
      contractFamily: "creator-workspace-draft",
      contractVersion: "1",
      deletedAt: null,
      revision: 9,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      assetIds: [asset.id],
      payload: structuredClone(snapshot.payload),
    } as unknown as RemoteCloudDocument;

    const restored = await repository.restoreRemote(remote, media, "account-2");
    expect(restored.sync).toMatchObject({
      scope: "cloud",
      state: "clean",
      baseRevision: "9",
      accountId: "account-2",
    });
  });
});
