import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DeletePublicationDialog, PublicationCard, PublicationDetail, UnpublishPublicationDialog } from "../../apps/market/src/MarketApp.tsx";
import { loadPublications } from "../../apps/market/src/market-api.ts";
import { ResourcePackageInfoDialog } from "@pbdh/publication-ui";

const summaryPublication = {
  publicationId: "publication-summary",
  packageId: "package-summary",
  packageVersion: "1.0.0",
  snapshotDigest: `sha256:${"1".repeat(64)}`,
  title: "摘要资源包",
  summary: "目录只返回资源摘要。",
  language: "中文",
  tags: [],
  coverAssetId: `sha256:${"2".repeat(64)}`,
  author: { accountId: "account-author", username: "作者" },
  updatedAt: "2026-08-29T00:00:00Z",
  templateIds: ["武器"],
  targetSystemPackageIds: [],
  license: { label: "CC0", declaration: "" },
  resourceCount: 1,
  resources: [{
    id: "resource-summary",
    path: "武器/摘要.json",
    template: { id: "武器", version: "1.0.0" },
    name: "摘要武器",
  }],
  status: "published",
};

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Market publication detail", () => {
  it("goes directly to Player and leaves the only confirmation to package installation", () => {
    const source = readFileSync(fileURLToPath(new URL("../../apps/market/src/MarketApp.tsx", import.meta.url)), "utf8");
    const handoff = source.slice(
      source.indexOf("function openHandoff"),
      source.indexOf("async function downloadCurrentPublication"),
    );

    expect(handoff).toContain('if (target === "player" || target === "creator")');
    expect(handoff).toContain("onHandoffNavigate(target, url)");
    expect(handoff).toContain("return;");
  });

  it("goes directly to Creator without a handoff confirmation or navigation notification", () => {
    const source = readFileSync(fileURLToPath(new URL("../../apps/market/src/MarketApp.tsx", import.meta.url)), "utf8");
    const handoff = source.slice(
      source.indexOf("function openHandoff"),
      source.indexOf("async function downloadCurrentPublication"),
    );

    expect(handoff).toContain('if (target === "player" || target === "creator")');
    expect(handoff).toContain("onHandoffNavigate(target, url)");
    expect(handoff).not.toContain("已切换到");
  });

  it("does not treat an App or system-package switch as a notification", () => {
    const marketSource = readFileSync(fileURLToPath(new URL("../../apps/market/src/MarketApp.tsx", import.meta.url)), "utf8");
    const playerSource = readFileSync(fileURLToPath(new URL("../../apps/player/src/PlayerSheetSurface.tsx", import.meta.url)), "utf8");
    const switchSystem = playerSource.slice(
      playerSource.indexOf("async function handleSwitchSystem"),
      playerSource.indexOf("async function handlePackageFile"),
    );

    expect(marketSource).not.toContain("notify(`已切换到");
    expect(switchSystem).not.toContain("setCloudNotice(`已切换到系统包");
  });

  it("shows a loading state instead of rendering an incomplete catalog summary", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({
      publications: [summaryPublication],
      pagination: { page: 1, pageSize: 24, total: 1, hasMore: false },
      facets: { templateIds: [], targetSystemPackageIds: [], languages: [], categories: [] },
    }));
    const [publication] = await loadPublications(fetcher);

    const markup = renderToStaticMarkup(<PublicationDetail
      publication={publication!}
      onBack={() => undefined}
      onSelectResource={() => undefined}
      onHandoff={() => undefined}
      onDownload={() => undefined}
      onEditMetadata={() => undefined}
      onUnpublish={() => undefined}
      onRepublish={() => undefined}
      onDelete={() => undefined}
      onShare={() => undefined}
      onOpenAuthor={() => undefined}
      canManage={false}
    />);

    expect(markup).toContain("正在读取资源包详情");
    expect(markup).not.toContain("data-pbdh-canonical-surface");
  });

  it("offers permanent deletion only while an owned publication is unpublished", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({
      publications: [{ ...summaryPublication, status: "unpublished" }],
      pagination: { page: 1, pageSize: 24, total: 1, hasMore: false },
      facets: { templateIds: [], targetSystemPackageIds: [], languages: [], categories: [] },
    }));
    const [publication] = await loadPublications(fetcher);

    const markup = renderToStaticMarkup(<PublicationDetail
      publication={publication!}
      onBack={() => undefined}
      onSelectResource={() => undefined}
      onHandoff={() => undefined}
      onDownload={() => undefined}
      onEditMetadata={() => undefined}
      onUnpublish={() => undefined}
      onRepublish={() => undefined}
      onDelete={() => undefined}
      onShare={() => undefined}
      onOpenAuthor={() => undefined}
      canManage
    />);

    expect(markup).toContain("永久删除");
    expect(markup).not.toContain("取消发布");
  });

  it("uses a single confirmation click for permanent deletion", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({
      publications: [{ ...summaryPublication, status: "unpublished" }],
      pagination: { page: 1, pageSize: 24, total: 1, hasMore: false },
      facets: { templateIds: [], targetSystemPackageIds: [], languages: [], categories: [] },
    }));
    const [publication] = await loadPublications(fetcher);

    const markup = renderToStaticMarkup(<DeletePublicationDialog
      publication={publication!}
      onClose={() => undefined}
      onConfirm={() => undefined}
    />);

    expect(markup).toContain("永久删除摘要资源包？");
    expect(markup).toContain(">永久删除</button>");
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain("输入");
  });

  it("shows immediate progress and prevents repeated publication actions", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({
      publications: [summaryPublication],
      pagination: { page: 1, pageSize: 24, total: 1, hasMore: false },
      facets: { templateIds: [], targetSystemPackageIds: [], languages: [], categories: [] },
    }));
    const [publication] = await loadPublications(fetcher);

    const publishMarkup = renderToStaticMarkup(<ResourcePackageInfoDialog
      heading="发布到资源市场"
      submitLabel="发布当前版本"
      busy
      busyLabel="正在发布整包…"
      coverUrl=""
      systemPackageOptions={[]}
      value={{ package: { name: "大型资源包", version: "1.0.0", description: "", targets: [] }, publication: { title: "大型资源包", summary: "", language: "中文", tags: [], licenseId: "CC0" } }}
      licenseOptions={[{ id: "CC0", label: "CC0" }]}
      onChange={() => undefined}
      onClose={() => undefined}
      onSubmit={() => undefined}
    />);
    const unpublishMarkup = renderToStaticMarkup(<UnpublishPublicationDialog
      publication={publication!}
      busy
      onClose={() => undefined}
      onConfirm={() => undefined}
    />);

    expect(publishMarkup).toContain('aria-busy="true"');
    expect(publishMarkup).toContain("正在发布整包…");
    expect(publishMarkup).toContain("pbdh-operation-status-spinner");
    expect(unpublishMarkup).toContain('aria-busy="true"');
    expect(unpublishMarkup).toContain("正在取消发布…");
    expect(unpublishMarkup).toContain("pbdh-operation-status-spinner");
    expect((publishMarkup.match(/disabled=""/gu) ?? []).length).toBeGreaterThan(2);
  });

  it("shows the three most common templates and one omitted-count badge", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({
      publications: [summaryPublication],
      pagination: { page: 1, pageSize: 24, total: 1, hasMore: false },
      facets: { templateIds: [], targetSystemPackageIds: [], languages: [], categories: [] },
    }));
    const [base] = await loadPublications(fetcher);
    const resources = [
      ...Array.from({ length: 4 }, (_, index) => ({ id: `weapon-${index}`, name: "武器", templateId: "武器", path: "", data: {}, source: {} })),
      ...Array.from({ length: 3 }, (_, index) => ({ id: `armor-${index}`, name: "护甲", templateId: "护甲", path: "", data: {}, source: {} })),
      ...Array.from({ length: 2 }, (_, index) => ({ id: `community-${index}`, name: "社群", templateId: "社群", path: "", data: {}, source: {} })),
      { id: "profession", name: "职业", templateId: "职业", path: "", data: {}, source: {} },
      { id: "ancestry", name: "种族", templateId: "种族", path: "", data: {}, source: {} },
    ];
    const publication = {
      ...base!,
      templateIds: ["社群", "护甲", "武器", "职业", "种族"],
      resources,
    };

    const markup = renderToStaticMarkup(<PublicationCard
      publication={publication}
      query=""
      onOpen={() => undefined}
      onOpenAuthor={() => undefined}
      onOpenResource={() => undefined}
    />);

    expect(markup).toMatch(/>武器<.*>护甲<.*>社群<.*>\+2</u);
    expect(markup).not.toContain("(+2)");
    expect(markup).not.toMatch(/>职业<|>种族</u);
  });

  it("keeps the catalog card hierarchy stable when a package has many labels", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({
      publications: [summaryPublication],
      pagination: { page: 1, pageSize: 24, total: 1, hasMore: false },
      facets: { templateIds: [], targetSystemPackageIds: [], languages: [], categories: [] },
    }));
    const [publication] = await loadPublications(fetcher);
    const markup = renderToStaticMarkup(<PublicationCard
      publication={publication!}
      query=""
      onOpen={() => undefined}
      onOpenAuthor={() => undefined}
      onOpenResource={() => undefined}
    />);
    const styles = readFileSync(fileURLToPath(new URL("../../apps/market/src/styles.css", import.meta.url)), "utf8");

    expect(markup.indexOf("publication-card-heading")).toBeLessThan(markup.indexOf("publication-taxonomy"));
    expect(markup).toContain("publication-byline");
    expect(styles).toContain("grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr))");
    expect(styles).toContain(".publication-taxonomy { display: grid;");
    expect(styles).not.toContain(".publication-card:first-child");
  });

  it("uses a compact three-column detail layout and scrolls long resource lists independently", () => {
    const styles = readFileSync(fileURLToPath(new URL("../../apps/market/src/styles.css", import.meta.url)), "utf8");

    expect(styles).toMatch(/\.detail-layout \{[^}]*width: min\(1180px,[^}]*grid-template-columns: 270px minmax\(380px, 520px\) minmax\(280px, 320px\);[^}]*grid-template-areas: "heading heading side" "resources preview side";/u);
    expect(styles).toMatch(/\.resource-list \{[^}]*height: 534px;/u);
    expect(styles).toMatch(/\.canonical-preview \{[^}]*height: 534px;/u);
    expect(styles).toMatch(/\.resource-list-items \{[^}]*overflow-y: auto;/u);
    expect(styles).not.toMatch(/(?:^|\s)\.publication-resource-browser\s*\{/u);
  });

  it("keeps the package-info action on one line and gives it more room than unpublish", () => {
    const styles = readFileSync(fileURLToPath(new URL("../../apps/market/src/styles.css", import.meta.url)), "utf8");

    expect(styles).toContain("grid-template-columns: minmax(148px, 1.35fr) minmax(92px, .65fr)");
    expect(styles).toContain(".publication-detail-management .publication-edit-button");
    expect(styles).toContain("white-space: nowrap");
  });
});
