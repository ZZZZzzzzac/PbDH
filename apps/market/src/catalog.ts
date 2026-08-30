import minotaurImageUrl from "../../../contracts/conformance/resource-package/1.0.0/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp?url";
import minotaurArchiveUrl from "../../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.pbres?url";
import minotaurPackage from "../../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import weaponArchiveUrl from "../../../contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-primary-weapon.pbres?url";
import weaponPackage from "../../../contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-primary-weapon.json";
import weaponCoverUrl from "../../../contracts/conformance/resource-package/1.0.0/media/a991add6e770461480dd9bf35fde9debe267f7f5b970d01cb65bb689166b28cd.webp?url";

import type { Publication, PublicationResource } from "./market-model.ts";
export { catalogOptions } from "./catalog-options.ts";

const systemId = "01a0132c-4eef-7703-94ac-ec8d1a660001";

function resourceFromFixture(resource: {
  id: string;
  path: string;
  template: { id: string };
  data: Record<string, unknown>;
}) : PublicationResource {
  return {
    id: resource.id,
    name: String(resource.data.名称 ?? resource.path),
    templateId: resource.template.id,
    path: resource.path,
    data: resource.data,
    source: resource,
  };
}

const enemyResources = minotaurPackage.resources.map((resource) =>
  resourceFromFixture(resource as Parameters<typeof resourceFromFixture>[0]),
);
const weaponResources = weaponPackage.resources.map((resource) =>
  resourceFromFixture(resource as Parameters<typeof resourceFromFixture>[0]),
);

export const publications: Publication[] = [
  {
    id: "publication-wilderness-encounters",
    packageId: minotaurPackage.package.id,
    packageVersion: minotaurPackage.package.version,
    snapshotDigest: minotaurPackage.snapshotDigest,
    title: "荒野遭遇集",
    ownerAccountId: "01a01d94-6088-7c18-a4b7-2097f36b0001",
    author: "灰烬档案馆",
    summary: "适合荒野与遗迹场景的高威胁敌人资源。",
    kind: "enemy",
    templateIds: ["敌人"],
    systems: [systemId],
    systemLabels: ["匕首之心"],
    language: "中文",
    categories: ["敌人", "遭遇"],
    tags: ["荒野", "遗迹", "高威胁"],
    license: minotaurPackage.license.label,
    updatedAt: "2026-08-18",
    resourceCount: enemyResources.length,
    status: "published",
    cover: {
      assetId: minotaurPackage.assets[0].id,
      url: minotaurImageUrl,
      alt: "荒野遭遇集封面",
    },
    archiveUrl: minotaurArchiveUrl,
    archiveName: "wilderness-encounters.pbres",
    resources: enemyResources,
  },
  {
    id: "publication-iron-and-oath",
    packageId: weaponPackage.package.id,
    packageVersion: weaponPackage.package.version,
    snapshotDigest: weaponPackage.snapshotDigest,
    title: "铁与誓言",
    ownerAccountId: "01a01d94-6088-7c18-a4b7-2097f36b0002",
    author: "黑曜工坊",
    summary: "为近战角色准备的 Daggerheart Core 主武器资源。",
    kind: "weapon",
    templateIds: ["武器"],
    systems: [systemId],
    systemLabels: ["匕首之心"],
    language: "中文",
    categories: ["武器", "装备"],
    tags: ["主武器", "近战", "Daggerheart"],
    license: weaponPackage.license.label,
    updatedAt: "2026-08-18",
    resourceCount: weaponResources.length,
    status: "published",
    cover: {
      assetId: weaponPackage.assets[0].id,
      url: weaponCoverUrl,
      alt: "铁与誓言封面",
    },
    archiveUrl: weaponArchiveUrl,
    archiveName: "iron-and-oath.pbres",
    resources: weaponResources,
  },
];

export const fixtureAssetUrls = new Map([
  [minotaurPackage.assets[0].id, { status: "ready" as const, url: minotaurImageUrl }],
]);
