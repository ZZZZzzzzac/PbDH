import { describe, expect, it } from "vitest";
import type { ResourceLibrary } from "../../apps/player/src/sheet-runtime/domain/resourceLibrary.ts";
import { queryResourceLibraryEntries } from "../../apps/player/src/sheet-runtime/domain/resourceLibrary.ts";
import {
  loadResourcePickerQueries,
  mergedResourcePickerDefaultQuery,
  removeResourcePickerQueries,
  resourcePickerQueryCacheKey,
  sanitizeResourcePickerQuery,
  saveResourcePickerQueries,
  type ResourcePickerQueriesByLibrary,
} from "../../apps/player/src/sheet-runtime/storage/resourcePickerQueryCache.ts";

const library: ResourceLibrary = {
  ID: "weapons",
  名称: "武器",
  路径: "weapons",
  fields: [
    { key: "名称", label: "名称", visible: true, filterable: true, sortable: true, searchable: true },
    { key: "位阶", label: "位阶", visible: true, filterable: true, sortable: true, searchable: true },
    { key: "简介", label: "简介", visible: true, filterable: false, sortable: false, searchable: true },
    { key: "隐藏", label: "隐藏", visible: false, filterable: true, sortable: true, searchable: false },
  ],
  entries: [
    { ID: "sword", fields: { 名称: "剑", 位阶: "1", 简介: "锋利的剑", 隐藏: "x" } },
    { ID: "axe", fields: { 名称: "斧", 位阶: "2", 简介: "沉重的斧", 隐藏: "y" } },
  ],
};

describe("Resource Picker Query Cache", () => {
  it("按存档和模块隔离读写，不覆盖同一存档的其他模块", () => {
    const storage = createStorage();
    const pickerQueries: ResourcePickerQueriesByLibrary = {
      weapons: { filters: { 位阶: ["1"] }, sort: { field: "名称", direction: "asc" } },
    };

    saveResourcePickerQueries("pkg", "save-1", "pick-weapon", pickerQueries, storage);
    expect(loadResourcePickerQueries("pkg", "save-1", "pick-weapon", storage)).toEqual(pickerQueries);
    expect(loadResourcePickerQueries("pkg", "save-2", "pick-weapon", storage)).toEqual({});
    expect(loadResourcePickerQueries("pkg", "save-1", "pick-armor", storage)).toEqual({});

    saveResourcePickerQueries("pkg", "save-1", "pick-armor", { armor: { keywords: "皮" } }, storage);
    expect(loadResourcePickerQueries("pkg", "save-1", "pick-weapon", storage)).toEqual(pickerQueries);
    expect(loadResourcePickerQueries("pkg", "save-1", "pick-armor", storage)).toEqual({ armor: { keywords: "皮" } });

    removeResourcePickerQueries("pkg", "save-1", storage);
    expect(storage.values.has(resourcePickerQueryCacheKey("pkg", "save-1"))).toBe(false);
  });

  it("保留显式清空的查询，丢弃损坏或无法识别的缓存", () => {
    const storage = createStorage();
    const key = resourcePickerQueryCacheKey("pkg", "save-1");

    saveResourcePickerQueries("pkg", "save-1", "pick-weapon", { weapons: { filters: {}, keywords: "" } }, storage);
    expect(loadResourcePickerQueries("pkg", "save-1", "pick-weapon", storage)).toEqual({ weapons: { keywords: "" } });

    storage.setItem(key, JSON.stringify({
      pick: {
        weapons: { filters: { 位阶: ["1"] } },
        armor: { filters: "bad" },
        unknown: { note: "random" },
      },
      broken: "not-an-object",
    }));
    expect(loadResourcePickerQueries("pkg", "save-1", "pick", storage)).toEqual({
      weapons: { filters: { 位阶: ["1"] } },
    });

    storage.setItem(key, "{not json");
    expect(loadResourcePickerQueries("pkg", "save-1", "pick", storage)).toEqual({});
  });

  it("恢复时丢弃资源库中已不存在的筛选项和排序列", () => {
    expect(sanitizeResourcePickerQuery({
      keywords: "  ",
      filters: { 位阶: ["1", "9"], 名称: ["剑", "不存在"], 简介: ["锋利的剑"], 隐藏: ["x"], 未知: ["x"] },
      sort: { field: "名称", direction: "desc" },
    }, library, library.fields)).toEqual({
      filters: { 位阶: ["1"], 名称: ["剑"] },
      sort: { field: "名称", direction: "desc" },
    });

    expect(sanitizeResourcePickerQuery({
      filters: { 未知: ["x"] },
      sort: { field: "不存在" },
    }, library, library.fields)).toBeUndefined();
    expect(sanitizeResourcePickerQuery({ sort: { field: "隐藏" } }, library, library.fields)).toBeUndefined();

    expect(sanitizeResourcePickerQuery({}, library, library.fields)).toEqual({});
  });

  it("旧缓存丢掉不可见列的筛选时，重新打开仍只显示系统包限定的类型", () => {
    // 主武器选择器靠不可见的「类型」列限定范围；旧版本的恢复路径会丢掉这个筛选，
    // 再次打开时主武器列表就混入副武器。包给不可见列的筛选必须由恢复逻辑补回。
    const packageQuery = { filters: { 隐藏: ["x"] }, sort: { field: "位阶", direction: "asc" as const } };
    const staleRestored = { sort: { field: "位阶", direction: "asc" as const } };

    const resolved = mergedResourcePickerDefaultQuery(packageQuery, staleRestored, undefined, library.fields);
    expect(resolved?.filters).toEqual({ 隐藏: ["x"] });
    expect(queryResourceLibraryEntries(library, resolved!, library.fields).map((entry) => entry.ID)).toEqual(["sword"]);

    // 用户可改动的可见列仍然覆盖默认值，不可见列以系统包为准。
    const userChanged = mergedResourcePickerDefaultQuery(packageQuery, { filters: { 隐藏: ["y"], 位阶: ["2"] } }, undefined, library.fields);
    expect(userChanged?.filters).toEqual({ 隐藏: ["x"], 位阶: ["2"] });
  });

  it("localStorage 不可用时安全降级", () => {
    const unavailable = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
    };

    expect(loadResourcePickerQueries("pkg", "save-1", "pick-weapon", unavailable)).toEqual({});
    expect(() => saveResourcePickerQueries("pkg", "save-1", "pick-weapon", { weapons: {} }, unavailable)).not.toThrow();
    expect(() => removeResourcePickerQueries("pkg", "save-1", unavailable)).not.toThrow();
  });
});

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
