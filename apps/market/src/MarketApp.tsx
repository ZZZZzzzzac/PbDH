import { useEffect, useMemo, useState } from "react";

import { CanonicalCardSurface } from "@pbdh/resource-renderer/react";
import { useAuth } from "@pbdh/platform-auth/provider";
import { PlatformAppBar } from "@pbdh/platform-ui";
import type { SurfaceResource } from "@pbdh/resource-renderer/core";
import {
  adversaryRendererFor,
  weaponRendererFor,
} from "@pbdh/templates/frontend";
import type { AdversaryData, WeaponData } from "@pbdh/templates/core";

import { marketDesignSource } from "../design.generated.ts";
import { catalogOptions } from "./catalog-options.ts";
import { Icon } from "./Icons.tsx";
import { loadPublication, loadPublications } from "./market-api.ts";
import {
  canManagePublication,
  createCreatorHandoffUrl,
  createHandoffIntent,
  emptyCatalogFilters,
  filterPublications,
  publicationsOwnedBy,
  setPublicationStatus,
  toggleFilterValue,
  updatePublicationDisplayMetadata,
  type CatalogFilters,
  type HandoffIntent,
  type HandoffTarget,
  type Publication,
} from "./market-model.ts";

type FilterDimension = keyof CatalogFilters;
type ViewState =
  | { page: "discovery" }
  | { page: "detail"; publicationId: string; resourceId?: string };

const dimensionLabels: Record<FilterDimension, string> = {
  templateIds: "模板",
  systems: "目标系统",
  languages: "内容语言",
  categories: "分类",
};

const routeLabels: Record<HandoffIntent["targetRoute"], string> = {
  weapons: "Daggerheart Core / 武器",
  "other-resources": "其他资源",
  "creator-ingress": "卡片工坊 / 资源包导入",
};

const targetLabels: Record<HandoffTarget, string> = {
  player: "玩家车卡器",
  creator: "卡片工坊",
  gm: "GM 桌面",
};

function creatorAppBaseUrl(): URL {
  const configured = import.meta.env.VITE_CREATOR_APP_URL as string | undefined;
  if (configured?.trim()) return new URL(configured, window.location.origin);
  if (import.meta.env.DEV) {
    const url = new URL(window.location.href);
    url.port = "5173";
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  }
  return new URL("/creator/", window.location.origin);
}

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
      <div className="publication-kind-row"><div>{publication.templateIds.map((templateId) => <span className={`kind-badge ${publication.kind}`} key={templateId}>{templateId}</span>)}</div><b>v{publication.packageVersion}</b></div>
      <strong className="publication-title">{publication.title}</strong>
      <span className="publication-author">{publication.author}</span>
      <p>{publication.summary}</p>
      <div className="publication-tags"><span>{publication.language}</span><span>{publication.systemLabel.replace(" Core", "")}</span>{publication.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      <footer><strong>{publication.resourceCount} 项资源</strong><time dateTime={publication.updatedAt}>2 天前</time></footer>
    </div>
  </article>;
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft("");
  };
  return <div className="market-tag-field">
    <span>发现标签</span>
    <div className="market-tag-editor">
      {tags.map((tag) => <span className="market-tag" key={tag}>{tag}<button type="button" aria-label={`删除标签${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag))}>×</button></span>)}
      <input
        value={draft}
        aria-label="新增标签"
        placeholder="输入后按回车"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          } else if (event.key === "Backspace" && !draft && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
      />
    </div>
  </div>;
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

function CanonicalPreview({ publication, resourceId }: { publication: Publication; resourceId: string }) {
  const resource = publication.resources.find((item) => item.id === resourceId) ?? publication.resources[0]!;
  const assets = useMemo(() => new Map(
    Object.entries(publication.mediaUrls ?? {}).map(([id, url]) => [id, { status: "ready" as const, url }]),
  ), [publication.mediaUrls]);
  return <div className="canonical-preview">
    <header><strong>{resource.name}</strong><button type="button"><Icon name="maximize" />放大</button></header>
    <div className="canonical-stage">
      <div className="canonical-scale">
        {resource.templateId === "敌人"
          ? <CanonicalCardSurface
              resource={resource.source as SurfaceResource<AdversaryData>}
              expectedRendererRevision="enemy-card-r1"
              renderer={adversaryRendererFor((resource.source as SurfaceResource<AdversaryData>).template.version)}
              assets={assets}
              label={`${resource.name}规范卡面`}
            />
          : resource.templateId === "武器" ? <CanonicalCardSurface
              resource={resource.source as SurfaceResource<WeaponData>}
              expectedRendererRevision="weapon-card-r1"
              renderer={weaponRendererFor((resource.source as SurfaceResource<WeaponData>).template.version)}
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
    {includeDownload && <a className="primary-button" href={publication.archiveUrl} download={publication.archiveName} onClick={onDownload}><Icon name="download" />下载 .pbres</a>}
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
  onManage,
  canManage,
}: {
  publication: Publication;
  resourceId?: string;
  onBack: () => void;
  onSelectResource: (resourceId: string) => void;
  onHandoff: (target: HandoffTarget) => void;
  onDownload: () => void;
  onManage: () => void;
  canManage: boolean;
}) {
  const selectedResourceId = resourceId ?? publication.resources[0]!.id;
  const [mobileActions, setMobileActions] = useState(false);
  return <div className="publication-detail">
    <div className="breadcrumbs"><button type="button" onClick={onBack}>资源市场</button><Icon name="chevronRight" /><strong>{publication.title}</strong></div>
    <div className="detail-layout">
      <main className="detail-content">
        <section className="detail-heading">
          <img src={publication.cover.url} alt={publication.cover.alt} />
          <div><div className="detail-title-row"><div><h1>{publication.title}</h1><b>{publication.author}</b></div><span><em>v{publication.packageVersion}</em><em className={publication.status}>{publication.status === "available" ? "可取得" : "已撤回"}</em></span></div>
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
        {publication.status === "available" && <section><h2>取得资源包</h2><AcquisitionActions publication={publication} onHandoff={onHandoff} onDownload={onDownload} /></section>}
        <section><h2 className="metadata-heading"><span>当前出版物</span>{canManage && <button type="button" onClick={onManage}>管理</button>}</h2><dl><dt>状态</dt><dd>{publication.status === "available" ? "已发布" : "已撤回"}</dd><dt>版本</dt><dd>{publication.packageVersion}</dd><dt>更新时间</dt><dd>{publication.updatedAt}</dd><dt>资源</dt><dd>{publication.resourceCount} 项</dd><dt>语言</dt><dd>{publication.language}</dd><dt>目标系统</dt><dd>{publication.systemLabel}</dd><dt>许可</dt><dd>{publication.license}</dd></dl></section>
      </aside>
    </div>
    {publication.status === "available" && <button className="mobile-acquire" type="button" onClick={() => setMobileActions(true)}>取得资源包</button>}
    {publication.status === "available" && mobileActions && <div className="sheet-backdrop" role="presentation" onMouseDown={() => setMobileActions(false)}><section className="acquisition-sheet" role="dialog" aria-modal="true" aria-label="取得资源包" onMouseDown={(event) => event.stopPropagation()}><header><strong>取得资源包</strong><button type="button" aria-label="关闭" onClick={() => setMobileActions(false)}><Icon name="x" /></button></header><AcquisitionActions publication={publication} onHandoff={(target) => { setMobileActions(false); onHandoff(target); }} onDownload={onDownload} includeDownload={false} /></section></div>}
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

function HandoffFailureDialog({
  intent,
  onClose,
  onRetry,
}: {
  intent: HandoffIntent;
  onClose: () => void;
  onRetry: () => void;
}) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="handoff-dialog handoff-failure-dialog" role="alertdialog" aria-modal="true" aria-labelledby="handoff-failure-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="handoff-failure-title">无法打开{targetLabels[intent.target]}</h2><button type="button" aria-label="关闭" onClick={onClose}><Icon name="x" /></button></header>
      <p>未能打开目标应用，请允许本站打开新标签页后重试。</p>
      <footer><button type="button" onClick={onClose}>关闭</button><button type="button" className="primary-button" onClick={onRetry}>重试</button></footer>
    </section>
  </div>;
}

function PublicationManagementDialog({
  publication,
  onClose,
  onSave,
  onWithdraw,
  onRestore,
}: {
  publication: Publication;
  onClose: () => void;
  onSave: (metadata: { title: string; summary: string; language: string; tags: string[] }) => void;
  onWithdraw: () => void;
  onRestore: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(publication.title);
  const [summary, setSummary] = useState(publication.summary);
  const [language, setLanguage] = useState(publication.language);
  const [tags, setTags] = useState(publication.tags);

  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="publication-management-dialog" role="dialog" aria-modal="true" aria-labelledby="publication-management-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="publication-management-title">{publication.title}</h2><span className={publication.status}>{publication.status === "available" ? "已发布" : "已撤回"}</span><button type="button" aria-label="关闭" onClick={onClose}><Icon name="x" /></button></header>
      {editing
        ? <div className="publication-management-fields">
            <label><span>标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label><span>简介</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
            <div><label><span>内容语言</span><input value={language} onChange={(event) => setLanguage(event.target.value)} /></label><TagEditor tags={tags} onChange={setTags} /></div>
          </div>
        : <dl><dt>当前版本</dt><dd>{publication.packageVersion}</dd><dt>公开时间</dt><dd>{publication.updatedAt}</dd><dt>快照摘要</dt><dd className="digest-value">{publication.snapshotDigest}</dd></dl>}
      <footer>
        {editing
          ? <><button type="button" onClick={() => setEditing(false)}>取消</button><button type="button" className="primary-button" onClick={() => onSave({ title, summary, language, tags })}>保存展示信息</button></>
          : <><button type="button" onClick={onClose}>关闭</button><button type="button" onClick={() => setEditing(true)}>编辑展示信息</button>{publication.status === "available" ? <button type="button" className="danger-button" onClick={onWithdraw}>撤回出版物</button> : <button type="button" className="primary-button" onClick={onRestore}>恢复出版物</button>}</>}
      </footer>
    </section>
  </div>;
}

function WithdrawPublicationDialog({ publication, onClose, onConfirm }: { publication: Publication; onClose: () => void; onConfirm: () => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="withdraw-dialog" role="alertdialog" aria-modal="true" aria-labelledby="withdraw-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="withdraw-title">撤回{publication.title}？</h2><button type="button" aria-label="关闭" onClick={onClose}><Icon name="x" /></button></header>
      <p>停止新的公开发现与取得；已经取得的副本保持不变。</p>
      <dl><dt>当前版本</dt><dd>{publication.packageVersion}</dd></dl>
      <footer><button type="button" onClick={onClose}>取消</button><button type="button" className="danger-button" onClick={onConfirm}>撤回出版物</button></footer>
    </section>
  </div>;
}

function PublicationLibraryDialog({ publications: ownedPublications, onClose, onOpen }: { publications: Publication[]; onClose: () => void; onOpen: (publicationId: string) => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="publication-library-dialog" role="dialog" aria-modal="true" aria-labelledby="publication-library-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="publication-library-title">我的出版物</h2><button type="button" aria-label="关闭" onClick={onClose}><Icon name="x" /></button></header>
      <div>{ownedPublications.map((publication) => <button type="button" key={publication.id} onClick={() => onOpen(publication.id)}><img src={publication.cover.url} alt="" /><span><strong>{publication.title}</strong><small>v{publication.packageVersion}</small></span><b className={publication.status}>{publication.status === "available" ? "已发布" : "已撤回"}</b><Icon name="chevronRight" /></button>)}</div>
    </section>
  </div>;
}

export function MarketApp() {
  const auth = useAuth();
  const [catalog, setCatalog] = useState<Publication[]>([]);
  const [view, setView] = useState<ViewState>({ page: "discovery" });
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>(emptyCatalogFilters);
  const [handoff, setHandoff] = useState<HandoffIntent | null>(null);
  const [handoffFailure, setHandoffFailure] = useState<HandoffIntent | null>(null);
  const [managedPublicationId, setManagedPublicationId] = useState<string | null>(null);
  const [withdrawPublicationId, setWithdrawPublicationId] = useState<string | null>(null);
  const [publicationLibraryOpen, setPublicationLibraryOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const results = useMemo(() => filterPublications(catalog, query, filters), [catalog, query, filters]);
  const publication = view.page === "detail" ? catalog.find((item) => item.id === view.publicationId) : undefined;
  const managedPublication = catalog.find((item) => item.id === managedPublicationId);
  const publicationPendingWithdrawal = catalog.find((item) => item.id === withdrawPublicationId);

  async function openPublication(item: Publication) {
    try {
      const detailed = await loadPublication(item.id);
      setCatalog((current) => current.map((candidate) => candidate.id === detailed.id ? detailed : candidate));
      const normalized = query.trim().toLocaleLowerCase("zh-CN");
      const focused = normalized ? detailed.resources.find((resource) => [resource.name, resource.path].join(" ").toLocaleLowerCase("zh-CN").includes(normalized)) : undefined;
      setView({ page: "detail", publicationId: detailed.id, ...(focused ? { resourceId: focused.id } : {}) });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法打开该出版物");
    }
  }

  function openHandoff(target: HandoffTarget) {
    if (!publication) return;
    setHandoff(createHandoffIntent(publication, target, view.page === "detail" ? view.resourceId ?? publication.resources[0]?.id : undefined));
  }

  function completeHandoff() {
    if (!handoff) return;
    if (handoff.target === "creator" || handoff.target === "gm") {
      const targetWindow = window.open(createCreatorHandoffUrl(handoff, creatorAppBaseUrl()), "pbdh-creator");
      if (targetWindow) {
        targetWindow.focus();
        setHandoff(null);
        setNotice(handoff.target === "gm" ? "已打开 GM 桌面并导入共享工作区" : "已打开卡片工坊");
        return;
      }
    }
    setHandoffFailure(handoff);
    setHandoff(null);
  }

  function updateManagedPublication(metadata: { title: string; summary: string; language: string; tags: string[] }) {
    if (!managedPublication) return;
    setCatalog((current) => current.map((item) => item.id === managedPublication.id
      ? updatePublicationDisplayMetadata(item, {
          ...metadata,
          categories: item.categories,
          cover: item.cover,
        })
      : item));
    setManagedPublicationId(null);
    setNotice("展示信息已更新");
  }

  function confirmWithdrawal() {
    if (!publicationPendingWithdrawal) return;
    setCatalog((current) => current.map((item) => item.id === publicationPendingWithdrawal.id
      ? setPublicationStatus(item, "withdrawn")
      : item));
    setWithdrawPublicationId(null);
    setManagedPublicationId(publicationPendingWithdrawal.id);
    setNotice("出版物已撤回");
  }

  function restoreManagedPublication() {
    if (!managedPublication) return;
    setCatalog((current) => current.map((item) => item.id === managedPublication.id
      ? setPublicationStatus(item, "available")
      : item));
    setManagedPublicationId(null);
    setNotice("出版物已恢复");
  }

  useEffect(() => {
    let cancelled = false;
    void loadPublications().then((loaded) => {
      if (!cancelled) setCatalog(loaded);
    }).catch((error) => {
      if (!cancelled) setNotice(error instanceof Error ? error.message : "资源市场暂不可用");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  return <main className="market-app" style={{ "--market-appbar-height": `${marketDesignSource.appBar.height}px` } as React.CSSProperties} data-design-source={marketDesignSource.document}>
    <PlatformAppBar
      activePage="market"
      onNavigate={{ market: () => setView({ page: "discovery" }) }}
      accountManageLabel="我的出版物"
      onAccountManage={() => setPublicationLibraryOpen(true)}
    />
    {publication
      ? <PublicationDetail publication={publication} resourceId={view.page === "detail" ? view.resourceId : undefined} onBack={() => setView({ page: "discovery" })} onSelectResource={(resourceId) => setView({ page: "detail", publicationId: publication.id, resourceId })} onHandoff={openHandoff} onDownload={() => setNotice("正在下载完整资源包")} onManage={() => setManagedPublicationId(publication.id)} canManage={Boolean(auth.credentials && canManagePublication(publication, auth.credentials.accountId))} />
      : <Discovery query={query} filters={filters} results={results} catalog={catalog} onQuery={setQuery} onFilters={setFilters} onOpen={openPublication} />}
    {handoff && publication && <HandoffDialog intent={handoff} publication={publication} onClose={() => setHandoff(null)} onComplete={completeHandoff} />}
    {handoffFailure && publication && <HandoffFailureDialog intent={handoffFailure} onClose={() => setHandoffFailure(null)} onRetry={() => { setHandoff(handoffFailure); setHandoffFailure(null); }} />}
    {managedPublication && <PublicationManagementDialog key={`${managedPublication.id}:${managedPublication.status}`} publication={managedPublication} onClose={() => setManagedPublicationId(null)} onSave={updateManagedPublication} onWithdraw={() => { setManagedPublicationId(null); setWithdrawPublicationId(managedPublication.id); }} onRestore={restoreManagedPublication} />}
    {publicationPendingWithdrawal && <WithdrawPublicationDialog publication={publicationPendingWithdrawal} onClose={() => setWithdrawPublicationId(null)} onConfirm={confirmWithdrawal} />}
    {publicationLibraryOpen && <PublicationLibraryDialog publications={auth.credentials ? publicationsOwnedBy(catalog, auth.credentials.accountId) : []} onClose={() => setPublicationLibraryOpen(false)} onOpen={(publicationId) => { setPublicationLibraryOpen(false); setManagedPublicationId(publicationId); }} />}
    {notice && <div className="market-toast" role="status"><Icon name="check" />{notice}</div>}
  </main>;
}
