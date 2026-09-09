import { expect, test, vi } from "vitest";
import { currentTemplates } from "@pbdh/templates/core";
import { materializeResourceConversion, type TemporaryResourceBatch } from "@pbdh/resource-conversion";

function batch(kind: "armor" | "opaque"): TemporaryResourceBatch {
  return {
    name: "测试转换", media: new Map(),
    sourceDocument: { formatId: "zzz", upstreamRevision: "test", container: "json" },
    resources: ["first", "second"].map((sourceId) => ({
      sourceId, kind, name: sourceId, fields: {},
      source: { formatId: "zzz", upstreamRevision: "test", path: sourceId, raw: {} },
    })),
  };
}

test("转换只请求出现的模板类型，同类资源复用一次请求", async () => {
  const loadTemplate = vi.fn(async (id: string) => currentTemplates.find((template) => template.id === id));
  const result = await materializeResourceConversion({ batch: batch("armor"), targets: [], diagnosticNamespace: "test", loadTemplate });
  expect(result.candidate?.document.resources).toHaveLength(2);
  expect(loadTemplate).toHaveBeenCalledExactlyOnceWith("护甲");
});

test("未知类型不加载任何模板，也不会被静默丢弃", async () => {
  const loadTemplate = vi.fn();
  const result = await materializeResourceConversion({ batch: batch("opaque"), targets: [], diagnosticNamespace: "test", loadTemplate });
  expect(result.candidate).toBeNull();
  expect(result.skipped).toBe(2);
  expect(result.diagnostics).toHaveLength(2);
  expect(loadTemplate).not.toHaveBeenCalled();
});

test("模板下载失败或身份错误时不产出替代版本", async () => {
  const input = { batch: batch("armor"), targets: [], diagnosticNamespace: "test" };
  await expect(materializeResourceConversion({ ...input, loadTemplate: vi.fn().mockRejectedValue(new Error("network unavailable")) }))
    .rejects.toThrow("network unavailable");
  await expect(materializeResourceConversion({ ...input, loadTemplate: async () => currentTemplates.find((template) => template.id === "武器") }))
    .rejects.toThrow("可信资源模板不可用：护甲");
});
