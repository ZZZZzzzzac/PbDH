import { useEffect, useMemo, useState } from "react";

import { CanonicalCardSurface } from "@pbdh/resource-renderer/react";
import { useAuth } from "@pbdh/platform-auth/provider";
import { PublicationDialog, type PublicationFormValue } from "@pbdh/publication-ui";
import type { SurfaceResource } from "@pbdh/resource-renderer/core";
import { trustedRendererFor } from "@pbdh/templates/frontend";

import { marketDesignSource } from "../design.generated.ts";
import { catalogOptions } from "./catalog-options.ts";
import { Icon } from "./Icons.tsx";
import {
  loadManageablePublication,
  loadPublicationArchive,
  loadPublication,
  loadVisiblePublications,
  republishPublication,
  updatePublicationMetadata,
  unpublishPublication,
} from "./market-api.ts";
import {
  canAcquirePublication,
  canManagePublication,
  createCreatorHandoffUrl,
  createHandoffIntent,
  createPlayerHandoffUrl,
  emptyCatalogFilters,
  filterPublications,
  toggleFilterValue,
  type CatalogFilters,
  type HandoffIntent,
  type HandoffTarget,
  type Publication,
} from "./market-model.ts";

type FilterDimension = keyof CatalogFilters;
type ViewState =
  | { page: "discovery" }
  | { page: "detail"; publicationId: string; resourceId?: string };

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

const routeLabels: Record<HandoffIntent["targetRoute"], string> = {
  weapons: "Daggerheart Core / 武器",
  armor: "Daggerheart Core / 护甲",
  ancestries: "Daggerheart Core / 种族",
  communities: "Daggerheart Core / 社群",
  classes: "Daggerheart Core / 职业",
  subclasses: "Daggerheart Core / 子职业",
  loot: "Daggerheart Core / 物品与消耗品",
  "domain-cards": "Daggerheart Core / 领域卡",
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
  catalog,
  onToggle,
}: {
  dimension: FilterDimension;
  filters: CatalogFilters;
  catalog: Publication[];
  onToggle: (dimension: FilterDimension, value: string) => void;
}) {
  return <div className="filter-menu" role="group" aria-label={`${dimensionLabels[dimension]}筛选`}>
    <strong>{dimensionLabels[dimension]}</strong>
    {catalogOptions[dimension].map((option) => <label className="filter-option" key={option.value}>
      <input
        type="checkbox"
        checked={filters[dimension].includes(option.value)}
        onChange={() => onToggle(dimension, option.value)}
      />
      <span>{option.label}</span>
      <small>{catalog.filter((publication) => {
        if (dimension === "templateIds") return publication.templateIds.includes(option.value);
        if (dimension === "systems") return publication.system === option.value;
        if (dimension === "languages") return publication.language === option.value;
        return publication.categories.includes(option.value);
      }).length}</small>
    </label>)}
  </div>;
}

function FilterControls({
  filters,
  catalog,
  openDimension,
  onOpen,
  onToggle,
}: {
  filters: CatalogFilters;
  catalog: Publication[];
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
        {open && <FilterMenu dimension={dimension} filters={filters} catalog={catalog} onToggle={onToggle} />}
      </div>;
    })}
  </div>;
}

function PublicationCard({ publication, onOpen }: { publication: Publication; onOpen: () => void }) {
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
      <img src={publication.cover.url} alt={publication.cover.alt} draggable={false} />
    </div>
    <div className="publication-summary">
      <div className="publication-kind-row"><div>{publication.templateIds.map((templateId) => <span className={`kind-badge ${publication.kind}`} key={templateId}>{templateId}</span>)}</div><span className="publication-card-meta"><b>v{publication.packageVersion}</b>{publication.status === "unpublished" && <em>未发布</em>}</span></div>
      <strong className="publication-title">{publication.title}</strong>
      <span className="publication-author">{publication.author}</span>
      <p>{publication.summary}</p>
      <div className="publication-tags"><span>{publication.language}</span><span>{publication.systemLabel.replace(" Core", "")}</span>{publication.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      <footer><strong>{publication.resourceCount} 项资源</strong><time dateTime={publication.updatedAt}>2 天前</time></footer>
    </div>
  </article>;
}

function Discovery({
  query,
  filters,
  results,
  catalog,
  onQuery,
  onFilters,
  onOpen,
}: {
  query: string;
  filters: CatalogFilters;
  results: Publication[];
  catalog: Publication[];
  onQuery: (value: string) => void;
  onFilters: (filters: CatalogFilters) => void;
  onOpen: (publication: Publication) => void;
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
      <FilterControls filters={filters} catalog={catalog} openDimension={openDimension} onOpen={setOpenDimension} onToggle={toggle} />
    </aside>
    <div className="mobile-search-row">
      <SearchField value={query} onChange={onQuery} />
      <button type="button" onClick={() => setMobileFilters(true)}><Icon name="sliders" />筛选</button>
    </div>
    <section className="market-results">
      <header><h1>Daggerheart 资源</h1><span>{results.length} 个出版物</span></header>
      {results.length > 0
        ? <div className="publication-grid">{results.map((publication) => <PublicationCard key={publication.id} publication={publication} onOpen={() => onOpen(publication)} />)}</div>
        : <div className="empty-results"><Icon name="package" /><strong>没有匹配的出版物</strong><button type="button" onClick={() => { onQuery(""); onFilters(emptyCatalogFilters); }}>清除筛选</button></div>}
    </section>
    {mobileFilters && <div className="sheet-backdrop" role="presentation" onMouseDown={() => setMobileFilters(false)}>
      <section className="filter-sheet" role="dialog" aria-modal="true" aria-label="筛选" onMouseDown={(event) => event.stopPropagation()}>
        <header><strong>筛选</strong><button type="button" aria-label="关闭" onClick={() => setMobileFilters(false)}><Icon name="x" /></button></header>
        <FilterControls filters={filters} catalog={catalog} openDimension={openDimension} onOpen={setOpenDimension} onToggle={toggle} />
        <button className="primary-button" type="button" onClick={() => setMobileFilters(false)}>查看 {results.length} 个出版物</button>
      </section>
    </div>}
  </div>;
}

export function CanonicalPreview({ publication, resourceId }: { publication: Publication; resourceId: string }) {
  const resource = publication.resources.find((item) => item.id === resourceId) ?? publication.resources[0]!;
  const renderer = trustedRendererFor(
    resource.templateId,
    (resource.source as SurfaceResource<Record<string, unknown>>).template.version,
  );
  const assets = useMemo(() => new Map(
    Object.entries(publication.mediaUrls ?? {}).map(([id, url]) => [id, { status: "ready" as const, url }]),
  ), [publication.mediaUrls]);
  return <div className="canonical-preview">
    <header><strong>{resource.name}</strong><button type="button"><Icon name="maximize" />放大</button></header>
    <div className="canonical-stage">
      <div className="canonical-scale">
        {renderer ? <CanonicalCardSurface
              resource={resource.source as SurfaceResource<Record<string, unknown>>}
              expectedRendererRevision={renderer.revision}
              renderer={renderer}
              assets={assets}
              label={`${resource.name}规范卡面`}
            /> : <p>当前版本尚不能预览此模板。</p>}
      </div>
    </div>
  </div>;
}

function AcquisitionActions({
  publication,
  onHandoff,
  onDownload,
  includeDownload = true,
}: {
  publication: Publication;
  onHandoff: (target: HandoffTarget) => void;
  onDownload: () => void;
  includeDownload?: boolean;
}) {
  return <div className="acquisition-actions">
    {includeDownload && <button type="button" className="primary-button" onClick={onDownload}><Icon name="download" />下载 .pbres</button>}
    <button type="button" onClick={() => onHandoff("player")}><Icon name="user" />安装到玩家</button>
    <button type="button" onClick={() => onHandoff("creator")}><Icon name="cards" />导入卡片工坊</button>
    <button type="button" onClick={() => onHandoff("gm")}><Icon name="grid" />发送到桌面…</button>
  </div>;
}

function PublicationDetail({
  publication,
  resourceId,
  onBack,
  onSelectResource,
  onHandoff,
  onDownload,
  onEditMetadata,
  onUnpublish,
  onRepublish,
  canManage,
}: {
  publication: Publication;
  resourceId?: string;
  onBack: () => void;
  onSelectResource: (resourceId: string) => void;
  onHandoff: (target: HandoffTarget) => void;
  onDownload: () => void;
  onEditMetadata: () => void;
  onUnpublish: () => void;
  onRepublish: () => void;
  canManage: boolean;
}) {
  const selectedResourceId = resourceId ?? publication.resources[0]!.id;
  const [mobileActions, setMobileActions] = useState(false);
  const canAcquire = canAcquirePublication(publication, canManage);
  return <div className="publication-detail">
    <div className="breadcrumbs"><button type="button" onClick={onBack}>资源市场</button><Icon name="chevronRight" /><strong>{publication.title}</strong></div>
    <div className="detail-layout">
      <main className="detail-content">
        <section className="detail-heading">
          <img src={publication.cover.url} alt={publication.cover.alt} />
          <div><div className="detail-title-row"><div><h1>{publication.title}</h1><b>{publication.author}</b></div><span><em>v{publication.packageVersion}</em><em className={publication.status}>{publication.status === "published" ? "可取得" : "未发布"}</em></span></div>
          <p>{publication.summary}</p><div className="publication-tags"><span className={publication.kind}>{publication.templateIds.join(" / ")}</span><span>{publication.language}</span><span>{publication.systemLabel.replace(" Core", "")}</span></div></div>
        </section>
        <div className="resource-browser">
          <aside className="resource-list"><header><strong>包内资源</strong><span>{publication.resourceCount} 项</span></header>
            {publication.resources.map((resource) => <button type="button" className={resource.id === selectedResourceId ? "is-selected" : ""} key={resource.id} onClick={() => onSelectResource(resource.id)}>
              <Icon name="cards" /><span><strong>{resource.name}</strong><small>{resource.templateId}</small></span><Icon name="chevronRight" />
            </button>)}
          </aside>
          <CanonicalPreview publication={publication} resourceId={selectedResourceId} />
        </div>
      </main>
      <aside className="detail-side">
        {canAcquire && <section><h2>取得资源包</h2><AcquisitionActions publication={publication} onHandoff={onHandoff} onDownload={onDownload} /></section>}
        <section><h2>当前出版物</h2><dl><dt>状态</dt><dd>{publication.status === "published" ? "已发布" : "未发布"}</dd><dt>版本</dt><dd>{publication.packageVersion}</dd><dt>更新时间</dt><dd>{publication.updatedAt}</dd><dt>资源</dt><dd>{publication.resourceCount} 项</dd><dt>语言</dt><dd>{publication.language}</dd><dt>目标系统</dt><dd>{publication.systemLabel}</dd><dt>许可</dt><dd>{publication.license}</dd></dl>{canManage && <div className="publication-detail-management"><button type="button" onClick={onEditMetadata}><Icon name="pencil" />编辑展示信息</button>{publication.status === "published" ? <button type="button" className="danger-button" onClick={onUnpublish}>取消发布</button> : <button type="button" className="primary-button" onClick={onRepublish}>重新发布</button>}</div>}</section>
      </aside>
    </div>
    {canAcquire && <button className="mobile-acquire" type="button" onClick={() => setMobileActions(true)}>取得资源包</button>}
    {canAcquire && mobileActions && <div className="sheet-backdrop" role="presentation" onMouseDown={() => setMobileActions(false)}><section className="acquisition-sheet" role="dialog" aria-modal="true" aria-label="取得资源包" onMouseDown={(event) => event.stopPropagation()}><header><strong>取得资源包</strong><button type="button" aria-label="关闭" onClick={() => setMobileActions(false)}><Icon name="x" /></button></header><AcquisitionActions publication={publication} onHandoff={(target) => { setMobileActions(false); onHandoff(target); }} onDownload={onDownload} includeDownload={false} /></section></div>}
  </div>;
}

function HandoffDialog({ intent, publication, onClose, onComplete }: { intent: HandoffIntent; publication: Publication; onClose: () => void; onComplete: () => void }) {
  const focused = publication.resources.find((resource) => resource.id === intent.focusLocator?.resourceId);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="handoff-dialog" role="dialog" aria-modal="true" aria-labelledby="handoff-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="handoff-title">交接到{targetLabels[intent.target]}</h2><button type="button" aria-label="关闭" onClick={onClose}><Icon name="x" /></button></header>
      <dl><dt>取得内容</dt><dd>完整资源包</dd>{focused && <><dt>聚焦资源</dt><dd>{focused.name}</dd></>}<dt>目标入口</dt><dd>{routeLabels[intent.targetRoute]}</dd>{intent.target === "gm" && <><dt>放置</dt><dd>从共享工作区拖入桌面</dd></>}</dl>
      <footer><button type="button" onClick={onClose}>取消</button><button type="button" className="primary-button" onClick={onComplete}>继续</button></footer>
    </section>
  </div>;
}

function PublicationManagementDialog({
  publication,
  onClose,
  onSave,
}: {
  publication: Publication;
  onClose: () => void;
  onSave: (metadata: { title: string; summary: string; language: string; tags: string[] }) => void;
}) {
  const [value, setValue] = useState<PublicationFormValue>({
    title: publication.title,
    summary: publication.summary,
    language: publication.language,
    tags: publication.tags,
    licenseId: publication.license,
  });

  return <PublicationDialog
    heading="编辑资源包展示"
    submitLabel="保存展示信息"
    packageName={publication.title}
    packageVersion={publication.packageVersion}
    resourceCount={publication.resourceCount}
    coverUrl={publication.cover.url}
    value={value}
    licenseOptions={[{ id: publication.license, label: publication.license }]}
    licenseReadOnly
    onChange={setValue}
    onClose={onClose}
    onSubmit={() => onSave({ title: value.title, summary: value.summary, language: value.language, tags: value.tags })}
  />;
}

function UnpublishPublicationDialog({ publication, onClose, onConfirm }: { publication: Publication; onClose: () => void; onConfirm: () => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="unpublish-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unpublish-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="unpublish-title">取消发布{publication.title}？</h2><button type="button" aria-label="关闭" onClick={onClose}><Icon name="x" /></button></header>
      <p>停止新的公开发现与取得；已经取得的副本保持不变。</p>
      <dl><dt>当前版本</dt><dd>{publication.packageVersion}</dd></dl>
      <footer><button type="button" onClick={onClose}>返回</button><button type="button" className="danger-button" onClick={onConfirm}>取消发布</button></footer>
    </section>
  </div>;
}

export function MarketApp({
  onHandoffNavigate,
}: {
  onHandoffNavigate(target: HandoffTarget, url: URL): void;
}) {
  const auth = useAuth();
  const [catalog, setCatalog] = useState<Publication[]>([]);
  const [detailPublication, setDetailPublication] = useState<Publication | null>(null);
  const [view, setView] = useState<ViewState>({ page: "discovery" });
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>(emptyCatalogFilters);
  const [handoff, setHandoff] = useState<HandoffIntent | null>(null);
  const [managedPublicationId, setManagedPublicationId] = useState<string | null>(null);
  const [unpublishPublicationId, setUnpublishPublicationId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const results = useMemo(() => filterPublications(catalog, query, filters), [catalog, query, filters]);
  const publication = view.page === "detail"
    ? (detailPublication?.id === view.publicationId ? detailPublication : catalog.find((item) => item.id === view.publicationId))
    : undefined;
  const managedPublication = publication?.id === managedPublicationId ? publication : undefined;
  const publicationPendingUnpublish = publication?.id === unpublishPublicationId ? publication : undefined;

  async function openPublication(item: Publication) {
    try {
      const detailed = item.status === "unpublished" && auth.credentials
        ? await loadManageablePublication(item.id, auth.credentials)
        : await loadPublication(item.id);
      setCatalog((current) => current.map((candidate) => candidate.id === detailed.id ? detailed : candidate));
      setDetailPublication(detailed);
      const normalized = query.trim().toLocaleLowerCase("zh-CN");
      const focused = normalized ? detailed.resources.find((resource) => [resource.name, resource.path].join(" ").toLocaleLowerCase("zh-CN").includes(normalized)) : undefined;
      setView({ page: "detail", publicationId: detailed.id, ...(focused ? { resourceId: focused.id } : {}) });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法打开该出版物");
    }
  }

  function openHandoff(target: HandoffTarget) {
    if (!publication) return;
    const canManage = Boolean(auth.credentials && canManagePublication(
      publication,
      auth.credentials.accountId,
      auth.profile?.isAdmin,
    ));
    setHandoff(createHandoffIntent(
      publication,
      target,
      view.page === "detail" ? view.resourceId ?? publication.resources[0]?.id : undefined,
      canManage,
    ));
  }

  async function downloadCurrentPublication() {
    if (!publication) return;
    try {
      const blob = await loadPublicationArchive(publication.id, auth.credentials);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = publication.archiveName;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice(`已下载 ${publication.archiveName}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法下载该资源包");
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
    setNotice(`已切换到${targetLabels[handoff.target]}`);
  }

  async function updateManagedPublication(metadata: { title: string; summary: string; language: string; tags: string[] }) {
    if (!managedPublication || !auth.credentials) return;
    try {
      let updated = await updatePublicationMetadata(managedPublication.id, {
        ...metadata,
        coverAssetId: managedPublication.cover.assetId,
      }, auth.credentials);
      if (updated.status === "unpublished") {
        updated = await loadManageablePublication(updated.id, auth.credentials);
      }
      setDetailPublication(updated);
      if (updated.status === "published") setCatalog((current) => upsertPublication(current, updated));
      setManagedPublicationId(null);
      setNotice("展示信息已更新");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法更新展示信息");
    }
  }

  async function confirmUnpublish() {
    if (!publicationPendingUnpublish || !auth.credentials) return;
    try {
      await unpublishPublication(publicationPendingUnpublish.id, auth.credentials);
      const unpublished = await loadManageablePublication(publicationPendingUnpublish.id, auth.credentials);
      setCatalog((current) => upsertPublication(current, unpublished));
      setDetailPublication(unpublished);
      setUnpublishPublicationId(null);
      setNotice("已取消发布");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法取消发布");
    }
  }

  async function republishManagedPublication(target: Publication | undefined = managedPublication) {
    if (!target || !auth.credentials) return;
    try {
      const republished = await republishPublication(target.id, auth.credentials);
      setCatalog((current) => upsertPublication(current, republished));
      setDetailPublication(republished);
      setNotice("已重新发布");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法重新发布");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void loadVisiblePublications(
      auth.status,
      auth.credentials,
      fetch,
      URL.createObjectURL,
      () => setNotice("部分未发布资源暂时无法读取"),
    ).then((loaded) => {
      if (!cancelled && loaded) setCatalog(loaded);
    }).catch((error) => {
      if (!cancelled) setNotice(error instanceof Error ? error.message : "资源市场暂不可用");
    });
    return () => { cancelled = true; };
  }, [auth.credentials, auth.status]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  return <main className="market-app" style={{ "--market-appbar-height": `${marketDesignSource.appBar.height}px` } as React.CSSProperties} data-design-source={marketDesignSource.document}>
    {publication
      ? <PublicationDetail publication={publication} resourceId={view.page === "detail" ? view.resourceId : undefined} onBack={() => { setView({ page: "discovery" }); setDetailPublication(null); }} onSelectResource={(resourceId) => setView({ page: "detail", publicationId: publication.id, resourceId })} onHandoff={openHandoff} onDownload={() => void downloadCurrentPublication()} onEditMetadata={() => setManagedPublicationId(publication.id)} onUnpublish={() => setUnpublishPublicationId(publication.id)} onRepublish={() => void republishManagedPublication(publication)} canManage={Boolean(auth.credentials && canManagePublication(publication, auth.credentials.accountId, auth.profile?.isAdmin))} />
      : <Discovery query={query} filters={filters} results={results} catalog={catalog} onQuery={setQuery} onFilters={setFilters} onOpen={openPublication} />}
    {handoff && publication && <HandoffDialog intent={handoff} publication={publication} onClose={() => setHandoff(null)} onComplete={completeHandoff} />}
    {managedPublication && <PublicationManagementDialog key={`${managedPublication.id}:${managedPublication.status}`} publication={managedPublication} onClose={() => setManagedPublicationId(null)} onSave={updateManagedPublication} />}
    {publicationPendingUnpublish && <UnpublishPublicationDialog publication={publicationPendingUnpublish} onClose={() => setUnpublishPublicationId(null)} onConfirm={confirmUnpublish} />}
    {notice && <div className="market-toast" role="status"><Icon name="check" />{notice}</div>}
  </main>;
}
