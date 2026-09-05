import { describe, expect, test } from "vitest";

import {
  matchesResourceSearchQuery,
  parseResourceSearchQuery,
  resourceSearchFieldValues,
} from "../../apps/creator/src/workspace-prototype/resource-search-query.ts";

const loneAdversary = {
  template: { id: "敌人" },
  data: { 名称: "符文巨人", 位阶: "4", 种类: "独狼", 标签: ["巨人", "首领"] },
};

describe("resource search query", () => {
  test("parses tags separately from ordinary full-text terms", () => {
    const query = parseResourceSearchQuery("[模板:敌人] [位阶:4] [种类:独狼] 符文");
    expect(query.text).toBe("符文");
    expect([...query.filters]).toEqual([
      ["模板", ["敌人"]],
      ["位阶", ["4"]],
      ["种类", ["独狼"]],
    ]);
  });

  test("uses OR within one field and AND between fields", () => {
    const matching = parseResourceSearchQuery("[位阶:3] [位阶:4] [种类:独狼]");
    const rejected = parseResourceSearchQuery("[位阶:3] [种类:独狼]");
    expect(matchesResourceSearchQuery(loneAdversary, "符文巨人", matching)).toBe(true);
    expect(matchesResourceSearchQuery(loneAdversary, "符文巨人", rejected)).toBe(false);
  });

  test("matches the reserved template key and direct data fields without template declarations", () => {
    expect(matchesResourceSearchQuery(loneAdversary, "符文巨人", parseResourceSearchQuery("[模板:敌人] [标签:首领]"))).toBe(true);
    expect(matchesResourceSearchQuery(loneAdversary, "符文巨人", parseResourceSearchQuery("[模板:环境]"))).toBe(false);
    expect(matchesResourceSearchQuery(loneAdversary, "符文巨人", parseResourceSearchQuery("[不存在:值]"))).toBe(false);
  });

  test("uses substring matching for decorated field values", () => {
    const horde = { template: { id: "敌人" }, data: { 种类: "集群(3/生命点)" } };
    expect(matchesResourceSearchQuery(horde, "", parseResourceSearchQuery("[种类:集群]"))).toBe(true);
    expect(matchesResourceSearchQuery(horde, "", parseResourceSearchQuery("[种类:独狼]"))).toBe(false);
  });

  test("derives menu fields and values from loaded resources", () => {
    const fields = resourceSearchFieldValues([loneAdversary], new Set(["位阶", "标签"]));
    expect(fields.get("模板")).toEqual(["敌人"]);
    expect(fields.get("位阶")).toEqual(["4"]);
    expect(fields.get("标签")).toEqual(["巨人", "首领"]);
    expect(fields.has("种类")).toBe(false);
  });
});
