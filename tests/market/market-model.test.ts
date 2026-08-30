import { describe, expect, test } from "vitest";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import weaponPackage from "../../contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-primary-weapon.json";
import { publications } from "../../apps/market/src/catalog.ts";
import { pbresArchiveName } from "../../apps/market/src/market-api.ts";
import {
  canManagePublication,
  canAcquirePublication,
  createCreatorHandoffUrl,
  createHandoffIntent,
  createPlayerHandoffUrl,
  emptyCatalogFilters,
  filterPublications,
  publicationsOwnedBy,
  setPublicationStatus,
  summarizePublicationTemplates,
  updatePublicationDisplayMetadata,
  type Publication,
} from "../../apps/market/src/market-model.ts";

function publication(overrides: Partial<Publication> = {}): Publication {
  return {
    id: "publication-enemy",
    packageId: "package-enemy",
    packageVersion: "1.2.0",
    snapshotDigest: "sha256:enemy",
    title: "荒野遭遇集",
    ownerAccountId: "account-owner",
    author: "灰烬档案馆",
    summary: "荒野敌人",
    kind: "enemy",
    templateIds: ["敌人"],
    systems: ["daggerheart-core"],
    systemLabels: ["匕首之心"],
    language: "中文",
    categories: ["敌人", "遭遇"],
    tags: ["荒野"],
    license: "CC BY 4.0",
    updatedAt: "2026-08-18",
    resourceCount: 1,
    status: "published",
    cover: { assetId: "sha256:cover", url: "cover.webp", alt: "封面" },
    archiveUrl: "package.pbres",
    archiveName: "package.pbres",
    resources: [{
      id: "resource-minotaur",
      name: "牛头人破坏者",
      templateId: "敌人",
      path: "敌人/牛头人破坏者.json",
      data: {},
      source: {},
    }],
    ...overrides,
  };
}

describe("Market catalog filters", () => {
  const enemy = publication();
  const weapon = publication({
    id: "publication-weapon",
    packageId: "package-weapon",
    snapshotDigest: "sha256:weapon",
    title: "铁与誓言",
    author: "黑曜工坊",
    kind: "weapon",
    templateIds: ["武器"],
    categories: ["武器", "装备"],
    resources: [{ id: "resource-broadsword", name: "阔剑", templateId: "武器", path: "武器/阔剑.json", data: {}, source: {} }],
  });

  test("uses OR inside one dimension", () => {
    const result = filterPublications([enemy, weapon], "", {
      ...emptyCatalogFilters,
      templateIds: ["敌人", "武器"],
    });
    expect(result.map((item) => item.id)).toEqual([enemy.id, weapon.id]);
  });

  test("uses AND across dimensions", () => {
    const result = filterPublications([enemy, weapon], "", {
      ...emptyCatalogFilters,
      templateIds: ["敌人", "武器"],
      categories: ["装备"],
    });
    expect(result.map((item) => item.id)).toEqual([weapon.id]);
  });

  test("searches package metadata and contained resources", () => {
    expect(filterPublications([enemy, weapon], "牛头人破坏者", emptyCatalogFilters)).toEqual([enemy]);
    expect(filterPublications([enemy, weapon], "黑曜", emptyCatalogFilters)).toEqual([weapon]);
  });

  test("keeps authorized unpublished publications in the supplied catalog", () => {
    const unpublished = publication({ id: "unpublished", status: "unpublished" });
    expect(filterPublications([enemy, unpublished], "", emptyCatalogFilters)).toEqual([enemy, unpublished]);
  });

  test("uses a declared Resource Package Asset for every publication cover", () => {
    const packages = new Map<string, { assets: Array<{ id: string }> }>([
      [minotaurPackage.package.id, minotaurPackage],
      [weaponPackage.package.id, weaponPackage],
    ]);
    for (const item of publications) {
      expect(packages.get(item.packageId)?.assets.some((asset) => asset.id === item.cover.assetId)).toBe(true);
    }
  });
});

describe("Market publication template summary", () => {
  test("sorts templates by resource count and limits cards to three plus an omission badge", () => {
    const mixed = publication({
      templateIds: ["社群", "护甲", "武器", "职业", "种族"],
      resources: [
        ...Array.from({ length: 4 }, (_, index) => ({ id: `weapon-${index}`, name: "武器", templateId: "武器", path: "", data: {}, source: {} })),
        ...Array.from({ length: 3 }, (_, index) => ({ id: `armor-${index}`, name: "护甲", templateId: "护甲", path: "", data: {}, source: {} })),
        ...Array.from({ length: 2 }, (_, index) => ({ id: `community-${index}`, name: "社群", templateId: "社群", path: "", data: {}, source: {} })),
        { id: "profession", name: "职业", templateId: "职业", path: "", data: {}, source: {} },
        { id: "ancestry", name: "种族", templateId: "种族", path: "", data: {}, source: {} },
      ],
    });

    expect(summarizePublicationTemplates(mixed)).toEqual({
      templateIds: ["武器", "护甲", "社群"],
      omittedCount: 2,
    });
  });
});

describe("Market handoff intents", () => {
  const enemy = publication();
  const weapon = publication({
    id: "publication-weapon",
    packageId: "package-weapon",
    snapshotDigest: "sha256:weapon",
    kind: "weapon",
    templateIds: ["武器"],
    resources: [{ id: "resource-broadsword", name: "阔剑", templateId: "武器", path: "武器/阔剑.json", data: {}, source: {} }],
  });

  test("single-resource entry still acquires the complete package and only adds focus", () => {
    const intent = createHandoffIntent(enemy, "creator", "resource-minotaur");
    expect(intent).toMatchObject({
      acquisition: "complete-resource-package",
      packageId: enemy.packageId,
      focusLocator: { resourceId: "resource-minotaur" },
      targetRoute: "creator-ingress",
      autoInstall: false,
    });
  });

  test("routes a native primary weapon and an enemy to different Player entries", () => {
    expect(createHandoffIntent(weapon, "player").targetRoute).toBe("weapons");
    expect(createHandoffIntent(enemy, "player").targetRoute).toBe("other-resources");
  });

  test.each([
    ["种族", "ancestries"], ["社群", "communities"], ["职业", "classes"],
    ["子职业", "subclasses"], ["物品", "loot"], ["领域卡", "domain-cards"],
  ] as const)("routes %s to its native Player entry", (templateId, targetRoute) => {
    const native = publication({
      kind: "mixed",
      templateIds: [templateId],
      resources: [{ id: `resource-${templateId}`, name: `测试${templateId}`, templateId, path: `${templateId}/测试.json`, data: {}, source: {} }],
    });
    expect(createHandoffIntent(native, "player", `resource-${templateId}`).targetRoute).toBe(targetRoute);
    expect(createHandoffIntent(native, "player").targetRoute).toBe(targetRoute);
  });

  test("does not use a focused card to change a whole-package Player handoff", () => {
    const mixed = publication({
      kind: "mixed",
      templateIds: ["敌人", "武器"],
      resources: [...enemy.resources, ...weapon.resources],
    });
    expect(createHandoffIntent(mixed, "player", "resource-broadsword")).not.toHaveProperty("focusLocator");
    expect(createHandoffIntent(mixed, "player", "resource-broadsword").targetRoute).toBe("other-resources");
    expect(createHandoffIntent(mixed, "player", "resource-minotaur").targetRoute).toBe("other-resources");
  });

  test("GM handoff uses the same shared Creator workspace ingress without auto placement", () => {
    expect(createHandoffIntent(enemy, "gm", "resource-minotaur")).toMatchObject({
      targetRoute: "creator-ingress",
      autoInstall: false,
      autoPlace: false,
    });
  });

  test("serializes Creator-hosted handoff as an explicit package ingress URL", () => {
    const url = createCreatorHandoffUrl(
      createHandoffIntent(enemy, "gm", "resource-minotaur"),
      "http://localhost:5173/gm",
    );
    expect(url.origin).toBe("http://localhost:5173");
    expect(url.pathname).toBe("/gm");
    expect(url.searchParams.get("target")).toBe("gm");
    expect(url.searchParams.get("publicationId")).toBe(enemy.id);
    expect(url.searchParams.get("packageId")).toBe(enemy.packageId);
    expect(url.searchParams.get("packageVersion")).toBe(enemy.packageVersion);
    expect(url.searchParams.get("focusResourceId")).toBe("resource-minotaur");
    expect(url.searchParams.get("snapshotDigest")).toBe(enemy.snapshotDigest);
  });

  test("serializes an explicit Creator fork separately from an ordinary import", () => {
    const intent = createHandoffIntent(enemy, "creator", "resource-minotaur", false, "fork");
    const url = createCreatorHandoffUrl(intent, "http://localhost:5173/creator");
    expect(intent.creatorMode).toBe("fork");
    expect(url.searchParams.get("creatorMode")).toBe("fork");
    expect(() => createHandoffIntent(enemy, "gm", undefined, false, "fork"))
      .toThrow("handoff.fork.target-not-creator");
  });

  test("serializes Player handoff as a whole-package install without a focused resource", () => {
    const url = createPlayerHandoffUrl(
      createHandoffIntent(weapon, "player", "resource-broadsword"),
      "http://localhost:5173/player",
    );
    expect(url.origin).toBe("http://localhost:5173");
    expect(url.pathname).toBe("/player");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      pbdhHandoff: "publication",
      target: "player",
      publicationId: weapon.id,
      packageId: weapon.packageId,
      packageVersion: weapon.packageVersion,
      snapshotDigest: weapon.snapshotDigest,
    });
  });

  test("rejects unpublished acquisition and forged focus locators", () => {
    expect(() => createHandoffIntent(publication({ status: "unpublished" }), "player")).toThrow("publication.unpublished");
    expect(() => createHandoffIntent(enemy, "creator", "missing")).toThrow("focus.resource.not-found");
    expect(createHandoffIntent(enemy, "player", "missing")).not.toHaveProperty("focusLocator");
  });

  test("allows authors and administrators to acquire an unpublished publication", () => {
    const unpublished = publication({ status: "unpublished" });

    expect(canAcquirePublication(unpublished, false)).toBe(false);
    expect(canAcquirePublication(unpublished, true)).toBe(true);
    expect(canAcquirePublication(enemy, false)).toBe(true);
  });
});

describe("Market publication lifecycle", () => {
  test("uses a readable and filesystem-safe package name for downloads", () => {
    expect(pbresArchiveName(" 牛头人/武器包 ")).toBe("牛头人-武器包.pbres");
    expect(pbresArchiveName("CON")).toBe("CON-资源包.pbres");
    expect(pbresArchiveName("... ")).toBe("资源包.pbres");
  });

  test("selects owned publications by stable account ID rather than display name", () => {
    const owned = publication({ id: "owned", ownerAccountId: "account-owner", author: "同名作者" });
    const other = publication({ id: "other", ownerAccountId: "account-other", author: "同名作者" });

    expect(publicationsOwnedBy([owned, other], "account-owner")).toEqual([owned]);
    expect(canManagePublication(owned, "account-owner")).toBe(true);
    expect(canManagePublication(other, "account-owner")).toBe(false);
    expect(canManagePublication(other, "account-admin", true)).toBe(true);
  });

  test("edits display metadata without replacing the current package snapshot", () => {
    const current = publication();
    const updated = updatePublicationDisplayMetadata(current, {
      title: "荒野遭遇集·修订展示",
      summary: "只修改公开文案",
      language: "中文",
      categories: ["敌人"],
      tags: ["荒野", "高威胁"],
      cover: current.cover,
    });

    expect(updated).toMatchObject({
      title: "荒野遭遇集·修订展示",
      packageId: current.packageId,
      packageVersion: current.packageVersion,
      snapshotDigest: current.snapshotDigest,
      archiveUrl: current.archiveUrl,
    });
    expect(current.title).toBe("荒野遭遇集");
  });

  test("withdraws and restores the same publication identity", () => {
    const current = publication();
    const unpublished = setPublicationStatus(current, "unpublished");
    const restored = setPublicationStatus(unpublished, "published");

    expect(unpublished.status).toBe("unpublished");
    expect(restored).toMatchObject({
      id: current.id,
      packageId: current.packageId,
      snapshotDigest: current.snapshotDigest,
      status: "published",
    });
  });
});
