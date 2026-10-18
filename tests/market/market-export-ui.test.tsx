// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { ExportResult } from "@pbdh/resource-conversion";
import { PublicationDetail } from "../../apps/market/src/MarketApp.tsx";
import { exportMarketPublication } from "../../apps/market/src/market-export.ts";
import type { Publication } from "../../apps/market/src/market-model.ts";

vi.mock("@pbdh/platform-auth/provider", () => ({ useAuth: () => ({ credentials: null }) }));
vi.mock("../../apps/market/src/market-export.ts", async (load) => ({
  ...await load<typeof import("../../apps/market/src/market-export.ts")>(),
  exportMarketPublication: vi.fn(),
}));

const publication: Publication = {
  id: "publication-export", packageId: "package-export", packageVersion: "1.0.0", snapshotDigest: "sha256:test",
  title: "完整资源包", ownerAccountId: "author-id", author: "作者", summary: "", kind: "mixed",
  templateIds: [], systems: [], systemLabels: [], language: "中文", categories: [], tags: [], license: "CC0",
  updatedAt: "2026-10-18T00:00:00Z", resourceCount: 2, status: "published",
  cover: { assetId: "cover", url: "cover.webp", alt: "封面" }, archiveUrl: "/download", archiveName: "package.pbres",
  resources: [{ id: "focused", name: "当前预览卡", templateId: "武器", path: "weapon.json", data: {}, source: {} }],
};

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it.each(["desktop", "mobile"])("%s acquisition exports directly, blocks repeat clicks and keeps diagnostics visible", async (surface) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const handoff = vi.fn();
  const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  let finish!: (result: ExportResult) => void;
  vi.mocked(exportMarketPublication).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const click = async (label: string, scope: ParentNode = container) => {
    const button = [...scope.querySelectorAll("button")].find((item) => item.textContent === label);
    expect(button, label).toBeDefined();
    await act(async () => button!.click());
  };
  try {
    await act(async () => root.render(<PublicationDetail publication={publication} resourceId="focused"
      onBack={vi.fn()} onSelectResource={vi.fn()} onHandoff={handoff} onDownload={vi.fn()} onEditMetadata={vi.fn()}
      onUnpublish={vi.fn()} onRepublish={vi.fn()} onDelete={vi.fn()} onShare={vi.fn()} onOpenAuthor={vi.fn()} canManage={false}
    />));
    if (surface === "mobile") await click("取得资源包");
    await click("导出为第三方格式…", surface === "mobile" ? container.querySelector(".acquisition-sheet")! : container);
    expect(container.querySelector(".acquisition-sheet")).toBeNull();
    expect(container.querySelectorAll("select option")).toHaveLength(5);
    const select = container.querySelector("select")!;
    await act(async () => { select.value = "dhsheet-equipment"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await click("导出并下载");
    await click("导出并下载");
    expect(exportMarketPublication).toHaveBeenCalledOnce();
    expect(exportMarketPublication).toHaveBeenCalledWith(publication, expect.objectContaining({ formatId: "dhsheet", dhsheetContent: "equipment" }), null);
    expect(container.textContent).toContain("正在取得资源包并转换");
    await act(async () => finish({
      ok: true, artifact: { bytes: new Uint8Array([123, 125]), fileName: "完整资源包-装备包.json", container: "json", mediaType: "application/json" },
      report: { formatId: "dhsheet", direction: "export", converted: 1, failed: 0, diagnostics: [{ code: "skipped", severity: "warning", message: "跳过不支持的装备" }] },
    }));
    expect(download).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("已导出 1 项资源");
    expect(container.textContent).toContain("跳过不支持的装备");
    expect(handoff).not.toHaveBeenCalled();
    vi.mocked(exportMarketPublication).mockRejectedValueOnce(new Error("网络中断，请重试"));
    await click("导出并下载");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("网络中断，请重试");
    expect(download).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
