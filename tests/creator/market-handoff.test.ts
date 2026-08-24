import { describe, expect, test } from "vitest";

import {
  parseCreatorMarketHandoff,
  withoutCreatorMarketHandoff,
} from "../../apps/creator/src/workspace-prototype/market-handoff.ts";

describe("Creator Market handoff ingress", () => {
  test("accepts only an explicit Creator-hosted publication handoff", () => {
    expect(parseCreatorMarketHandoff("http://localhost:5173/?pbdhHandoff=publication&target=gm&publicationId=pub-1&snapshotDigest=sha256%3Aabc&focusResourceId=res-1")).toEqual({
      target: "gm",
      publicationId: "pub-1",
      snapshotDigest: "sha256:abc",
      focusResourceId: "res-1",
    });
    expect(parseCreatorMarketHandoff("http://localhost:5173/?target=gm")).toBeNull();
  });

  test("removes one-shot handoff parameters without disturbing other URL state", () => {
    const cleaned = withoutCreatorMarketHandoff("http://localhost:5173/?state=empty&pbdhHandoff=publication&target=creator&publicationId=pub-1&snapshotDigest=digest");
    expect(cleaned.search).toBe("?state=empty");
  });
});
