import "fake-indexeddb/auto";

import { afterEach, describe, expect, test, vi } from "vitest";

import type { TabletopDocument } from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import {
  createTabletopDocument,
  executeTabletopCommand,
  type TabletopCapability,
} from "@pbdh/tabletop/core";

import {
  TabletopDocumentRepository,
  duplicateTabletopModel,
} from "../../apps/creator/src/workspace-prototype/tabletop-document-repository.ts";
import { validateTabletopDocumentCandidate } from "../../apps/creator/src/workspace-prototype/tabletop-document-validator.ts";
import stableFixture from "../../contracts/conformance/tabletop-document/1.0.0/valid/basic.json";

const databases: PbDHLocalDatabase[] = [];
const capabilities = new Set<TabletopCapability>(["place"]);

function database() {
  const value = new PbDHLocalDatabase(`pbdh-platform-test-${crypto.randomUUID()}`);
  databases.push(value);
  return value;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (value) => {
    value.close();
    await value.delete();
  }));
});

describe("GM Tabletop Document Repository", () => {
  test("字段更新复用旧媒体引用，媒体或描述变更仍校验", async () => {
    const db = database();
    const store = new DexieLocalDocumentStore(db);
    const repository = new TabletopDocumentRepository(store);
    const bytes = new Uint8Array([1, 2, 3]);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const assetId = `sha256:${Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("")}`;
    const model = createTabletopDocument(crypto.randomUUID(), "原桌面");
    model.assets = [{ id: assetId, mediaType: "image/webp", byteLength: "3", width: "1", height: "1" }];
    await repository.save(model, new Map([[assetId, bytes]]));
    const reads = vi.spyOn(store, "getMedia");
    const digest = vi.spyOn(crypto.subtle, "digest");
    let byteReads = 0;
    db.mediaAssets.hook("reading", (record) => { byteReads += 1; return record; });
    try {
      await repository.saveUpdate({ ...model, name: "改名称" }, new Map());
      expect(reads).not.toHaveBeenCalled();
      expect(byteReads).toBe(0);
      expect(digest).not.toHaveBeenCalled();
      await expect(repository.saveUpdate({ ...model, name: "不应写入" }, new Map([[assetId, new Uint8Array([9, 9, 9])]])))
        .rejects.toThrow("tabletop-document.media.digest-mismatch");
      expect(digest).toHaveBeenCalledOnce();
      await expect(repository.saveUpdate({ ...model, assets: [{ ...model.assets[0]!, byteLength: "99" }] }, new Map()))
        .rejects.toThrow("tabletop-document.media.byte-length-mismatch");
      expect(reads).toHaveBeenCalledExactlyOnceWith([assetId]);
      expect((await store.get<TabletopDocument>("gm-tabletop-document", model.id))!.payload.name).toBe("改名称");
    } finally { vi.restoreAllMocks(); }
  });

  test("正式入口拒绝不受支持的旧 Contract", async () => {
    const diagnostics = await validateTabletopDocumentCandidate(
      { contractVersion: "0.9.0" } as unknown as TabletopDocument,
      new Map(),
    );

    expect(diagnostics.map((item) => item.code)).toEqual([
      "contract.version.unsupported",
    ]);
  });

  test("validates runtime state against the exact resource template", async () => {
    const document = structuredClone(stableFixture) as TabletopDocument;
    document.instances[0]!.state = { currentHp: 7 };

    const diagnostics = await validateTabletopDocumentCandidate(document, new Map());

    expect(diagnostics.map((item) => item.code)).toContain("tabletop-document.state.invalid-for-template");
  });

  test("rejects replacement IDs that the exact resource template did not declare", async () => {
    const document = structuredClone(stableFixture) as TabletopDocument;
    document.instances[0]!.resourceCopy.replacements = [{
      replacementId: "unknown-action",
      targetResourceId: "minotaur-rage",
    }];

    const diagnostics = await validateTabletopDocumentCandidate(document, new Map());

    expect(diagnostics.map((item) => item.code)).toContain("tabletop-document.replacement-id.not-declared");
  });

  test("reopens a saved tabletop from the shared local document store", async () => {
    const value = database();
    const repository = new TabletopDocumentRepository(
      new DexieLocalDocumentStore(value),
      () => "2026-08-20T10:00:00.000Z",
    );
    const empty = createTabletopDocument("01989f4e-7b2c-7000-8000-000000000001", "陨落神殿");
    const model = executeTabletopCommand(empty, {
      type: "place",
      instanceId: "01989f4e-7b2c-7000-8000-000000000002",
      resource: {
        source: {
          packageId: "0195f4d4-8b6b-7000-8000-000000000001",
          resourceId: "minotaur-wrecker",
        },
        template: { id: "敌人", version: "1.0.0" },
        presentation: {
          mode: "split",
          fixedRatio: true,
        },
        data: { 名称: "牛头人破坏者" },
        labels: ["敌人"],
        replacements: [],
        media: {},
      },
      state: { currentHp: "7", currentStress: "0", focused: "false", notes: "" },
      position: { x: 48, y: 88 },
    }, { capabilities }).document;

    await repository.save(model, new Map());
    const [stored] = await repository.list();

    expect(stored?.model).toEqual(model);
    expect(stored?.document.contractVersion).toBe("1.0.0");
    expect(stored?.document.canvas).toEqual({ width: 2400, height: 1600 });
    expect(stored?.document.instances[0]?.resourceCopy.data.名称).toBe("牛头人破坏者");
  });

  test("persists a renamed tabletop document", async () => {
    const repository = new TabletopDocumentRepository(new DexieLocalDocumentStore(database()));
    const model = createTabletopDocument(
      "01989f4e-7b2c-7000-8000-000000000010",
      "新桌面 1",
    );

    await repository.save(model, new Map());
    await repository.save({ ...model, name: "深林伏击" }, new Map());

    expect((await repository.list())[0]?.model.name).toBe("深林伏击");
  });

  test("rejects invalid import before writing", async () => {
    const value = database();
    const repository = new TabletopDocumentRepository(new DexieLocalDocumentStore(value));
    const invalid = {
      contractVersion: "0.9.0",
      documentId: "invalid",
    } as never;

    await expect(repository.import({ document: invalid, media: new Map() }))
      .rejects.toThrow("Invalid Tabletop Document import");
    expect(await value.localDocuments.count()).toBe(0);
  });

  test("moves a local tabletop to a recoverable recycle bin", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new TabletopDocumentRepository(store);
    const model = createTabletopDocument(
      "01989f4e-7b2c-7000-8000-000000000020",
      "待删除桌面",
    );

    await repository.save(model, new Map());
    expect(await store.get("gm-tabletop-document", model.id)).toBeDefined();

    await repository.trash(model.id);
    expect(await store.get("gm-tabletop-document", model.id)).toBeUndefined();
    expect(await repository.list()).toEqual([]);
    expect((await repository.listTrash())[0]?.model).toEqual(model);

    const restored = await repository.restore(model.id);
    expect(restored.model).toEqual(model);
    expect(await repository.listTrash()).toEqual([]);
    expect((await repository.list())[0]?.model).toEqual(model);
  });

  test("persists the card's tabletop geometry separately from canonical presentation", async () => {
    const repository = new TabletopDocumentRepository(new DexieLocalDocumentStore(database()));
    const model = executeTabletopCommand(
      createTabletopDocument("01989f4e-7b2c-7000-8000-000000000008", "旧尺寸桌面"),
      {
        type: "place",
        instanceId: "01989f4e-7b2c-7000-8000-000000000009",
        resource: {
          source: null,
          template: { id: "敌人", version: "1.0.0" },
          presentation: { mode: "split", fixedRatio: true },
          data: { 名称: "旧尺寸敌人" },
          labels: [],
          replacements: [],
          media: {},
        },
        state: { currentHp: "3", currentStress: "0", focused: "false", notes: "" },
        position: { x: 0, y: 0 },
      },
      { capabilities },
    ).document;
    model.instances[0]!.scale = 1.5;

    await repository.save(model, new Map());
    const [stored] = await repository.list();

    expect(stored?.document.instances[0]?.resourceCopy.presentation).toEqual({
      mode: "split",
      fixedRatio: true,
    });
    expect(stored?.document.instances[0]?.geometry.width).toBe(375);
    expect(stored?.model.instances[0]?.resource.presentation).toEqual({
      mode: "split",
      fixedRatio: true,
    });
    expect(stored?.model.instances[0]?.scale).toBe(1.5);
  });

  test("duplicates a tabletop with new document and instance IDs", async () => {
    const source = executeTabletopCommand(
      createTabletopDocument("01989f4e-7b2c-7000-8000-000000000040", "原桌面"),
      {
        type: "place",
        instanceId: "01989f4e-7b2c-7000-8000-000000000041",
        resource: {
          source: null,
          template: { id: "pbdh.adversary", version: "1.0.0" },
          presentation: { mode: "text", fixedRatio: true },
          data: { 名称: "敌人" },
          labels: [],
          replacements: [],
          media: {},
        },
        state: { currentHp: "3" },
        position: { x: 10, y: 20 },
      },
      { capabilities },
    ).document;

    const copy = duplicateTabletopModel(
      source,
      "01989f4e-7b2c-7000-8000-000000000042",
      ["01989f4e-7b2c-7000-8000-000000000043"],
    );

    expect(copy.id).not.toBe(source.id);
    expect(copy.instances[0]?.id).not.toBe(source.instances[0]?.id);
    expect(copy).toMatchObject({ name: "原桌面 副本", instances: [{ state: { currentHp: "3" } }] });
    copy.instances[0]!.state.currentHp = "1";
    expect(source.instances[0]?.state.currentHp).toBe("3");
  });

  test("requires an explicit choice before importing an existing document ID", async () => {
    const repository = new TabletopDocumentRepository(new DexieLocalDocumentStore(database()));
    const current = createTabletopDocument(
      "01989f4e-7b2c-7000-8000-000000000050",
      "当前桌面",
    );
    await repository.save(current, new Map());
    const incoming = {
      document: {
        ...(await repository.save({ ...current, name: "导入桌面" }, new Map())).document,
        name: "导入桌面",
      },
      media: new Map<string, Uint8Array>(),
    };
    await repository.save(current, new Map());

    await expect(repository.import(incoming)).rejects.toThrow("请选择保留副本或覆盖");
    expect((await repository.list())[0]?.model.name).toBe("当前桌面");

    await repository.import(incoming, null, "replace");
    expect((await repository.list())[0]?.model.name).toBe("导入桌面");

    const copyIncoming = structuredClone(incoming);
    copyIncoming.document.name = "另一个导入桌面";
    const copy = await repository.import(copyIncoming, null, "copy");
    expect(copy.id).not.toBe(current.id);
    expect(copy.name).toBe("另一个导入桌面 副本");
    expect(await repository.list()).toHaveLength(2);
  });

  test("opens an identical tabletop import as a no-op", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new TabletopDocumentRepository(store);
    const model = createTabletopDocument("01989f4e-7b2c-7000-8000-000000000060", "相同桌面");
    const candidate = await repository.save(model, new Map());
    const before = await store.get("gm-tabletop-document", model.id);

    expect(await repository.importDisposition(candidate)).toBe("same");
    expect(await repository.import(candidate)).toEqual(model);
    expect(await store.get("gm-tabletop-document", model.id)).toEqual(before);

    const legacyShape = structuredClone(candidate);
    delete legacyShape.document.canvas;
    expect(await repository.importDisposition(legacyShape)).toBe("same");
  });

  test("keeps a clean cloud revision clean until the tabletop content changes", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new TabletopDocumentRepository(store);
    const model = createTabletopDocument(
      "01989f4e-7b2c-7000-8000-000000000030",
      "云端桌面",
    );

    await repository.save(model, new Map(), "account-1");
    const first = await store.get("gm-tabletop-document", model.id);
    expect(first?.sync.state).toBe("pending");

    first!.sync = { scope: "cloud", state: "clean", baseRevision: "2", accountId: "account-1" };
    await store.put(first!);
    await repository.save(model, new Map(), "account-1");
    expect((await store.get("gm-tabletop-document", model.id))?.sync.state).toBe("clean");

    await repository.save({ ...model, name: "已重命名桌面" }, new Map(), "account-1");
    expect((await store.get("gm-tabletop-document", model.id))?.sync).toMatchObject({
      scope: "cloud",
      state: "pending",
      baseRevision: "2",
    });
  });
});
