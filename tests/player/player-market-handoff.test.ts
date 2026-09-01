import { readFileSync } from "node:fs";
import path from "node:path";

import {
  computeResourcePackageSnapshotDigest,
  writePbres,
  type ResourcePackageLogicalDocument,
  type SystemPackageDocument,
} from "@pbdh/contract-runtime";
import { describe, expect, test } from "vitest";

import {
  parsePlayerMarketHandoff,
  playerMarketArchiveUrl,
  playerMarketHandoffMismatch,
  withoutPlayerMarketHandoff,
  type PlayerMarketHandoff,
} from "../../apps/player/src/resources/market-handoff.ts";
import { buildSheetResourceLibraries } from "../../apps/player/src/sheet-runtime/adapters/platformResourceLibraries.ts";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { applyResourceSelectionToDraft } from "../../apps/player/src/sheet-runtime/domain/resourceSelection.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { prepareResourcePackageInstall } from "../../apps/player/src/resources/prepare-resource-package-install.ts";
import { commitResourcePackageInstall } from "../../apps/player/src/resources/resource-library.ts";

const root = process.cwd();
const document = JSON.parse(readFileSync(path.join(
  root,
  "contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-primary-weapon.json",
), "utf8")) as ResourcePackageLogicalDocument;
const system = JSON.parse(readFileSync(path.join(
  root,
  "apps/player/public/system-packages/daggerheart-core/system.json",
), "utf8")) as SystemPackageDocument;
const runtimeSystem = {
  manifest: { ID: "daggerheart-core", 名称: "匕首之心", 版本: "1.0.0", 角色数据版本: "1.0.0" },
  pages: [],
  modules: [
    { ID: "pick-primary-weapon", 类型: "resourcePicker", 按钮文本: "选择主武器", 资源库: "weapons" },
    { ID: "primary-weapon-name", 类型: "freeText", 标签: "主武器" },
    { ID: "primary-weapon-description", 类型: "freeText", 标签: "主武器特性" },
  ],
  dependencies: [{
    ID: "fill-primary-weapon",
    sources: [{ 类型: "resourcePicker", 模块ID: "pick-primary-weapon" }],
    targets: [
      { 类型: "module", 模块ID: "primary-weapon-name" },
      { 类型: "module", 模块ID: "primary-weapon-description" },
    ],
    触发: { 类型: "resourceSelected", 来源模块ID: "pick-primary-weapon" },
    条件: { 类型: "always" },
    动作: [
      {
        类型: "fillText",
        目标模块ID: "primary-weapon-name",
        内容: {
          类型: "selectedResourceTemplate",
          格式: "**{{名称}}**｜{{属性}}｜{{距离}}｜{{伤害}} {{伤害类型}}｜{{负荷}}",
        },
      },
      {
        类型: "fillText",
        目标模块ID: "primary-weapon-description",
        内容: { 类型: "selectedResourceField", 字段: "描述" },
      },
    ],
  }],
} as unknown as SystemPackage;
const asset = document.assets[0]!;
const media = new Map([[asset.id, new Uint8Array(readFileSync(path.join(
  root,
  "contracts/conformance/resource-package/1.0.0/media/a991add6e770461480dd9bf35fde9debe267f7f5b970d01cb65bb689166b28cd.webp",
)))]]);
const bytes = writePbres(document, media);
const adversaryDocument = JSON.parse(readFileSync(path.join(
  root,
  "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json",
), "utf8")) as ResourcePackageLogicalDocument;
const adversaryBytes = new Uint8Array(readFileSync(path.join(
  root,
  "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.pbres",
)));
const handoff: PlayerMarketHandoff = {
  target: "player",
  publicationId: "publication-weapon",
  packageId: document.package.id,
  packageVersion: document.package.version,
  snapshotDigest: document.snapshotDigest,
};

describe("Player Market handoff ingress", () => {
  test("parses and removes only an explicit Player publication handoff", () => {
    const url = new URL("http://localhost:5173/player?keep=1");
    url.searchParams.set("pbdhHandoff", "publication");
    url.searchParams.set("target", "player");
    url.searchParams.set("publicationId", handoff.publicationId);
    url.searchParams.set("packageId", handoff.packageId);
    url.searchParams.set("packageVersion", handoff.packageVersion);
    url.searchParams.set("snapshotDigest", handoff.snapshotDigest);
    url.searchParams.set("focusResourceId", document.resources[0]!.id);
    expect(parsePlayerMarketHandoff(url)).toEqual(handoff);
    expect(playerMarketArchiveUrl(handoff)).toBe(`/api/publications/${handoff.publicationId}/download`);
    expect(withoutPlayerMarketHandoff(url).search).toBe("?keep=1");
    url.searchParams.set("target", "creator");
    expect(parsePlayerMarketHandoff(url)).toBeNull();
  });

  test("rejects a downloaded snapshot that does not match the stable Market locator", () => {
    expect(playerMarketHandoffMismatch({ ...handoff, snapshotDigest: "sha256:other" }, { document, media }))
      .toBe("player.market-handoff.snapshot-mismatch");
  });

  test("uses the same candidate preparation for file and Market bytes", async () => {
    const fromFile = await prepareResourcePackageInstall({ bytes, currentSystem: system, library: new Map() });
    const fromMarket = await prepareResourcePackageInstall({
      bytes,
      currentSystem: system,
      library: new Map(),
      expectedMarketHandoff: handoff,
    });

    expect(fromFile).toMatchObject({ kind: "ready", plan: { kind: "insert" } });
    expect(fromMarket).toMatchObject({
      kind: "ready",
      plan: {
        kind: "insert",
        routes: [{ destination: "native", nativeEntry: { id: "weapons", label: "武器" } }],
      },
    });
  });

  test("routes a Creator-style Market weapon archive with no targets to Player weapons", async () => {
    const creatorDocument = structuredClone(document);
    creatorDocument.targets = [];
    creatorDocument.resources[0]!.template.version = "1.0.0";
    creatorDocument.snapshotDigest = await computeResourcePackageSnapshotDigest(creatorDocument, media);
    const creatorBytes = writePbres(creatorDocument, media);
    const result = await prepareResourcePackageInstall({
      bytes: creatorBytes,
      currentSystem: system,
      library: new Map(),
      expectedMarketHandoff: {
        target: "player",
        publicationId: "publication-creator-weapon",
        packageId: creatorDocument.package.id,
        packageVersion: creatorDocument.package.version,
        snapshotDigest: creatorDocument.snapshotDigest,
      },
    });

    expect(result).toMatchObject({
      kind: "ready",
      plan: {
        kind: "insert",
        routes: [{ destination: "native", nativeEntry: { id: "weapons", label: "武器" } }],
      },
    });
  });

  test("routes a real Market adversary archive to other resources", async () => {
    const result = await prepareResourcePackageInstall({
      bytes: adversaryBytes,
      currentSystem: system,
      library: new Map(),
      expectedMarketHandoff: {
        target: "player",
        publicationId: "publication-adversary",
        packageId: adversaryDocument.package.id,
        packageVersion: adversaryDocument.package.version,
        snapshotDigest: adversaryDocument.snapshotDigest,
      },
    });

    expect(result).toMatchObject({
      kind: "ready",
      plan: { kind: "insert", routes: [{ destination: "other-resources" }] },
    });
  });

  test("materializes a routed Market weapon through the Player dependency engine", async () => {
    const prepared = await prepareResourcePackageInstall({
      bytes,
      currentSystem: system,
      library: new Map(),
      expectedMarketHandoff: handoff,
    });
    if (prepared.kind !== "ready" || prepared.plan.kind !== "insert") throw new Error("expected insert plan");
    const installed = {
      document: prepared.plan.candidate.document,
      media: prepared.plan.candidate.media,
      routes: prepared.plan.routes,
    };
    const candidate = buildSheetResourceLibraries({
      currentSystem: system,
      installedPackages: new Map([[installed.document.package.id, installed]]),
    }).find((library) => library.ID === "weapons")?.entries[0];
    if (!candidate) throw new Error("expected routed weapon candidate");

    const applied = applyResourceSelectionToDraft(
      createEmptyCharacterData(runtimeSystem, "market-handoff"),
      runtimeSystem,
      "pick-primary-weapon",
      "weapons",
      [candidate],
    );

    expect(applied.interactionResult.warnings).toEqual([]);
    expect(applied.characterData.character.values).toMatchObject({
      "primary-weapon-name": "**阔剑**｜敏捷｜近战｜d8 物理｜单手",
      "primary-weapon-description": "可靠：你的攻击掷骰+1。",
    });
    expect(applied.characterData.resourceSelections).not.toHaveProperty("pick-primary-weapon");
  });

  test("keeps repeated installation of the same Market snapshot as a no-op", async () => {
    const first = await prepareResourcePackageInstall({
      bytes,
      currentSystem: system,
      library: new Map(),
      expectedMarketHandoff: handoff,
    });
    if (first.kind !== "ready" || first.plan.kind !== "insert") throw new Error("expected insert plan");
    const installed = {
      document: first.plan.candidate.document,
      media: first.plan.candidate.media,
      routes: first.plan.routes,
    };
    const repeated = await prepareResourcePackageInstall({
      bytes,
      currentSystem: system,
      library: new Map([[document.package.id, installed]]),
      expectedMarketHandoff: handoff,
    });

    expect(repeated).toMatchObject({ kind: "ready", plan: { kind: "no-op" } });
  });

  test("keeps the installed snapshot unchanged until a newer Market handoff is explicitly committed", async () => {
    const first = await prepareResourcePackageInstall({
      bytes,
      currentSystem: system,
      library: new Map(),
      expectedMarketHandoff: handoff,
    });
    if (first.kind !== "ready" || first.plan.kind !== "insert") throw new Error("expected insert plan");
    const installedLibrary = commitResourcePackageInstall(new Map(), first.plan);
    const installed = installedLibrary.get(document.package.id)!;

    const updatedDocument = structuredClone(document);
    (updatedDocument.resources[0]!.data as Record<string, unknown>).名称 = "阔剑·修订";
    updatedDocument.snapshotDigest = await computeResourcePackageSnapshotDigest(updatedDocument, media);
    const updatedBytes = writePbres(updatedDocument, media);
    const update = await prepareResourcePackageInstall({
      bytes: updatedBytes,
      currentSystem: system,
      library: installedLibrary,
      expectedMarketHandoff: {
        ...handoff,
        snapshotDigest: updatedDocument.snapshotDigest,
      },
    });

    expect(update).toMatchObject({ kind: "ready", plan: { kind: "update" } });
    expect(installedLibrary.get(document.package.id)).toBe(installed);
    expect((installed.document.resources[0]!.data as Record<string, unknown>).名称).toBe("阔剑");
    if (update.kind !== "ready" || update.plan.kind !== "update") throw new Error("expected update plan");
    const updatedLibrary = commitResourcePackageInstall(installedLibrary, update.plan);
    expect((updatedLibrary.get(document.package.id)!.document.resources[0]!.data as Record<string, unknown>).名称)
      .toBe("阔剑·修订");
  });

  test("reports mismatched Market bytes before creating an install plan", async () => {
    const result = await prepareResourcePackageInstall({
      bytes,
      currentSystem: system,
      library: new Map(),
      expectedMarketHandoff: { ...handoff, packageId: "package-other" },
    });

    expect(result).toMatchObject({
      kind: "invalid",
      diagnostics: [{ code: "player.market-handoff.package-id-mismatch" }],
    });
  });
});
