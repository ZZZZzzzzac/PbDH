import { expect, test, vi } from "vitest";
import { templateRegistry, listTemplateUpgradeRows as eagerRows, upgradeTemplateResources as eagerUpgrade } from "@pbdh/templates/core";
import { templateCoreLoaders, listTemplateUpgradeRows, templateUpgradeTargets, upgradeTemplateResources } from "@pbdh/templates/core/lazy";

test("轻量升级目录与全部历史能力一致，查询不加载实现", () => {
  const loads = templateCoreLoaders.map((entry) => vi.spyOn(entry, "load"));
  try {
    for (const entry of templateCoreLoaders) {
      expect(entry.fromVersions).toEqual((templateRegistry.resolve(entry.id, entry.version)!.upgrades ?? []).map((upgrade) => upgrade.fromVersion));
      expect(templateUpgradeTargets(entry.id, entry.version)).toEqual(templateRegistry.upgradeTargets(entry.id, entry.version));
    }
    const resources = templateRegistry.list().flatMap((template) => [{ template }, { template }]);
    expect(listTemplateUpgradeRows(resources)).toEqual(eagerRows(resources));
    expect(loads.every((load) => load.mock.calls.length === 0)).toBe(true);
  } finally { vi.restoreAllMocks(); }
});

test("确认局部升级只请求选中路径，不请求更新或无关版本", async () => {
  const loads = templateCoreLoaders.map((entry) => ({ entry, load: vi.spyOn(entry, "load") }));
  try {
    const input = [{ template: { id: "自由", version: "1.0.1" }, data: structuredClone(templateRegistry.resolve("自由", "1.0.1")!.defaultData) }];
    const original = structuredClone(input);
    const selections = [{ templateId: "自由", currentVersion: "1.0.1", targetVersion: "1.0.2" }];
    expect(await upgradeTemplateResources(input, selections)).toEqual(eagerUpgrade(input, selections));
    expect(input).toEqual(original);
    expect(loads.filter(({ load }) => load.mock.calls.length).map(({ entry }) => `${entry.id}@${entry.version}`)).toEqual(["自由@1.0.2"]);
  } finally { vi.restoreAllMocks(); }
});

test("所有历史版本升级至最新可达版本，与原实现结果相同", async () => {
  for (const template of templateRegistry.list()) {
    const targets = templateRegistry.upgradeTargets(template.id, template.version);
    if (!targets.length) continue;
    const input = [{ template: { id: template.id, version: template.version }, data: structuredClone(template.defaultData) }];
    const selections = [{ templateId: template.id, currentVersion: template.version, targetVersion: targets.at(-1)! }];
    expect(await upgradeTemplateResources(input, selections)).toEqual(eagerUpgrade(input, selections));
  }
});

test("拒绝不可达目标；未选择升级保持原资源引用", async () => {
  const resource = { template: { id: "护甲", version: "1.0.1" }, data: {} };
  expect((await upgradeTemplateResources([resource], []))[0]).toBe(resource);
  await expect(upgradeTemplateResources([resource], [{ templateId: "护甲", currentVersion: "1.0.1", targetVersion: "1.0.0" }]))
    .rejects.toThrow("Invalid Template upgrade");
});
