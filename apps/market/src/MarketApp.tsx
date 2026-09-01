import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import {
  createBrowserImageAdmission,
  publicationCoverPolicy,
  type ImageCropSelection,
} from "@pbdh/media-admission";
import { CanonicalCardSurface, CardDisplay } from "@pbdh/resource-renderer/react";
import { useAuth } from "@pbdh/platform-auth/provider";
import { ImageCropDialog, OperationStatus, usePlatformNotifications } from "@pbdh/platform-ui";
import {
  ResourcePackageInfoDialog,
  type ResourcePackageEditorValue,
  type SystemPackageOption,
} from "@pbdh/publication-ui";
import { canonicalCardDesignSize, type SurfaceResource } from "@pbdh/resource-renderer/core";
import { resolveTemplateFrontend } from "@pbdh/templates/frontend";

import { marketDesignSource } from "../design.generated.ts";
import { catalogOptions } from "./catalog-options.ts";
import { Icon } from "./Icons.tsx";
import {
  deletePublication,
  loadManageablePublication,
  loadManageablePublications,
  loadPublicationArchive,
  loadPublicationCatalog,
  loadPublication,
  MarketApiError,
  republishPublication,
  updatePublicationInformation,
  unpublishLoadedPublication,
} from "./market-api.ts";
import {
  canAcquirePublication,
  canManagePublication,
  createCreatorHandoffUrl,
  createHandoffIntent,
  createPlayerHandoffUrl,
  emptyCatalogFilters,
  filterPublications,
  summarizePublicationTemplates,
  toggleFilterValue,
  type CatalogFilters,
  type CatalogFacets,
  type CatalogSort,
  type HandoffIntent,
  type HandoffTarget,
  type Publication,
} from "./market-model.ts";
import { marketRouteUrl, readMarketRoute, type MarketRoute } from "./market-route.ts";

type FilterDimension = keyof CatalogFilters;
type ViewState = MarketRoute | {
  page: "missing";
  publicationId: string;
  resourceId?: string;
};
type PublicationOperation = "republish" | "unpublish" | "delete";
type MarketOperation = PublicationOperation | "metadata" | "download";
type MarketCoverDraft = {
  assetId: string;
  blob: Blob;
  url: string;
  asset: {
    id: string;
    mediaType: "image/webp";
    byteLength: string;
    width: string;
    height: string;
  };
};

const imageAdmission = createBrowserImageAdmission();

function upsertPublication(publications: Publication[], publication: Publication): Publication[] {
  return publications.some((candidate) => candidate.id === publication.id)
    ? publications.map((candidate) => candidate.id === publication.id ? publication : candidate)
    : [...publications, publication];
}

const dimensionLabels: Record<FilterDimension, string> = {
  templateIds: "模板",
  systems: "目标系统",
  languages: "内容语言",
  categories: "分类",
};

const emptyFacets: CatalogFacets = {
  templateIds: [],
  systems: [],
  languages: [],
  categories: [],
};

const routeLabels: Record<HandoffIntent["targetRoute"], string> = {
  weapons: "匕首之心 / 武器",
  armor: "匕首之心 / 护甲",
  ancestries: "匕首之心 / 种族",
  communities: "匕首之心 / 社群",
  classes: "匕首之心 / 职业",
  subclasses: "匕首之心 / 子职业",
  loot: "匕首之心 / 物品与消耗品",
  "domain-cards": "匕首之心 / 领域卡",
  "other-resources": "其他资源",
  "creator-ingress": "卡片工坊 / 资源包导入",
};

const targetLabels: Record<HandoffTarget, string> = {
  player: "玩家车卡器",
  creator: "卡片工坊",
  gm: "GM 桌面",
};

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="market-search">
    <Icon name="search" />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="搜索资源包、作者或资源" />
  </label>;
}

function FilterMenu({
  dimension,
  filters,
  facets,
  onToggle,
}: {
  dimension: FilterDimension;
  filters: CatalogFilters;
  facets: CatalogFacets;
  onToggle: (dimension: FilterDimension, value: string) => void;
}) {
  return <div className="filter-menu" role="group" aria-label={`${dimensionLabels[dimension]}筛选`}>
    <strong>{dimensionLabels[dimension]}</strong>
    {catalogOptions(facets, filters)[dimension].map((option) => <label className="filter-option" key={option.value}>
      <input
        type="checkbox"
        checked={filters[dimension].includes(option.value)}
        onChange={() => onToggle(dimension, option.value)}
      />
      <span>{option.label}</span>
      <small>{option.count}</small>
    </label>)}
  </div>;
}

function FilterControls({
  filters,
  facets,
  openDimension,
  onOpen,
  onToggle,
}: {
  filters: CatalogFilters;
  facets: CatalogFacets;
  openDimension: FilterDimension | null;
  onOpen: (dimension: FilterDimension | null) => void;
  onToggle: (dimension: FilterDimension, value: string) => void;
}) {
  return <div className="filter-controls">
    {(Object.keys(dimensionLabels) as FilterDimension[]).map((dimension) => {
      const selectedCount = filters[dimension].length;
      const open = openDimension === dimension;
      return <div className="filter-control" key={dimension}>
        <button type="button" className={selectedCount ? "has-selection" : ""} aria-expanded={open} onClick={() => onOpen(open ? null : dimension)}>
          <span>{dimensionLabels[dimension]}</span>
          <span className="filter-state">{selectedCount > 0 && <b>{selectedCount}</b>}<Icon name="chevronDown" /></span>
        </button>
        {open && <FilterMenu dimension={dimension} filters={filters} facets={facets} onToggle={onToggle} />}
      </div>;
    })}
  </div>;
}

function TemplateBadges({ publication, className }: { publication: Publication; className?: string }) {
  const summary = summarizePublicationTemplates(publication);
  return <div className={className} aria-label="资源模板">
    {summary.templateIds.map((templateId) => <span className={`kind-badge ${publication.kind}`} key={templateId}>{templateId}</span>)}
    {summary.omittedCount > 0 && <span className="kind-badge">+{summary.omittedCount}</span>}
  </div>;
}

export function PublicationCard({ publication, query, onOpen, onOpenAuthor, onOpenResource }: { publication: Publication; query: string; onOpen: () => void; onOpenAuthor: () => void; onOpenResource: (resourceId: string) => void }) {
  const resourceMatches = query.trim()
    ? publication.resources.filter((resource) => publication.matchedResourceIds?.includes(resource.id))
    : [];
  return <article
    className="publication-card"
    role="link"
    tabIndex={0}
    aria-label={`打开${publication.title}`}
    onClick={onOpen}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    }}
  >
    <div className="publication-cover">
      <img src={publication.cover.url} alt={publication.cover.alt} draggable={false} loading="lazy" decoding="async" />
    </div>
    <div className="publication-summary">
      <div className="publication-card-heading"><strong className="publication-title">{publication.title}</strong><span className="publication-card-meta"><b>v{publication.packageVersion}</b>{publication.status === "unpublished" && <em>未发布</em>}</span></div>
      <div className="publication-byline"><button type="button" className="publication-author" onClick={(event) => { event.stopPropagation(); onOpenAuthor(); }}>{publication.author}</button><span>{publication.resourceCount} 项资源</span></div>
      <p>{publication.summary}</p>
      {resourceMatches.length > 0 && <div className="resource-matches" aria-label="匹配的包内资源">{resourceMatches.slice(0, 3).map((resource) => <button type="button" key={resource.id} onClick={(event) => { event.stopPropagation(); onOpenResource(resource.id); }}>{resource.name}</button>)}</div>}
      <div className="publication-taxonomy"><TemplateBadges publication={publication} className="publication-template-badges" /><div className="publication-tags"><span>{publication.language}</span><span>{publication.systemLabels.join(" / ") || "未指定目标系统"}</span>{publication.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
      <footer><time dateTime={publication.updatedAt}>2 天前更新</time></footer>
    </div>
  </article>;
}

function Discovery({
  query,
  filters,
  results,
  facets,
  total,
  sort,
  page,
  hasMore,
  heading,
  onQuery,
  onFilters,
  onOpen,
  onOpenAuthor,
  onOpenResource,
  onSort,
  onPage,
}: {
  query: string;
  filters: CatalogFilters;
  results: Publication[];
  facets: CatalogFacets;
  total: number;
  sort: CatalogSort;
  page: number;
  hasMore: boolean;
  heading: string;
  onQuery: (value: string) => void;
  onFilters: (filters: CatalogFilters) => void;
  onOpen: (publication: Publication) => void;
  onOpenAuthor: (publication: Publication) => void;
  onOpenResource: (publication: Publication, resourceId: string) => void;
  onSort: (sort: CatalogSort) => void;
  onPage: (page: number) => void;
}) {
  const [openDimension, setOpenDimension] = useState<FilterDimension | null>(null);
  const [mobileFilters, setMobileFilters] = useState(false);
  const toggle = (dimension: FilterDimension, value: string) => {
    onFilters({ ...filters, [dimension]: toggleFilterValue(filters[dimension], value) });
  };

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpenDimension(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  return <div className="market-discovery">
    <aside className="market-sidebar">
      <SearchField value={query} onChange={onQuery} />
      <FilterControls filters={filters} facets={facets} openDimension={openDimension} onOpen={setOpenDimension} onToggle={toggle} />
    </aside>
    <div className="mobile-search-row">
      <SearchField value={query} onChange={onQuery} />
      <button type="button" onClick={() => setMobileFilters(true)}><Icon name="sliders" />筛选</button>
    </div>
    <section className="market-results">
      <header><h1>{heading}</h1><span>{total} 个资源包</span><label className="catalog-sort">排序<select value={sort} onChange={(event) => onSort(event.target.value as CatalogSort)}><option value="recent">最近更新</option><option value="relevance">最相关</option><option value="title">标题</option></select></label></header>
      {results.length > 0
        ? <div className="publication-grid">{results.map((publication) => <PublicationCard key={publication.id} publication={publication} query={query} onOpen={() => onOpen(publication)} onOpenAuthor={() => onOpenAuthor(publication)} onOpenResource={(resourceId) => onOpenResource(publication, resourceId)} />)}</div>
        : <div className="empty-results"><Icon name="package" /><strong>没有匹配的资源包</strong><button type="button" onClick={() => { onQuery(""); onFilters(emptyCatalogFilters); }}>清除筛选</button></div>}
      {total > 0 && <nav className="catalog-pagination" aria-label="目录翻页"><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</button><span>第 {page} 页</span><button type="button" disabled={!hasMore} onClick={() => onPage(page + 1)}>下一页</button></nav>}
    </section>
    {mobileFilters && <div className="sheet-backdrop" role="presentation" onMouseDown={() => setMobileFilters(false)}>
      <section className="filter-sheet" role="dialog" aria-modal="true" aria-label="筛选" onMouseDown={(event) => event.stopPropagation()}>
        <header><strong>筛选</strong><button type="button" aria-label="关闭" onClick={() => setMobileFilters(false)}><Icon name="x" /></button></header>
        <FilterControls filters={filters} facets={facets} openDimension={openDimension} onOpen={setOpenDimension} onToggle={toggle} />
        <button className="primary-button" type="button" onClick={() => setMobileFilters(false)}>查看 {total} 个资源包</button>
      </section>
    </div>}
  </div>;
}

export function CanonicalPreview({ publication, resourceId }: { publication: Publication; resourceId: string }) {
  const [enlarged, setEnlarged] = useState(false);
  const resource = publication.resources.find((item) => item.id === resourceId) ?? publication.resources[0]!;
  const source = isSurfaceResource(resource.source) ? resource.source : null;
  const renderer = source
    ? resolveTemplateFrontend(resource.templateId, source.template.version)?.rendererRevision
    : undefined;
  const assets = useMemo(() => new Map(
    Object.entries(publication.mediaUrls ?? {}).map(([id, url]) => [id, { status: "ready" as const, url }]),
  ), [publication.mediaUrls]);
  useEffect(() => {
    if (!enlarged) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEnlarged(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [enlarged]);

  const card = source && renderer ? <CardDisplay
    designWidth={canonicalCardDesignSize.width}
    designHeight={canonicalCardDesignSize.height}
    fixedRatio={source.presentation.fixedRatio}
    displayAspectRatio={63 / 88}
    fit="contain"
  ><CanonicalCardSurface
      resource={source}
      expectedRendererRevision={renderer.revision}
      renderer={renderer}
      assets={assets}
      label={`${resource.name}规范卡面`}
    /></CardDisplay> : null;

  return <div className="canonical-preview">
    <header><strong>{resource.name}</strong><button type="button" onClick={() => setEnlarged(true)}><Icon name="maximize" />放大</button></header>
    <div className="canonical-stage">
      <div className="canonical-scale">
        {card ?? (source ? <p>当前版本尚不能预览此模板。</p> : <p>正在读取资源包详情…</p>)}
      </div>
    </div>
    {card && enlarged && <div className="canonical-enlarge-backdrop" role="presentation" onMouseDown={() => setEnlarged(false)}>
      <section className="canonical-enlarge-dialog" role="dialog" aria-modal="true" aria-label={`${resource.name}大图`} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="canonical-enlarge-close" aria-label="关闭大图" onClick={() => setEnlarged(false)}><Icon name="x" /></button>
        <div className="canonical-enlarge-card">{card}</div>
      </section>
    </div>}
  </div>;
}

function isSurfaceResource(value: unknown): value is SurfaceResource<Record<string, unknown>> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SurfaceResource<Record<string, unknown>>>;
  return Boolean(candidate.template && candidate.presentation && candidate.data);
}

function AcquisitionActions({
  publication,
  onHandoff,
  onDownload,
  includeDownload = true,
  downloadBusy = false,
}: {
  publication: Publication;
  onHandoff: (target: HandoffTarget, creatorMode?: "import" | "fork") => void;
  onDownload: () => void;
  includeDownload?: boolean;
  downloadBusy?: boolean;
}) {
  return <div className="acquisition-actions">
    {includeDownload && <button type="button" className="primary-button" disabled={downloadBusy} onClick={onDownload}>{downloadBusy ? <OperationStatus label="正在下载整包…" /> : <><Icon name="download" />下载 .pbres</>}</button>}
    <button type="button" onClick={() => onHandoff("player")}><Icon name="user" />安装到玩家</button>
    <button type="button" onClick={() => onHandoff("creator")}><Icon name="cards" />导入卡片工坊</button>
    <button type="button" onClick={() => onHandoff("creator", "fork")}><Icon name="cards" />创建 Fork 草稿</button>
    <button type="button" onClick={() => onHandoff("gm")}><Icon name="grid" />发送到桌面…</button>
  </div>;
}

export function PublicationDetail({
  publication,
  resourceId,
  onBack,
  onSelectResource,
  onHandoff,
  onDownload,
  onEditMetadata,
  onUnpublish,
  onRepublish,
  onDelete,
  onShare,
  onOpenAuthor,
  canManage,
  busyAction,
  downloadBusy = false,
}: {
  publication: Publication;
  resourceId?: string;
  onBack: () => void;
  onSelectResource: (resourceId: string) => void;
  onHandoff: (target: HandoffTarget, creatorMode?: "import" | "fork") => void;
  onDownload: () => void;
  onEditMetadata: () => void;
  onUnpublish: () => void;
  onRepublish: () => void;
  onDelete: () => void;
  onShare: () => void;
  onOpenAuthor: () => void;
  canManage: boolean;
  busyAction?: PublicationOperation;
  downloadBusy?: boolean;
}) {
  const selectedResourceId = resourceId ?? publication.resources[0]!.id;
  const [mobileActions, setMobileActions] = useState(false);
  const canAcquire = canAcquirePublication(publication, canManage);
  return <div className="publication-detail">
    <div className="breadcrumbs"><button type="button" onClick={onBack}>资源市场</button><Icon name="chevronRight" /><strong>{publication.title}</strong><button type="button" className="share-link" onClick={onShare}>复制当前链接</button></div>
    <div className="detail-layout">
      <section className="detail-heading">
        <img src={publication.cover.url} alt={publication.cover.alt} />
        <div><div className="detail-title-row"><div><h1>{publication.title}</h1><button type="button" className="detail-author" onClick={onOpenAuthor}>{publication.author}</button></div><span><em>v{publication.packageVersion}</em><em className={publication.status}>{publication.status === "published" ? "可取得" : "未发布"}</em></span></div>
        <p>{publication.summary}</p><div className="publication-tags"><TemplateBadges publication={publication} className="detail-template-badges" /><span>{publication.language}</span><span>{publication.systemLabels.join(" / ") || "未指定目标系统"}</span></div></div>
      </section>
      <aside className="resource-list"><header><strong>包内资源</strong><span>{publication.resourceCount} 项</span></header>
        <div className="resource-list-items">
          {publication.resources.map((resource) => <button type="button" className={resource.id === selectedResourceId ? "is-selected" : ""} key={resource.id} onClick={() => onSelectResource(resource.id)}>
            <Icon name="cards" /><span><strong>{resource.name}</strong><small>{resource.templateId}</small></span><Icon name="chevronRight" />
          </button>)}
        </div>
      </aside>
      <CanonicalPreview publication={publication} resourceId={selectedResourceId} />
      <aside className="detail-side">
        {canAcquire && <section><h2>取得资源包</h2><AcquisitionActions publication={publication} onHandoff={onHandoff} onDownload={onDownload} downloadBusy={downloadBusy} /></section>}
        <section><h2>当前资源包</h2><dl><dt>状态</dt><dd>{publication.status === "published" ? "已发布" : "未发布"}</dd><dt>版本</dt><dd>{publication.packageVersion}</dd><dt>更新时间</dt><dd>{publication.updatedAt}</dd><dt>资源</dt><dd>{publication.resourceCount} 项</dd><dt>语言</dt><dd>{publication.language}</dd><dt>目标系统</dt><dd>{publication.systemLabels.join(" / ") || "未指定"}</dd><dt>许可</dt><dd>{publication.license}</dd></dl>{canManage && <div className="publication-detail-management" aria-busy={Boolean(busyAction)}><button type="button" className="publication-edit-button" disabled={Boolean(busyAction)} onClick={onEditMetadata}><Icon name="pencil" />编辑资源包信息</button>{publication.status === "published" ? <button type="button" className="danger-button publication-unpublish-button" disabled={Boolean(busyAction)} onClick={onUnpublish}>取消发布</button> : <><button type="button" className="primary-button" disabled={Boolean(busyAction)} onClick={onRepublish}>{busyAction === "republish" ? <MarketBusyContent label="正在重新发布…" /> : "重新发布"}</button><button type="button" className="danger-button" disabled={Boolean(busyAction)} onClick={onDelete}>永久删除</button></>}</div>}</section>
      </aside>
    </div>
    {canAcquire && <button className="mobile-acquire" type="button" onClick={() => setMobileActions(true)}>取得资源包</button>}
    {canAcquire && mobileActions && <div className="sheet-backdrop" role="presentation" onMouseDown={() => setMobileActions(false)}><section className="acquisition-sheet" role="dialog" aria-modal="true" aria-label="取得资源包" onMouseDown={(event) => event.stopPropagation()}><header><strong>取得资源包</strong><button type="button" aria-label="关闭" onClick={() => setMobileActions(false)}><Icon name="x" /></button></header><AcquisitionActions publication={publication} onHandoff={(target, creatorMode) => { setMobileActions(false); onHandoff(target, creatorMode); }} onDownload={onDownload} includeDownload={false} /></section></div>}
  </div>;
}

function HandoffDialog({ intent, publication, onClose, onComplete }: { intent: HandoffIntent; publication: Publication; onClose: () => void; onComplete: () => void }) {
  const focused = publication.resources.find((resource) => resource.id === intent.focusLocator?.resourceId);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="handoff-dialog" role="dialog" aria-modal="true" aria-labelledby="handoff-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="handoff-title">交接到{targetLabels[intent.target]}</h2><button type="button" aria-label="关闭" onClick={onClose}><Icon name="x" /></button></header>
      <dl><dt>取得内容</dt><dd>{intent.creatorMode === "fork" ? "完整资源包 · Fork 草稿" : "完整资源包"}</dd>{focused && <><dt>聚焦资源</dt><dd>{focused.name}</dd></>}<dt>目标入口</dt><dd>{intent.target === "player" ? "玩家资源管理器 · 安装后逐项归类" : routeLabels[intent.targetRoute]}</dd>{intent.target === "gm" && <><dt>放置</dt><dd>从共享工作区拖入桌面</dd></>}</dl>
      <footer><button type="button" onClick={onClose}>取消</button><button type="button" className="primary-button" onClick={onComplete}>继续</button></footer>
    </section>
  </div>;
}

function PublicationManagementDialog({
  publication,
  coverUrl,
  systemPackageOptions,
  onClose,
  onChooseCover,
  onSave,
  busy = false,
}: {
  publication: Publication;
  coverUrl?: string;
  onClose: () => void;
  onChooseCover: () => void;
  systemPackageOptions: readonly SystemPackageOption[];
  onSave: (value: ResourcePackageEditorValue) => void;
  busy?: boolean;
}) {
  const packageName = publication.packageName ?? publication.title;
  const packageDescription = publication.packageDescription ?? publication.summary;
  const [value, setValue] = useState<ResourcePackageEditorValue>({
    package: {
      name: packageName,
      version: publication.packageVersion,
      description: packageDescription,
      targets: publication.targets ?? publication.systems.map((systemPackageId) => ({ systemPackageId, version: "1.0.0" })),
    },
    publication: {
      title: packageName,
      summary: packageDescription,
      language: publication.language,
      tags: publication.tags,
      licenseId: publication.license,
    },
  });

  return <ResourcePackageInfoDialog
    heading="编辑资源包信息"
    submitLabel="保存资源包信息"
    coverUrl={coverUrl ?? publication.cover.url}
    value={value}
    systemPackageOptions={systemPackageOptions}
    licenseOptions={[{ id: publication.license, label: publication.license }]}
    licenseReadOnly
    busy={busy}
    busyLabel="正在保存资源包信息…"
    onChange={setValue}
    onChooseCover={onChooseCover}
    onClose={onClose}
    onSubmit={() => onSave(value)}
  />;
}

function MarketBusyContent({ label }: { label: string }) {
  return <OperationStatus label={label} />;
}

export function UnpublishPublicationDialog({ publication, busy = false, onClose, onConfirm }: { publication: Publication; busy?: boolean; onClose: () => void; onConfirm: () => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={() => { if (!busy) onClose(); }}>
    <section className="unpublish-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unpublish-title" aria-busy={busy} onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="unpublish-title">取消发布{publication.title}？</h2><button type="button" aria-label="关闭" disabled={busy} onClick={onClose}><Icon name="x" /></button></header>
      <p>停止新的公开发现与取得；已经取得的副本保持不变。</p>
      <dl><dt>当前版本</dt><dd>{publication.packageVersion}</dd></dl>
      <footer><button type="button" disabled={busy} onClick={onClose}>返回</button><button type="button" className="danger-button" disabled={busy} onClick={onConfirm}>{busy ? <MarketBusyContent label="正在取消发布…" /> : "取消发布"}</button></footer>
    </section>
  </div>;
}

export function DeletePublicationDialog({ publication, busy = false, onClose, onConfirm }: { publication: Publication; busy?: boolean; onClose: () => void; onConfirm: () => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={() => { if (!busy) onClose(); }}>
    <section className="unpublish-dialog delete-publication-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-publication-title" aria-busy={busy} onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="delete-publication-title">永久删除{publication.title}？</h2><button type="button" aria-label="关闭" disabled={busy} onClick={onClose}><Icon name="x" /></button></header>
      <p>市场记录、稳定链接和市场中的资源包文件会永久删除。Creator 原稿及别人已经取得的副本不受影响。</p>
      <footer><button type="button" disabled={busy} onClick={onClose}>返回</button><button type="button" className="danger-button" disabled={busy} onClick={onConfirm}>{busy ? <MarketBusyContent label="正在永久删除…" /> : "永久删除"}</button></footer>
    </section>
  </div>;
}

export function MarketApp({
  locationHref,
  onLocationNavigate,
  onHandoffNavigate,
  systemPackageOptions = [],
}: {
  locationHref: string;
  onLocationNavigate(url: URL, replace?: boolean): void;
  onHandoffNavigate(target: HandoffTarget, url: URL): void;
  systemPackageOptions?: readonly SystemPackageOption[];
}) {
  const auth = useAuth();
  const locationRoute = useMemo(() => readMarketRoute(locationHref), [locationHref]);
  const [catalog, setCatalog] = useState<Publication[]>([]);
  const [detailPublication, setDetailPublication] = useState<Publication | null>(null);
  const [view, setView] = useState<ViewState>({ page: "discovery" });
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>(emptyCatalogFilters);
  const [facets, setFacets] = useState<CatalogFacets>(emptyFacets);
  const [sort, setSort] = useState<CatalogSort>("recent");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [manageableCatalog, setManageableCatalog] = useState<Publication[]>([]);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [handoff, setHandoff] = useState<HandoffIntent | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [managedPublicationId, setManagedPublicationId] = useState<string | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [coverDraft, setCoverDraft] = useState<MarketCoverDraft | null>(null);
  const [coverCropWorking, setCoverCropWorking] = useState(false);
  const [coverCropError, setCoverCropError] = useState<string | null>(null);
  const [unpublishPublicationId, setUnpublishPublicationId] = useState<string | null>(null);
  const [deletePublicationId, setDeletePublicationId] = useState<string | null>(null);
  const [publicationOperation, setPublicationOperation] = useState<{ publicationId: string; action: MarketOperation } | null>(null);
  const { notify } = usePlatformNotifications();
  const results = catalog;
  const publication = view.page === "detail"
    ? (detailPublication?.id === view.publicationId ? detailPublication : catalog.find((item) => item.id === view.publicationId))
    : undefined;
  const managedPublication = publication?.id === managedPublicationId ? publication : undefined;
  const publicationPendingUnpublish = publication?.id === unpublishPublicationId ? publication : undefined;
  const publicationPendingDelete = publication?.id === deletePublicationId ? publication : undefined;

  function discardCoverDraft() {
    setCoverDraft((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setPendingCoverFile(null);
    setCoverCropError(null);
  }

  function closePublicationManagement() {
    if (publicationOperation?.action === "metadata") return;
    discardCoverDraft();
    setManagedPublicationId(null);
  }

  function chooseMarketCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || publicationOperation) return;
    setCoverCropError(null);
    setPendingCoverFile(file);
  }

  async function applyMarketCoverCrop(selection: ImageCropSelection) {
    if (!pendingCoverFile) return;
    setCoverCropWorking(true);
    setCoverCropError(null);
    try {
      const admitted = await imageAdmission.admit(
        pendingCoverFile,
        publicationCoverPolicy,
        { crop: selection },
      );
      const url = URL.createObjectURL(admitted.blob);
      setCoverDraft((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return {
          assetId: admitted.id,
          blob: admitted.blob,
          url,
          asset: {
            id: admitted.id,
            mediaType: admitted.mediaType,
            byteLength: String(admitted.byteLength),
            width: String(admitted.width),
            height: String(admitted.height),
          },
        };
      });
      setPendingCoverFile(null);
    } catch (error) {
      setCoverCropError(error instanceof Error ? error.message : "图片处理失败，请重试。");
    } finally {
      setCoverCropWorking(false);
    }
  }

  function openPublication(item: Publication) {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    const focused = normalized
      ? item.resources.find((resource) => item.matchedResourceIds?.includes(resource.id))
        ?? item.resources.find((resource) => [resource.name, resource.path]
          .join(" ").toLocaleLowerCase("zh-CN").includes(normalized))
      : undefined;
    onLocationNavigate(marketRouteUrl({
      page: "detail",
      publicationId: item.id,
      ...(focused ? { resourceId: focused.id } : {}),
    }, window.location.origin));
  }

  function openHandoff(target: HandoffTarget, creatorMode: "import" | "fork" = "import") {
    if (!publication) return;
    const canManage = Boolean(auth.credentials && canManagePublication(
      publication,
      auth.credentials.accountId,
      auth.profile?.isAdmin,
    ));
    const intent = createHandoffIntent(
      publication,
      target,
      view.page === "detail" ? view.resourceId ?? publication.resources[0]?.id : undefined,
      canManage,
      creatorMode,
    );
    if (target === "player" || target === "creator") {
      const baseUrl = new URL(`/${target}`, window.location.origin);
      const url = target === "player"
        ? createPlayerHandoffUrl(intent, baseUrl)
        : createCreatorHandoffUrl(intent, baseUrl);
      onHandoffNavigate(target, url);
      return;
    }
    setHandoff(intent);
  }

  async function downloadCurrentPublication() {
    if (!publication || publicationOperation) return;
    setPublicationOperation({ publicationId: publication.id, action: "download" });
    try {
      const blob = await loadPublicationArchive(publication.id, auth.credentials);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = publication.archiveName;
      anchor.click();
      URL.revokeObjectURL(url);
      notify(`已下载 ${publication.archiveName}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "无法下载该资源包");
    } finally {
      setPublicationOperation(null);
    }
  }

  function completeHandoff() {
    if (!handoff) return;
    const baseUrl = new URL(`/${handoff.target}`, window.location.origin);
    const url = handoff.target === "player"
      ? createPlayerHandoffUrl(handoff, baseUrl)
      : createCreatorHandoffUrl(handoff, baseUrl);
    onHandoffNavigate(handoff.target, url);
    setHandoff(null);
  }

  async function updateManagedPublication(value: ResourcePackageEditorValue) {
    if (!managedPublication || !auth.credentials || publicationOperation) return;
    if (!value.publication) return;
    setPublicationOperation({ publicationId: managedPublication.id, action: "metadata" });
    try {
      let updated = await updatePublicationInformation(managedPublication.id, {
        package: {
          name: value.package.name,
          version: value.package.version,
          description: value.package.description,
        },
        targets: value.package.targets,
        title: value.publication.title,
        summary: value.publication.summary,
        language: value.publication.language,
        tags: value.publication.tags,
        coverAssetId: coverDraft?.assetId ?? managedPublication.cover.assetId,
        ...(coverDraft ? { coverAsset: coverDraft.asset } : {}),
      }, auth.credentials, fetch, coverDraft?.blob);
      if (updated.status === "unpublished") {
        updated = await loadManageablePublication(updated.id, auth.credentials);
      }
      setDetailPublication(updated);
      if (updated.status === "published") setCatalog((current) => upsertPublication(current, updated));
      setManageableCatalog((current) => updated.status === "unpublished"
        ? upsertPublication(current, updated)
        : current.filter((item) => item.id !== updated.id));
      setCatalogRevision((current) => current + 1);
      discardCoverDraft();
      setManagedPublicationId(null);
      notify("资源包信息已更新");
    } catch (error) {
      notify(error instanceof Error ? error.message : "无法更新资源包信息");
    } finally {
      setPublicationOperation(null);
    }
  }

  async function confirmUnpublish() {
    if (!publicationPendingUnpublish || !auth.credentials || publicationOperation) return;
    setPublicationOperation({ publicationId: publicationPendingUnpublish.id, action: "unpublish" });
    try {
      const unpublished = await unpublishLoadedPublication(publicationPendingUnpublish, auth.credentials);
      setCatalog((current) => upsertPublication(current, unpublished));
      setManageableCatalog((current) => upsertPublication(current, unpublished));
      setDetailPublication(unpublished);
      setCatalogRevision((current) => current + 1);
      setUnpublishPublicationId(null);
      notify("已取消发布");
    } catch (error) {
      notify(error instanceof Error ? error.message : "无法取消发布");
    } finally {
      setPublicationOperation(null);
    }
  }

  async function republishManagedPublication(target: Publication | undefined = managedPublication) {
    if (!target || !auth.credentials || publicationOperation) return;
    setPublicationOperation({ publicationId: target.id, action: "republish" });
    try {
      const republished = await republishPublication(target.id, auth.credentials);
      setCatalog((current) => upsertPublication(current, republished));
      setManageableCatalog((current) => current.filter((item) => item.id !== republished.id));
      setDetailPublication(republished);
      setCatalogRevision((current) => current + 1);
      notify("已重新发布");
    } catch (error) {
      notify(error instanceof Error ? error.message : "无法重新发布");
    } finally {
      setPublicationOperation(null);
    }
  }

  async function permanentlyDeletePublication() {
    if (!publicationPendingDelete || !auth.credentials || publicationOperation) return;
    setPublicationOperation({ publicationId: publicationPendingDelete.id, action: "delete" });
    try {
      await deletePublication(publicationPendingDelete.id, auth.credentials);
      const deletedId = publicationPendingDelete.id;
      setCatalog((current) => current.filter((item) => item.id !== deletedId));
      setManageableCatalog((current) => current.filter((item) => item.id !== deletedId));
      setDetailPublication(null);
      setDeletePublicationId(null);
      setCatalogRevision((current) => current + 1);
      onLocationNavigate(marketRouteUrl({ page: "discovery" }, window.location.origin), true);
      notify("资源包已从市场永久删除");
    } catch (error) {
      notify(error instanceof Error ? error.message : "无法永久删除该资源包");
    } finally {
      setPublicationOperation(null);
    }
  }

  useEffect(() => {
    setView(locationRoute);
    if (locationRoute.page !== "detail") {
      setDetailPublication(null);
      return;
    }
    if (auth.status === "loading" || auth.status === "working") return;
    if (detailPublication?.id === locationRoute.publicationId) {
      if (locationRoute.resourceId && !detailPublication.resources.some((item) => item.id === locationRoute.resourceId)) {
        setView({ ...locationRoute, page: "missing" });
      }
      return;
    }
    let cancelled = false;
    const loadDetail = async () => {
      try {
        let detailed: Publication;
        try {
          detailed = await loadPublication(locationRoute.publicationId);
        } catch (error) {
          if (!(error instanceof MarketApiError) || error.status !== 404 || !auth.credentials) throw error;
          detailed = await loadManageablePublication(locationRoute.publicationId, auth.credentials);
        }
        if (cancelled) return;
        if (locationRoute.resourceId && !detailed.resources.some((item) => item.id === locationRoute.resourceId)) {
          setView({ ...locationRoute, page: "missing" });
          return;
        }
        setCatalog((current) => upsertPublication(current, detailed));
        setDetailPublication(detailed);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof MarketApiError && error.status === 404) {
          setView({ ...locationRoute, page: "missing" });
        } else {
          notify(error instanceof Error ? error.message : "无法打开该资源包");
        }
      }
    };
    void loadDetail();
    return () => { cancelled = true; };
  }, [auth.credentials, auth.status, detailPublication, locationRoute]);

  useEffect(() => {
    let cancelled = false;
    if (auth.status === "loading" || auth.status === "working") return () => { cancelled = true; };
    if (!auth.credentials) {
      setManageableCatalog([]);
      return () => { cancelled = true; };
    }
    void loadManageablePublications(auth.credentials).then((loaded) => {
      if (!cancelled) setManageableCatalog(loaded.filter((item) => item.status === "unpublished"));
    }).catch((error) => {
      if (!cancelled) notify(error instanceof Error ? error.message : "部分未发布资源暂时无法读取");
    });
    return () => { cancelled = true; };
  }, [auth.credentials, auth.status]);

  useEffect(() => {
    if (auth.status === "loading" || auth.status === "working") return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void loadPublicationCatalog({
        query,
        filters,
        sort,
        page,
        pageSize: 24,
        ...(locationRoute.page === "author" ? { authorAccountId: locationRoute.accountId } : {}),
      }).then((loaded) => {
        if (cancelled) return;
        const privateMatches = page === 1
          ? filterPublications(
              manageableCatalog.filter((item) => item.status === "unpublished" && (
                locationRoute.page !== "author" || item.ownerAccountId === locationRoute.accountId
              )),
              query,
              filters,
            )
          : [];
        const privateIds = new Set(privateMatches.map((item) => item.id));
        setCatalog([
          ...privateMatches,
          ...loaded.publications.filter((item) => !privateIds.has(item.id)),
        ]);
        setFacets(loaded.facets);
        setTotal(loaded.total + privateMatches.length);
        setHasMore(loaded.hasMore);
      }).catch((error) => {
        if (!cancelled) notify(error instanceof Error ? error.message : "资源市场暂不可用");
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [auth.status, catalogRevision, filters, locationRoute, manageableCatalog, page, query, sort]);

  return <main className="market-app" style={{ "--market-appbar-height": `${marketDesignSource.appBar.height}px` } as React.CSSProperties} data-design-source={marketDesignSource.document}>
    {view.page === "missing"
      ? <section className="missing-publication"><Icon name="package" /><h1>{view.resourceId ? "这张资源已经无法公开查看" : "这个资源包已经无法公开查看"}</h1><p>资源包可能已由作者取消公开，或者链接中的编号不存在。</p><button type="button" onClick={() => onLocationNavigate(marketRouteUrl({ page: "discovery" }, window.location.origin))}>返回资源市场</button></section>
      : publication
        ? <PublicationDetail publication={publication} resourceId={view.page === "detail" ? view.resourceId : undefined} onBack={() => onLocationNavigate(marketRouteUrl({ page: "discovery" }, window.location.origin))} onSelectResource={(resourceId) => onLocationNavigate(marketRouteUrl({ page: "detail", publicationId: publication.id, resourceId }, window.location.origin))} onShare={() => void navigator.clipboard.writeText(locationHref).then(() => notify("链接已复制"), () => notify("无法复制链接"))} onOpenAuthor={() => onLocationNavigate(marketRouteUrl({ page: "author", accountId: publication.ownerAccountId }, window.location.origin))} onHandoff={openHandoff} onDownload={() => void downloadCurrentPublication()} onEditMetadata={() => { discardCoverDraft(); setManagedPublicationId(publication.id); }} onUnpublish={() => setUnpublishPublicationId(publication.id)} onRepublish={() => void republishManagedPublication(publication)} onDelete={() => setDeletePublicationId(publication.id)} canManage={Boolean(auth.credentials && canManagePublication(publication, auth.credentials.accountId, auth.profile?.isAdmin))} busyAction={publicationOperation?.publicationId === publication.id && (publicationOperation.action === "republish" || publicationOperation.action === "unpublish" || publicationOperation.action === "delete") ? publicationOperation.action : undefined} downloadBusy={publicationOperation?.publicationId === publication.id && publicationOperation.action === "download"} />
        : <Discovery query={query} filters={filters} results={results} facets={facets} total={total} sort={sort} page={page} hasMore={hasMore} heading={view.page === "author" ? `${results[0]?.author ?? "作者"}分享的资源包` : "资源市场"} onQuery={(value) => { setQuery(value); setPage(1); }} onFilters={(value) => { setFilters(value); setPage(1); }} onSort={(value) => { setSort(value); setPage(1); }} onPage={setPage} onOpen={openPublication} onOpenAuthor={(item) => onLocationNavigate(marketRouteUrl({ page: "author", accountId: item.ownerAccountId }, window.location.origin))} onOpenResource={(item, resourceId) => onLocationNavigate(marketRouteUrl({ page: "detail", publicationId: item.id, resourceId }, window.location.origin))} />}
    {handoff && publication && <HandoffDialog intent={handoff} publication={publication} onClose={() => setHandoff(null)} onComplete={completeHandoff} />}
    <input ref={coverInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={chooseMarketCover} />
    {pendingCoverFile && <ImageCropDialog
      file={pendingCoverFile}
      label="市场封面"
      fixedAspectRatio={publicationCoverPolicy.fixedAspectRatio}
      working={coverCropWorking}
      processingError={coverCropError}
      onCancel={() => { setPendingCoverFile(null); setCoverCropError(null); }}
      onConfirm={(selection) => void applyMarketCoverCrop(selection)}
    />}
    {managedPublication && <PublicationManagementDialog key={`${managedPublication.id}:${managedPublication.status}`} publication={managedPublication} coverUrl={coverDraft?.url} systemPackageOptions={systemPackageOptions} busy={publicationOperation?.publicationId === managedPublication.id && publicationOperation.action === "metadata"} onChooseCover={() => coverInputRef.current?.click()} onClose={closePublicationManagement} onSave={updateManagedPublication} />}
    {publicationPendingUnpublish && <UnpublishPublicationDialog publication={publicationPendingUnpublish} busy={publicationOperation?.publicationId === publicationPendingUnpublish.id && publicationOperation.action === "unpublish"} onClose={() => setUnpublishPublicationId(null)} onConfirm={confirmUnpublish} />}
    {publicationPendingDelete && <DeletePublicationDialog publication={publicationPendingDelete} busy={publicationOperation?.publicationId === publicationPendingDelete.id && publicationOperation.action === "delete"} onClose={() => setDeletePublicationId(null)} onConfirm={() => void permanentlyDeletePublication()} />}
  </main>;
}
