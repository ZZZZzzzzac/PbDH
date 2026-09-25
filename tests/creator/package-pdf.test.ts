import { describe, expect, test, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { layoutPackagePdf, packagePdfPage } from "../../apps/creator/src/workspace-prototype/package-pdf-layout.ts";
import { exportCreatorPackagePdf } from "../../apps/creator/src/workspace-prototype/creator-package-pdf.tsx";
import { createWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import fixture from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";

describe("资源包 A4 PDF", () => {
  test("标准卡每页九张，余卡完整放入下一页", () => {
    const cards = layoutPackagePdf(Array.from({ length: 19 }, () => ({ width: 630, height: 880 })));
    expect([0, 1, 2].map((page) => cards.filter((card) => card.page === page).length)).toEqual([9, 9, 1]);
    expect(cards.every((card) => card.width === 63 && card.height === 88)).toBe(true);
  });

  test("混合高度卡回填空位，超长卡等比缩小；全部卡牌无重叠、无越界", () => {
    const sizes = [200, 200, 200, 80, 80, 80, 2000, 50, 5, 88, 140, 800].map((height) => ({ width: 63, height }));
    const cards = layoutPackagePdf(sizes);
    const firstSix = layoutPackagePdf(sizes.slice(0, 6));
    expect(firstSix.every((card) => card.page === 0)).toBe(true);
    expect(new Set(cards.map((card) => card.index)).size).toBe(sizes.length);
    for (const card of cards) {
      expect(card.width / card.height).toBeCloseTo(sizes[card.index]!.width / sizes[card.index]!.height);
      expect(card.x).toBeGreaterThanOrEqual(packagePdfPage.margin);
      expect(card.y).toBeGreaterThanOrEqual(packagePdfPage.margin);
      expect(card.x + card.width).toBeLessThanOrEqual(205.00001);
      expect(card.y + card.height).toBeLessThanOrEqual(292.00001);
      for (const other of cards.filter((item) => item.page === card.page && item.index !== card.index)) {
        expect(card.x + card.width <= other.x || other.x + other.width <= card.x
          || card.y + card.height <= other.y || other.y + other.height <= card.y).toBe(true);
      }
    }
    expect(cards.find((card) => card.index === 6)!.height).toBeCloseTo(287);
  });

  test("拒绝非法尺寸", () => {
    for (const height of [0, -1, NaN, Infinity]) expect(() => layoutPackagePdf([{ width: 63, height }])).toThrow("尺寸无效");
  });

  const workspace = () => {
    const result = createWorkspace({ document: structuredClone(fixture) as ResourcePackageLogicalDocument, media: new Map() });
    result.document.resources = Array.from({ length: 10 }, (_, index) => ({
      ...result.document.resources[0]!, id: `card-${index}`, path: `folder-${index}/card.json`,
    }));
    result.currentFolderId = "only-one-folder";
    return result;
  };
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"));

  test("生成可读取的 A4 PDF，包含所有文件夹资源且不改写工作区", async () => {
    const source = workspace();
    const before = structuredClone(source);
    const capture = vi.fn(async () => png);
    const result = await exportCreatorPackagePdf(source, capture);
    const pdf = await PDFDocument.load(result.bytes);
    expect(capture.mock.calls.length).toBe(10);
    expect(result.cardCount).toBe(10);
    expect(pdf.getTitle()).toBe(source.document.package.name);
    expect(pdf.getPageCount()).toBe(result.pageCount);
    for (const page of pdf.getPages()) {
      expect(page.getWidth() * 25.4 / 72).toBeCloseTo(210);
      expect(page.getHeight() * 25.4 / 72).toBeCloseTo(297);
    }
    expect(source).toEqual(before);
  });

  test("逐张报告单调进度，写入 PDF 成功后才到 100%", async () => {
    const source = workspace();
    const progress = vi.fn();
    let captured = 0;
    const capture = async () => {
      expect(progress.mock.lastCall![0].completed).toBe(captured);
      expect(progress.mock.lastCall![0].percent).toBeLessThan(100);
      captured += 1;
      return png;
    };
    await exportCreatorPackagePdf(source, capture, progress);
    const updates = progress.mock.calls.map(([update]) => update);
    expect(updates[0]).toEqual({ percent: 0, completed: 0, total: 10, stage: "cards" });
    expect(updates.filter((update) => update.stage === "cards").map((update) => update.completed))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(updates.at(-2)).toEqual({ percent: 95, completed: 10, total: 10, stage: "saving" });
    expect(updates.at(-1)).toEqual({ percent: 100, completed: 10, total: 10, stage: "complete" });
    expect(updates.map((update) => update.percent)).toEqual(updates.map((update) => update.percent).sort((a, b) => a - b));
  });

  test("空包或任何卡牌失败时不生成不完整 PDF，并标明失败资源", async () => {
    const source = workspace();
    const capture = vi.fn().mockResolvedValueOnce(png).mockRejectedValueOnce(new Error("缺少卡图"));
    const progress = vi.fn();
    await expect(exportCreatorPackagePdf(source, capture, progress)).rejects.toThrow("folder-1/card.json");
    expect(progress.mock.lastCall![0]).toEqual({ percent: 9, completed: 1, total: 10, stage: "cards" });
    expect(capture).toHaveBeenCalledTimes(2);
    source.document.resources = [];
    await expect(exportCreatorPackagePdf(source, capture)).rejects.toThrow("没有可导出");
  });
});
