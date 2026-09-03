import { describe, expect, test, vi } from "vitest";

import {
  moveTab,
  orderTabsByKey,
  readStoredTabOrder,
  reconcileTabOrder,
  resourceTabKey,
  sameTabOrder,
  shouldActivateTabDrag,
  writeStoredTabOrder,
} from "../../apps/creator/src/workspace-prototype/tab-order.ts";

describe("Creator and GM tab ordering", () => {
  test("reconciles saved order with newly opened and closed tabs", () => {
    expect(reconcileTabOrder(["b", "closed", "a"], ["a", "b", "new"]))
      .toEqual(["b", "a", "new"]);
  });

  test("moves a tab before or after the drop target without changing the active identity", () => {
    expect(moveTab(["a", "b", "c", "d"], "d", "b", "before")).toEqual(["a", "d", "b", "c"]);
    expect(moveTab(["a", "b", "c", "d"], "a", "c", "after")).toEqual(["b", "c", "a", "d"]);
    expect(moveTab(["a", "b"], "a", "a", "after")).toEqual(["a", "b"]);
  });

  test("keeps click-sized pointer jitter below the drag activation threshold", () => {
    expect(shouldActivateTabDrag(100, 108)).toBe(false);
    expect(shouldActivateTabDrag(100, 108.1)).toBe(true);
    expect(shouldActivateTabDrag(100, 91.9)).toBe(true);
  });

  test("orders resource tabs across packages by their composite identity", () => {
    const first = { workspaceKey: "package-a", resourceId: "shared" };
    const second = { workspaceKey: "package-b", resourceId: "shared" };
    const keyOf = (item: typeof first) => resourceTabKey(item.workspaceKey, item.resourceId);
    expect(orderTabsByKey([first, second], [keyOf(second), keyOf(first)], keyOf)).toEqual([second, first]);
  });

  test("reads, deduplicates, and writes local UI preferences", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } });
    values.set("tabs", JSON.stringify(["b", "a", "b", 4, ""]));
    expect(readStoredTabOrder("tabs")).toEqual(["b", "a"]);
    writeStoredTabOrder("tabs", ["a", "b"]);
    expect(values.get("tabs")).toBe('["a","b"]');
    expect(sameTabOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameTabOrder(["a", "b"], ["b", "a"])).toBe(false);
    vi.unstubAllGlobals();
  });
});
