import "fake-indexeddb/auto";

import { afterEach, describe, expect, test } from "vitest";

import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import {
  createTabletopDocument,
  executeTabletopCommand,
  type TabletopCapability,
} from "@pbdh/tabletop/core";

import { TabletopDocumentRepository } from "../../apps/creator/src/workspace-prototype/tabletop-document-repository.ts";

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
        template: { id: "pbdh.adversary", version: "1.0.0-alpha.1" },
        presentation: {
          width: "88",
          height: "126",
          unit: "mm",
          mode: "split",
          fixedRatio: true,
        },
        data: { 名称: "牛头人破坏者" },
        labels: ["敌人"],
        media: {},
      },
      state: { currentHp: "7" },
      position: { x: 48, y: 88 },
    }, { capabilities }).document;

    await repository.save(model, new Map());
    const [stored] = await repository.list();

    expect(stored?.model).toEqual(model);
    expect(stored?.document.contractVersion).toBe("1.0.0-alpha.1");
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
      contractVersion: "1.0.0-alpha.1",
      documentId: "invalid",
    } as never;

    await expect(repository.import({ document: invalid, media: new Map() }))
      .rejects.toThrow("Invalid Tabletop Document import");
    expect(await value.localDocuments.count()).toBe(0);
  });

  test("removes a tabletop document so reopening does not restore it", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const repository = new TabletopDocumentRepository(store);
    const model = createTabletopDocument(
      "01989f4e-7b2c-7000-8000-000000000020",
      "待删除桌面",
    );

    await repository.save(model, new Map());
    expect(await store.get("gm-tabletop-document", model.id)).toBeDefined();

    await repository.remove(model.id);
    expect(await store.get("gm-tabletop-document", model.id)).toBeUndefined();
    expect(await repository.list()).toEqual([]);
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
