import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { PDFDocument, rgb } from "pdf-lib";
import { CanonicalCardSurface, renderCanonicalCardToPng } from "@pbdh/resource-renderer/react";
import { canonicalCardDesignSize, type ManagedAsset, type SurfaceResource } from "@pbdh/resource-renderer/core";
import { loadTrustedRenderer } from "@pbdh/templates/frontend/lazy";
import { resolveResourceAttribution, type CreatorWorkspace, type WorkspaceResource } from "./workspace-model.ts";
import { layoutPackagePdf, packagePdfPage } from "./package-pdf-layout.ts";

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export type PackagePdfProgress = {
  percent: number;
  completed: number;
  total: number;
  stage: "cards" | "saving" | "complete";
};

async function captureCard(resource: WorkspaceResource, workspace: CreatorWorkspace): Promise<Uint8Array> {
  const renderer = await loadTrustedRenderer(resource.template.id, resource.template.version);
  if (!renderer) throw new Error(`不支持模板 ${resource.template.id}@${resource.template.version}`);
  const container = document.createElement("div");
  // 保持真实布局和图片解码，避免 display:none 使可变高度和文字自适应失效。
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${canonicalCardDesignSize.width}px;pointer-events:none`;
  container.setAttribute("aria-hidden", "true");
  const urls: string[] = [];
  const assets = new Map<string, ManagedAsset>();
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    for (const assetId of new Set(Object.values(resource.media))) {
      const bytes = workspace.media.get(assetId);
      if (!bytes) throw new Error("缺少卡图，请恢复图片后重试。");
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "image/webp" }));
      urls.push(url);
      assets.set(assetId, { status: "ready", url });
    }
    flushSync(() => root.render(<CanonicalCardSurface
      resource={{ ...resource, attribution: resolveResourceAttribution(resource, workspace.document.package.name) } as unknown as SurfaceResource<Record<string, unknown>>}
      renderer={renderer}
      expectedRendererRevision={renderer.revision}
      assets={assets}
    />));
    // 等待 Shadow DOM 挂载、字体、图片和文字自适应，随后捕获同一规范卡面。
    await nextFrame();
    const host = container.querySelector<HTMLElement>("[data-pbdh-canonical-surface]");
    if (!host?.shadowRoot) throw new Error("卡面加载失败，请重试。");
    await document.fonts.ready;
    await Promise.all(Array.from(host.shadowRoot.querySelectorAll("img"), (image) => image.decode()));
    await nextFrame();
    await nextFrame();
    return new Uint8Array(await (await renderCanonicalCardToPng(host)).arrayBuffer());
  } finally {
    root.unmount();
    container.remove();
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}

export async function exportCreatorPackagePdf(
  workspace: CreatorWorkspace,
  capture: (resource: WorkspaceResource, workspace: CreatorWorkspace) => Promise<Uint8Array> = captureCard,
  onProgress?: (progress: PackagePdfProgress) => void,
): Promise<{ bytes: Uint8Array; pageCount: number; cardCount: number }> {
  if (!workspace.document.resources.length) throw new Error("资源包中没有可导出的卡牌。");
  const total = workspace.document.resources.length;
  onProgress?.({ percent: 0, completed: 0, total, stage: "cards" });
  const pdf = await PDFDocument.create();
  pdf.setTitle(workspace.document.package.name);
  pdf.setCreator("PbDH Creator");
  const images = [];
  // 逐张渲染、嵌入并释放 DOM 与媒体 URL，避免同时挂载整个资源包。
  for (const resource of workspace.document.resources) {
    try {
      const image = await pdf.embedPng(await capture(resource, workspace));
      // 把图片压缩计入逐张处理进度，避免全部卡牌处理后长时间停在文件生成阶段。
      await image.embed();
      images.push(image);
    } catch (error) {
      throw new Error(`卡牌「${resource.path}」导出失败：${error instanceof Error ? error.message : "请重试"}`, { cause: error });
    }
    onProgress?.({ percent: Math.floor(images.length / total * 90), completed: images.length, total, stage: "cards" });
    await yieldToBrowser();
  }
  const placements = layoutPackagePdf(images);
  const mm = 72 / 25.4;
  const pageCount = Math.max(...placements.map((card) => card.page)) + 1;
  const pages = Array.from({ length: pageCount }, () => {
    const page = pdf.addPage([packagePdfPage.width * mm, packagePdfPage.height * mm]);
    page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: rgb(1, 1, 1) });
    return page;
  });
  for (const card of placements) {
    pages[card.page]!.drawImage(images[card.index]!, {
      x: card.x * mm,
      y: (packagePdfPage.height - card.y - card.height) * mm,
      width: card.width * mm,
      height: card.height * mm,
    });
  }
  onProgress?.({ percent: 95, completed: total, total, stage: "saving" });
  await yieldToBrowser();
  const bytes = await pdf.save({ objectsPerTick: 20 });
  onProgress?.({ percent: 100, completed: total, total, stage: "complete" });
  return { bytes, pageCount, cardCount: images.length };
}
