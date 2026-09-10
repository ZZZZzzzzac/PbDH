import { templateRegistry, type TemplateCoreCapability } from "@pbdh/templates/core";
import { describe, expect, test } from "vitest";

import {
  compareWorkspaceResources,
  defaultResourceSortPreferences,
  type ResourceSortPreferences,
} from "../../apps/creator/src/workspace-prototype/resource-sorting.ts";
import type { WorkspaceResource } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

const domain = templateRegistry.resolve("领域卡", "1.1.0")!;
const adversary = templateRegistry.resolve("敌人", "1.1.0")!;
const subclass = templateRegistry.resolve("子职业", "1.1.0")!;

function resource(id: string, data: Record<string, unknown>, core = domain): WorkspaceResource {
  return {
    id, path: `${id}.json`, template: { id: core.id, version: core.version },
    data: { ...core.defaultData, ...data }, media: {}, presentation: { ...core.defaultPresentation },
  };
}

function grouped(fields: Record<string, "asc" | "desc">, id = domain.id): ResourceSortPreferences {
  return { mode: "grouped", templates: { [id]: fields } };
}

function ordered(resources: WorkspaceResource[], preferences: ResourceSortPreferences, core = domain) {
  return [...resources].sort((left, right) => compareWorkspaceResources(left, right, core, preferences)).map(({ id }) => id);
}

describe("Workspace resource sorting", () => {
  test("defaults and disabled fields use projected name ascending, then exact id", () => {
    const resources = [resource("b", { 名称: "Alpha" }), resource("a", { 名称: "Alpha" }), resource("z", { 名称: "Beta" })];
    expect(defaultResourceSortPreferences).toEqual({ mode: "name", templates: {} });
    for (const preferences of [defaultResourceSortPreferences, grouped({}), grouped({ 未知: "desc" }), grouped({ 等级: "desc" }, "领域卡@1.1.0")]) {
      expect(ordered(resources, preferences)).toEqual(["a", "b", "z"]);
    }
    expect(compareWorkspaceResources(resources[0]!, resources[0]!, domain, grouped({}))).toBe(0);
  });

  test("name mode ignores enabled fields and does not mutate inputs", () => {
    const resources = [resource("b", { 名称: "Beta", 等级: "1" }), resource("a", { 名称: "Alpha", 等级: "10" })];
    const preferences: ResourceSortPreferences = { ...grouped({ 名称: "desc", 等级: "asc" }), mode: "name" };
    const snapshot = structuredClone({ resources, preferences });
    expect(ordered(resources, preferences)).toEqual(["a", "b"]);
    expect({ resources, preferences }).toEqual(snapshot);
  });

  test("names use natural 2-before-10 order and case-insensitive id fallback", () => {
    const resources = [resource("c", { 名称: "Card 10" }), resource("b", { 名称: "card 2" }), resource("a", { 名称: "Card 2" })];
    expect(ordered(resources, defaultResourceSortPreferences)).toEqual(["a", "b", "c"]);
    expect(ordered(resources, grouped({}))).toEqual(["a", "b", "c"]);
    expect(ordered(resources, grouped({ 名称: "desc" }))).toEqual(["c", "a", "b"]);
  });

  test("metadata priority wins over preference insertion order; ties proceed to next field", () => {
    const resources = [
      resource("a", { 名称: "A", 等级: "10", 领域: "A" }),
      resource("b", { 名称: "B", 等级: "2", 领域: "B" }),
      resource("c", { 名称: "C", 等级: "2", 领域: "A" }),
    ];
    expect(ordered(resources, grouped({ 等级: "asc", 领域: "asc" }))).toEqual(["c", "a", "b"]);
    expect(ordered(resources, grouped({ 等级: "asc", 名称: "desc" }))).toEqual(["c", "b", "a"]);
    expect(ordered(resources, grouped({ 等级: "desc" }))).toEqual(["a", "b", "c"]);
  });

  test.each([undefined, null, "", " ", "2abc", "2d6", "0x10", "0b10", "Infinity", "NaN", true, [], {}, Infinity, -Infinity, NaN, "1e999"])(
    "invalid numeric value %j stays last in either direction", (value) => {
      const invalid = resource("a", { 名称: "A", 等级: value });
      const valid = resource("b", { 名称: "B", 等级: 0 });
      for (const direction of ["asc", "desc"] as const) {
        expect(ordered([invalid, valid], grouped({ 等级: direction }))).toEqual(["b", "a"]);
        expect(compareWorkspaceResources(invalid, valid, domain, grouped({ 等级: direction }))).toBeGreaterThan(0);
        expect(compareWorkspaceResources(valid, invalid, domain, grouped({ 等级: direction }))).toBeLessThan(0);
      }
    },
  );

  test("accepts full finite decimal strings and finite numbers without truncation", () => {
    const values = ["10", "2", "  +1.5 ", ".5", "-2", 0, "1e2"];
    expect(ordered(values.map((等级, index) => resource(String(index), { 等级 })), grouped({ 等级: "asc" })))
      .toEqual(["4", "5", "3", "2", "1", "0", "6"]);
  });

  test("domain recall is numeric and follows domain and level priority", () => {
    const resources = [
      resource("a", { 领域: "A", 等级: "2", 回想: "10" }),
      resource("b", { 领域: "A", 等级: "2", 回想: "2" }),
      resource("c", { 领域: "B", 等级: "1", 回想: "0" }),
    ];
    expect(ordered(resources, grouped({ 回想: "asc", 等级: "asc", 领域: "asc" }))).toEqual(["b", "a", "c"]);
  });

  test("text fields keep missing values last in descending order", () => {
    const resources = [resource("a", { 名称: "A", 领域: " " }), resource("b", { 名称: "B", 领域: "A" }), resource("c", { 名称: "C", 领域: "Z" })];
    expect(ordered(resources, grouped({ 领域: "desc" }))).toEqual(["c", "b", "a"]);
  });

  test("adversary uses kind rather than type, and tier is numeric", () => {
    const resources = [resource("a", { 名称: "A", 种类: "B", 类型: "A", 位阶: "10" }, adversary), resource("b", { 名称: "B", 种类: "A", 类型: "B", 位阶: "2" }, adversary)];
    expect(ordered(resources, grouped({ 种类: "asc" }, adversary.id), adversary)).toEqual(["b", "a"]);
    expect(ordered(resources, grouped({ 位阶: "asc" }, adversary.id), adversary)).toEqual(["b", "a"]);
  });

  test("enum uses declared order, with custom text then missing values", () => {
    const resources = ["精通", "基础", "进阶", "Custom", ""].map((等级, index) => resource(String(index), { 等级 }, subclass));
    expect(ordered(resources, grouped({ 等级: "asc" }, subclass.id), subclass)).toEqual(["1", "2", "0", "3", "4"]);
    expect(ordered(resources, grouped({ 等级: "desc" }, subclass.id), subclass)).toEqual(["0", "2", "1", "3", "4"]);
  });

  test("unknown version falls back to core projection, including missing projected titles", () => {
    const core: TemplateCoreCapability<Record<string, unknown>> = {
      ...domain, version: "9.0.0", project: (data) => ({ title: String(data.display ?? ""), summary: "", searchText: "" }),
    };
    const resources = [resource("a", { 名称: "Z", display: "A" }, core), resource("b", { 名称: "A", display: "B" }, core), resource("c", {}, core)];
    expect(ordered(resources, grouped({ 名称: "asc" }), core)).toEqual(["a", "b", "c"]);
  });

  test("mixed exact versions remain antisymmetric and transitive with one group core", () => {
    const resources = [
      resource("a", { 名称: "Z", 等级: "2", 领域: "B" }, templateRegistry.resolve(domain.id, "1.0.0")!),
      resource("b", { 名称: "A", 等级: "10", 领域: "A" }, templateRegistry.resolve(domain.id, "1.0.1")!),
      resource("c", { 名称: "B", 等级: "2", 领域: "A" }),
      resource("d", { 名称: "C", 等级: "", 领域: "A" }),
    ];
    for (const preferences of [grouped({}), grouped({ 等级: "asc", 领域: "desc" }), grouped({ 等级: "desc", 名称: "desc" })]) {
      const compare = (left: WorkspaceResource, right: WorkspaceResource) => compareWorkspaceResources(left, right, domain, preferences);
      for (const left of resources) {
        expect(compare(left, left)).toBe(0);
        for (const right of resources) {
          expect(Math.sign(compare(left, right)) + Math.sign(compare(right, left))).toBe(0);
          for (const third of resources) {
            if (compare(left, right) <= 0 && compare(right, third) <= 0) expect(compare(left, third)).toBeLessThanOrEqual(0);
          }
        }
      }
    }
    expect(ordered(resources, grouped({}))).toEqual(["b", "c", "d", "a"]);
    expect(ordered(resources, grouped({ 等级: "asc", 领域: "asc" }))).toEqual(["c", "b", "d", "a"]);
  });
});
