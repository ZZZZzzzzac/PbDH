import { describe, expect, test } from "vitest";
import type { ResourcePackageCandidate } from "@pbdh/contract-runtime";

import {
  creatorMarketHandoffMismatch,
  parseCreatorMarketHandoff,
  withoutCreatorMarketHandoff,
} from "../../apps/creator/src/workspace-prototype/market-handoff.ts";

describe("Creator Market handoff ingress", () => {
  test("accepts only an explicit Creator-hosted publication handoff", () => {
    expect(parseCreatorMarketHandoff("http://localhost:5173/gm?pbdhHandoff=publication&target=gm&publicationId=pub-1&packageId=package-1&packageVersion=1.0.0&snapshotDigest=sha256%3Aabc&focusResourceId=res-1")).toEqual({
      target: "gm",
      publicationId: "pub-1",
      packageId: "package-1",
      packageVersion: "1.0.0",
      snapshotDigest: "sha256:abc",
      focusResourceId: "res-1",
    });
    expect(parseCreatorMarketHandoff("http://localhost:5173/gm?target=gm")).toBeNull();
    expect(parseCreatorMarketHandoff("http://localhost:5173/gm?pbdhHandoff=publication&target=gm&publicationId=pub-1&snapshotDigest=digest")).toBeNull();
  });

  test("removes one-shot handoff parameters without disturbing other URL state", () => {
    const cleaned = withoutCreatorMarketHandoff("http://localhost:5173/creator?state=empty&pbdhHandoff=publication&target=creator&publicationId=pub-1&packageId=package-1&packageVersion=1.0.0&snapshotDigest=digest");
    expect(cleaned.search).toBe("?state=empty");
  });

  test("binds the downloaded package to the complete stable handoff locator", () => {
    const handoff = parseCreatorMarketHandoff("http://localhost:5173/gm?pbdhHandoff=publication&target=gm&publicationId=pub-1&packageId=package-1&packageVersion=1.0.0&snapshotDigest=sha256%3Aabc&focusResourceId=resource-1")!;
    const candidate = {
      document: {
        package: { id: "package-1", version: "1.0.0" },
        snapshotDigest: "sha256:abc",
        resources: [{ id: "resource-1" }],
      },
      media: new Map(),
    } as ResourcePackageCandidate;

    expect(creatorMarketHandoffMismatch(handoff, candidate)).toBeNull();
    expect(creatorMarketHandoffMismatch(handoff, {
      ...candidate,
      document: { ...candidate.document, package: { ...candidate.document.package, id: "package-other" } },
    })).toBe("creator.market-handoff.package-id-mismatch");
    expect(creatorMarketHandoffMismatch(handoff, {
      ...candidate,
      document: { ...candidate.document, package: { ...candidate.document.package, version: "1.0.1" } },
    })).toBe("creator.market-handoff.package-version-mismatch");
    expect(creatorMarketHandoffMismatch(handoff, {
      ...candidate,
      document: { ...candidate.document, snapshotDigest: "sha256:other" },
    })).toBe("creator.market-handoff.snapshot-mismatch");
    expect(creatorMarketHandoffMismatch(handoff, {
      ...candidate,
      document: { ...candidate.document, resources: [] },
    })).toBe("creator.market-handoff.focus-resource-not-found");
  });
});
