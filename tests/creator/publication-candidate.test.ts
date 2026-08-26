import { readFileSync } from "node:fs";
import path from "node:path";

import {
  computeResourcePackageSnapshotDigest,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import { describe, expect, test } from "vitest";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0-alpha.1/valid/minotaur-wrecker.json";
import {
  defaultPublicationCoverAssetId,
  preparePublicationCandidate,
} from "../../apps/creator/src/workspace-prototype/publication-candidate.ts";
import {
  createWorkspace,
  removePortrait,
} from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

const root = process.cwd();
const document = minotaurPackage as ResourcePackageLogicalDocument;
const asset = document.assets[0]!;
const bytes = new Uint8Array(readFileSync(path.join(
  root,
  "contracts/conformance/resource-package/1.0.0-alpha.1/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
)));
const metadata = {
  title: "荒野遭遇集",
  summary: "公开版本简介",
  language: "中文",
  tags: ["敌人", "荒野"],
  coverAssetId: asset.id,
};

describe("Creator publication candidate", () => {
  test("uses the first resource card media as the default cover", () => {
    const firstCardAsset = {
      ...asset,
      id: `sha256:${"1".repeat(64)}`,
    };
    const firstResource = structuredClone(document.resources[0]!);
    firstResource.id = "first-card";
    firstResource.media = { portrait: firstCardAsset.id };
    const secondResource = structuredClone(document.resources[0]!);
    secondResource.id = "second-card";
    secondResource.media = { portrait: asset.id };
    const source = structuredClone(document);
    source.assets = [asset, firstCardAsset];
    source.resources = [firstResource, secondResource];

    expect(defaultPublicationCoverAssetId(source)).toBe(firstCardAsset.id);
  });

  test("adds the publication cover to the complete snapshot and recomputes its digest", async () => {
    const source = removePortrait(createWorkspace({
      document,
      media: new Map([[asset.id, bytes]]),
    }));
    const sourceDigest = source.document.snapshotDigest;

    const result = await preparePublicationCandidate(source, metadata, { asset, bytes });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.document.assets).toEqual([asset]);
    expect(result.candidate.media.get(asset.id)).toEqual(bytes);
    expect(result.candidate.document.snapshotDigest).not.toBe(sourceDigest);
    expect(result.candidate.document.snapshotDigest).toBe(await computeResourcePackageSnapshotDigest(
      result.candidate.document,
      result.candidate.media,
    ));
    expect(source.document.assets).toEqual([]);
    expect(source.media.size).toBe(0);
  });

  test("keeps discovery metadata outside the resource package content", async () => {
    const source = createWorkspace({ document, media: new Map([[asset.id, bytes]]) });
    const result = await preparePublicationCandidate(source, metadata);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.metadata).toEqual(metadata);
    expect(result.candidate.document.package.name).toBe(document.package.name);
    expect(JSON.stringify(result.candidate.document)).not.toContain(metadata.title);
  });

  test("returns diagnostics without mutating the workspace when the cover bytes do not match", async () => {
    const source = removePortrait(createWorkspace({
      document,
      media: new Map([[asset.id, bytes]]),
    }));
    const before = structuredClone(source.document);

    const result = await preparePublicationCandidate(source, metadata, {
      asset,
      bytes: bytes.slice(0, 32),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.some((item) => item.severity === "error")).toBe(true);
    expect(source.document).toEqual(before);
    expect(source.media.size).toBe(0);
  });
});
