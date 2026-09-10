import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

import { computeResourcePackageSnapshotDigest, writePbres, type ResourcePackageLogicalDocument } from "../../packages/contract-runtime/src/index.ts";
import { loadValidatedCoreBook } from "../../scripts/daggerheart-core-book-validation.ts";

const playerTemplates = new Set(["种族", "社群", "职业", "子职业", "自由", "武器", "护甲", "物品", "领域卡"]);
let base: ResourcePackageLogicalDocument;

beforeAll(async () => {
  const candidate = await loadValidatedCoreBook(
    new Uint8Array(await readFile("docs/third/daggerheart-core-book.pbres")), playerTemplates,
  );
  expect(candidate.document.resources).toHaveLength(640);
  const resource = candidate.document.resources.find(({ template }) => template.id === "种族")!;
  base = {
    ...candidate.document,
    assets: [],
    resources: [{ ...resource, media: {}, presentation: { ...resource.presentation, mode: "text" } }],
    emptyDirectories: [],
  };
});

async function archiveWith(change: (document: ResourcePackageLogicalDocument) => void) {
  const document = structuredClone(base);
  change(document);
  const media = new Map<string, Uint8Array>();
  document.snapshotDigest = await computeResourcePackageSnapshotDigest(document, media);
  return writePbres(document, media);
}

describe("core book archive admission", () => {
  it("accepts valid player data with real Contract and semantic validation", async () => {
    const bytes = await archiveWith(() => {});
    expect((await loadValidatedCoreBook(bytes, playerTemplates)).document.resources).toHaveLength(1);
  });

  it("rejects a Contract schema violation", async () => {
    const bytes = await archiveWith((document) => { document.package.version = "invalid"; });
    await expect(loadValidatedCoreBook(bytes, playerTemplates)).rejects.toThrow("Invalid core book archive");
  });

  it("rejects semantic duplicate resource IDs", async () => {
    const bytes = await archiveWith((document) => {
      document.resources.push({ ...document.resources[0]!, path: "duplicate.json" });
    });
    await expect(loadValidatedCoreBook(bytes, playerTemplates)).rejects.toThrow("Invalid core book archive");
  });

  it("rejects data outside the resolved Template schema", async () => {
    const bytes = await archiveWith((document) => { document.resources[0]!.data = {}; });
    await expect(loadValidatedCoreBook(bytes, playerTemplates)).rejects.toThrow("Invalid core book resource data");
  });

  it("rejects an unknown player Template version", async () => {
    const bytes = await archiveWith((document) => { document.resources[0]!.template.version = "999.0.0"; });
    await expect(loadValidatedCoreBook(bytes, playerTemplates)).rejects.toThrow("Unknown core book Template");
  });

  it.each(["敌人", "环境", "unknown-template"])("rejects non-player Template %s", async (id) => {
    const bytes = await archiveWith((document) => { document.resources[0]!.template.id = id; });
    await expect(loadValidatedCoreBook(bytes, playerTemplates)).rejects.toThrow("Non-player core book Template");
  });

  it("rejects an empty default scope", async () => {
    const bytes = await archiveWith((document) => { document.resources = []; });
    await expect(loadValidatedCoreBook(bytes, playerTemplates)).rejects.toThrow('"keyword":"minItems"');
  });
});
