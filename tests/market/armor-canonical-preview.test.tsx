import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test } from "vitest";
import { loadTrustedRenderer } from "@pbdh/templates/frontend/lazy";
beforeAll(() => loadTrustedRenderer("护甲", "1.0.0"));

import armorPackage from "../../contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-armor.json";
import { CanonicalPreview } from "../../apps/market/src/MarketApp.tsx";
import { canAcquirePublication, createHandoffIntent, type Publication } from "../../apps/market/src/market-model.ts";

const armor = armorPackage.resources[0]!;
const publication: Publication = {
  id: "publication-armor",
  packageId: armorPackage.package.id,
  packageVersion: armorPackage.package.version,
  snapshotDigest: armorPackage.snapshotDigest,
  title: armorPackage.package.name,
  ownerAccountId: "armor-author",
  author: "护甲工坊",
  summary: armorPackage.package.description,
  kind: "mixed",
  templateIds: ["护甲"],
  systems: ["daggerheart-core"],
  systemLabels: ["匕首之心"],
  language: "中文",
  categories: ["护甲"],
  tags: ["装备"],
  license: armorPackage.license.label,
  updatedAt: "2026-08-27",
  resourceCount: 1,
  status: "published",
  cover: { assetId: "", url: "", alt: "" },
  archiveUrl: "daggerheart-core-armor.pbres",
  archiveName: "daggerheart-core-armor.pbres",
  resources: [{
    id: armor.id,
    name: armor.data.名称,
    templateId: armor.template.id,
    path: armor.path,
    data: armor.data,
    source: armor,
  }],
};

describe("Market armor Canonical Resource preview", () => {
  test("allows anonymous acquisition and renders the shared armor surface", () => {
    expect(canAcquirePublication(publication, false)).toBe(true);
    expect(createHandoffIntent(publication, "player", armor.id)).toMatchObject({
      acquisition: "complete-resource-package",
      packageId: armorPackage.package.id,
      snapshotDigest: armorPackage.snapshotDigest,
      targetRoute: "armor",
    });

    const markup = renderToStaticMarkup(<CanonicalPreview publication={publication} resourceId={armor.id} />);
    expect(markup).toContain("填充布甲规范卡面");
    expect(markup).toContain("data-pbdh-canonical-surface");
    expect(markup).not.toContain("当前版本尚不能预览此模板");
  });
});
