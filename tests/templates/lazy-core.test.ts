import { expect, test, vi } from "vitest";
import { templateRegistry } from "@pbdh/templates/core";
import { createTemplateCoreLoader, loadTemplateCore, templateCoreLoaders } from "@pbdh/templates/core/lazy";

test("惰性 Core 目录完整保留精确版本和历史能力", async () => {
  const key = (entry: { id: string; version: string }) => `${entry.id}@${entry.version}`;
  expect(templateCoreLoaders.map(key).sort()).toEqual(templateRegistry.list().map(key).sort());
  for (const entry of templateCoreLoaders) {
    expect(await loadTemplateCore(entry.id, entry.version)).toBe(templateRegistry.resolve(entry.id, entry.version));
  }
  expect(await loadTemplateCore("不存在", "1.0.0")).toBeUndefined();
});

test("只加载所选版本，并发和后续调用复用成功结果", async () => {
  const current = templateRegistry.resolve("护甲", "1.0.0")!;
  const selected = vi.fn().mockResolvedValue(current);
  const unrelated = vi.fn();
  const load = createTemplateCoreLoader([
    { id: "护甲", version: "1.0.0", load: selected },
    { id: "护甲", version: "1.1.0", load: unrelated },
  ]);
  expect(selected).not.toHaveBeenCalled();
  await Promise.all([load("护甲", "1.0.0"), load("护甲", "1.0.0")]);
  expect(await load("护甲", "1.0.0")).toBe(current);
  expect(selected).toHaveBeenCalledOnce();
  expect(unrelated).not.toHaveBeenCalled();
});

test("加载失败不被当作缺少版本，下一次请求可重试", async () => {
  const current = templateRegistry.resolve("护甲", "1.0.0")!;
  const selected = vi.fn().mockRejectedValueOnce(new Error("network unavailable")).mockResolvedValue(current);
  const load = createTemplateCoreLoader([{ id: "护甲", version: "1.0.0", load: selected }]);
  await expect(load("护甲", "1.0.0")).rejects.toThrow("network unavailable");
  expect(await load("护甲", "1.0.0")).toBe(current);
  expect(selected).toHaveBeenCalledTimes(2);
});

test("拒绝重复目录和返回错误版本的实现", async () => {
  const entry = { id: "护甲", version: "1.0.0", load: async () => templateRegistry.resolve("护甲", "1.1.0")! };
  expect(() => createTemplateCoreLoader([entry, entry])).toThrow("Duplicate Template version");
  await expect(createTemplateCoreLoader([entry])("护甲", "1.0.0")).rejects.toThrow("Template identity mismatch");
});
