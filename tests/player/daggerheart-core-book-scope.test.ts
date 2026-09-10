import { describe, expect, it } from "vitest";

import { filterCoreBookLibraries } from "../../scripts/daggerheart-core-book-scope.ts";

describe("default core book generation scope", () => {
  it("keeps source content and library ownership while excluding expansion IDs", () => {
    const libraries = [
      { id: "classes", entries: [{ ID: "core-class", name: "updated translation" }, { ID: "expansion", name: "extra" }] },
      { id: "armor", entries: [{ ID: "core-armor", name: "armor" }] },
    ];
    const selected = filterCoreBookLibraries(libraries, [{ id: "core-class" }, { id: "core-armor" }]);
    expect(selected).toEqual([
      { id: "classes", entries: [libraries[0]!.entries[0]] },
      { id: "armor", entries: [libraries[1]!.entries[0]] },
    ]);
    expect(selected[0]!.entries[0]).toBe(libraries[0]!.entries[0]);
    expect(libraries[0]!.entries).toHaveLength(2);
  });

  it("fails closed when a core ID is missing even if an expansion entry has the same name", () => {
    expect(() => filterCoreBookLibraries(
      [{ entries: [{ ID: "expansion", name: "same name" }] }], [{ id: "missing-core" }],
    )).toThrow("Missing core book resource IDs in source: missing-core");
  });

  it("rejects duplicate core IDs across source libraries", () => {
    expect(() => filterCoreBookLibraries(
      [{ entries: [{ ID: "core" }] }, { entries: [{ ID: "core" }] }], [{ id: "core" }],
    )).toThrow("Duplicate core book resource ID in source: core");
  });

  it("rejects empty or duplicate scope IDs", () => {
    expect(() => filterCoreBookLibraries([], [])).toThrow("nonempty and unique");
    expect(() => filterCoreBookLibraries([], [{ id: "core" }, { id: "core" }])).toThrow("nonempty and unique");
  });
});
