import { describe, expect, test, vi } from "vitest";

import {
  ManagedObjectUrlRegistry,
  type ObjectUrlFactory,
} from "../../apps/creator/src/workspace-prototype/use-managed-object-urls.ts";

function factory() {
  let sequence = 0;
  const create = vi.fn((_blob: Blob) => `blob:test-${++sequence}`);
  const revoke = vi.fn((_url: string) => undefined);
  return { factory: { create, revoke } satisfies ObjectUrlFactory, create, revoke };
}

describe("ManagedObjectUrlRegistry", () => {
  test("reuses a content-addressed asset URL and revokes only unreachable assets", () => {
    const urls = factory();
    const registry = new ManagedObjectUrlRegistry(urls.factory);

    expect(registry.addBytes([
      ["sha256:one", new Uint8Array([1])],
      ["sha256:two", new Uint8Array([2])],
    ])).toBe(true);
    expect(registry.addBytes([["sha256:one", new Uint8Array([9])]])).toBe(false);
    expect(urls.create).toHaveBeenCalledTimes(2);

    expect(registry.retain(["sha256:one"])).toBe(true);
    expect(urls.revoke).toHaveBeenCalledWith("blob:test-2");
    expect([...registry.snapshot()]).toEqual([["sha256:one", "blob:test-1"]]);
  });

  test("disposal revokes every remaining URL exactly once", () => {
    const urls = factory();
    const registry = new ManagedObjectUrlRegistry(urls.factory);
    registry.addBlob("sha256:one", new Blob(["one"]));
    registry.addBlob("sha256:two", new Blob(["two"]));

    registry.dispose();
    registry.dispose();

    expect(urls.revoke.mock.calls).toEqual([["blob:test-1"], ["blob:test-2"]]);
    expect(registry.snapshot()).toEqual(new Map());
  });
});
