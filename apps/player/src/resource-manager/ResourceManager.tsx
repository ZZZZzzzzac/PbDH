import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";

import {
  loadPbres,
  type ContractDiagnostic,
  type ResourcePackageCandidate,
  type SystemPackageDocument,
} from "@pbdh/contract-runtime";

import {
  planResourcePackageInstall,
  type InstalledResourcePackage,
  type ResourceLibrary,
  type ResourcePackageInstallPlan,
} from "../resources/resource-library.ts";
import { validateResourcePackageCandidate } from "../resources/resource-package-validator.ts";
import { playerResourceManagerDesign } from "./design.generated.ts";

type ResourceManagerProps = {
  currentSystem: SystemPackageDocument;
  library: ResourceLibrary;
  onCommitInstall: (
    plan: Exclude<ResourcePackageInstallPlan, { kind: "no-op" }>,
  ) => Promise<void>;
  onClose: () => void;
  onOpenResource: (installed: InstalledResourcePackage, resourceId: string) => void;
};

type Dialog =
  | { kind: "install"; plan: Extract<ResourcePackageInstallPlan, { kind: "insert" }> }
  | { kind: "update"; plan: Extract<ResourcePackageInstallPlan, { kind: "update" }> }
  | { kind: "no-op"; installed: InstalledResourcePackage }
  | { kind: "invalid"; diagnostics: ContractDiagnostic[] }
  | null;

const typeIcons: Record<string, string> = {
  敌人: "♜",
  环境: "⌁",
  武器: "⚔",
  护甲: "◇",
  物品: "◉",
};

function resourceName(resource: InstalledResourcePackage["document"]["resources"][number]): string {
  const data = resource.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const name = data["名称"];
    if (typeof name === "string" && name.trim()) return name;
  }
  return resource.path.split("/").at(-1)?.replace(/\.json$/u, "") || "未命名资源";
}

function routeLabel(installed: InstalledResourcePackage, resourceId: string): string {
  const route = installed.routes.find((candidate) => candidate.resource.id === resourceId);
  return route?.nativeEntry?.label ?? "其他资源";
}

function countsByDestination(plan: Exclude<ResourcePackageInstallPlan, { kind: "no-op" }>) {
  const counts = new Map<string, number>();
  for (const route of plan.routes) {
    const label = route.nativeEntry?.label ?? "其他资源";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts];
}

function DialogSurface({
  dialog,
  onCancel,
  onCommit,
  onOpen,
}: {
  dialog: Exclude<Dialog, null>;
  onCancel: () => void;
  onCommit: (plan: Exclude<ResourcePackageInstallPlan, { kind: "no-op" }>) => void | Promise<void>;
  onOpen: (installed: InstalledResourcePackage) => void;
}) {
  const [technicalDetails, setTechnicalDetails] = useState(false);
  if (dialog.kind === "invalid") return <div className="player-dialog-backdrop">
    <section className="player-dialog compact" role="alertdialog" aria-modal="true">
      <header><h2>无法安装资源包</h2><button aria-label="关闭" onClick={onCancel}>×</button></header>
      <div className="dialog-content">
        <div className="diagnostic error"><strong>资源包损坏或不完整</strong><span>现有资源库没有发生变化。</span></div>
        <button className="technical-toggle" onClick={() => setTechnicalDetails((value) => !value)}>查看技术详情</button>
        {technicalDetails && <ul className="technical-details">{dialog.diagnostics.map((item) =>
          <li key={`${item.code}:${item.location}`}><code>{item.code}</code><span>{item.location || "/"}</span></li>)}</ul>}
      </div>
      <footer><button className="primary" onClick={onCancel}>关闭</button></footer>
    </section>
  </div>;

  if (dialog.kind === "no-op") return <div className="player-dialog-backdrop">
    <section className="player-dialog small" role="dialog" aria-modal="true">
      <header><h2>此资源包已经安装</h2><button aria-label="关闭" onClick={onCancel}>×</button></header>
      <div className="dialog-content"><div className="diagnostic info"><strong>没有需要应用的变化</strong><span>没有创建副本，也没有修改资源库。</span></div></div>
      <footer><button onClick={onCancel}>关闭</button><button className="primary" onClick={() => onOpen(dialog.installed)}>打开资源包</button></footer>
    </section>
  </div>;

  const { plan } = dialog;
  const document = plan.candidate.document;
  const routeCounts = countsByDestination(plan);
  return <div className="player-dialog-backdrop">
    <section className="player-dialog" role="dialog" aria-modal="true">
      <header><h2>{dialog.kind === "update" ? "更新资源包" : "安装资源包"}</h2><button aria-label="关闭" onClick={onCancel}>×</button></header>
      <div className="dialog-content">
        <div className="package-heading"><span className="package-symbol">▣</span><div><h3>{document.package.name}</h3><small>版本 {document.package.version} · 本地文件</small></div></div>
        {plan.kind === "update" && <div className="version-change"><span>{plan.existing.document.package.version}</span><b>→</b><span>{document.package.version}</span></div>}
        <div className="summary-grid"><div><b>{document.resources.length}</b><span>个资源</span></div><div><b>{document.assets.length}</b><span>张图片</span></div><div><b>{routeCounts.length}</b><span>种使用位置</span></div></div>
        <div className="diagnostic success"><strong>可用于当前系统</strong><span>{routeCounts.map(([label, count]) => `${label} ${count}`).join(" · ")}</span></div>
        <div className="type-summary"><strong>资源类型</strong><div>{routeCounts.map(([label, count]) => <span key={label}><b>{label}</b>{count}</span>)}</div></div>
        <div className="license-row"><span>许可</span><b>{document.license.label}</b></div>
      </div>
      <footer><button onClick={onCancel}>取消</button><button className="primary" onClick={() => onCommit(plan)}>{dialog.kind === "update" ? "更新" : "安装"}</button></footer>
    </section>
  </div>;
}

export function ResourceManager({ currentSystem, library, onCommitInstall, onClose, onOpenResource }: ResourceManagerProps) {
  const packages = [...library.values()];
  const [selectedId, setSelectedId] = useState(packages[0]?.document.package.id ?? "");
  const [packageQuery, setPackageQuery] = useState("");
  const [resourceQuery, setResourceQuery] = useState("");
  const [selectedType, setSelectedType] = useState("全部");
  const [dialog, setDialog] = useState<Dialog>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = library.get(selectedId) ?? packages[0];
  const filteredPackages = packages.filter((installed) =>
    installed.document.package.name.toLocaleLowerCase().includes(packageQuery.toLocaleLowerCase()));

  const resourceTypes = useMemo(() => {
    if (!selected) return [];
    const counts = new Map<string, number>();
    for (const resource of selected.document.resources) {
      const label = routeLabel(selected, resource.id);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts];
  }, [selected]);
  const resources = (selected?.document.resources ?? []).filter((resource) => {
    const label = selected ? routeLabel(selected, resource.id) : "";
    return (selectedType === "全部" || selectedType === label)
      && resourceName(resource).toLocaleLowerCase().includes(resourceQuery.toLocaleLowerCase());
  });
  const style = {
    "--player-canvas": playerResourceManagerDesign.canvas.background,
    "--player-panel": playerResourceManagerDesign.manager.background,
    "--player-line": playerResourceManagerDesign.manager.border,
    "--player-bar": playerResourceManagerDesign.bar.background,
    "--player-list-width": `${playerResourceManagerDesign.columns.packageListWidth}px`,
    "--player-selected": playerResourceManagerDesign.selected.background,
    "--player-accent": playerResourceManagerDesign.selected.accent,
    "--player-primary": playerResourceManagerDesign.primary.background,
    "--player-success": playerResourceManagerDesign.success.background,
    "--player-success-text": playerResourceManagerDesign.success.text,
    "--player-error": playerResourceManagerDesign.dialog.errorBackground,
    "--player-error-text": playerResourceManagerDesign.dialog.errorText,
  } as CSSProperties;

  async function importPackage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await loadPbres(new Uint8Array(await file.arrayBuffer()), validateResourcePackageCandidate);
    if (!result.candidate) return setDialog({ kind: "invalid", diagnostics: result.diagnostics });
    const plan = planResourcePackageInstall({ currentSystem, library, candidate: result.candidate });
    if (plan.kind === "no-op") return setDialog({ kind: "no-op", installed: plan.existing });
    setDialog(plan.kind === "insert" ? { kind: "install", plan } : { kind: "update", plan });
  }

  async function commit(plan: Exclude<ResourcePackageInstallPlan, { kind: "no-op" }>) {
    try {
      await onCommitInstall(plan);
      setSelectedId(plan.candidate.document.package.id);
      setDialog(null);
    } catch {
      setDialog({
        kind: "invalid",
        diagnostics: [{
          code: "player.resource-package.local-write-failed",
          severity: "error",
          family: "player",
          version: "0",
          location: "",
          params: {},
        }],
      });
    }
  }

  return <div className="resource-manager-layer" style={style} data-design-source={playerResourceManagerDesign.document}>
    <section className="resource-manager" role="dialog" aria-modal="true" aria-label="资源管理器">
      <header className="manager-bar"><h1>资源管理器</h1><span>{currentSystem.package.name}</span><button className="install" onClick={() => inputRef.current?.click()}>＋ 安装资源包</button><button className="close" aria-label="关闭资源管理器" onClick={onClose}>×</button></header>
      <div className="manager-body">
        <aside className="package-list"><div className="list-title"><h2>已安装资源包</h2><span>{packages.length}</span></div>
          <input aria-label="搜索资源包" placeholder="搜索资源包" value={packageQuery} onChange={(event) => setPackageQuery(event.target.value)} />
          <div className="package-scroll">{filteredPackages.map((installed) => {
            const isSelected = installed.document.package.id === selected?.document.package.id;
            const destinations = new Set(installed.routes.map((route) => route.nativeEntry?.label ?? "其他资源"));
            return <button key={installed.document.package.id} className={`package-row ${isSelected ? "selected" : ""}`} onClick={() => setSelectedId(installed.document.package.id)}>
              <div><span className="package-icon">▣</span><strong>{installed.document.package.name}</strong><small>{installed.document.package.version}</small></div>
              <p><span>{installed.document.resources.length} 个资源</span><span>{destinations.size} 种类型</span><span className="offline">离线</span></p>
            </button>;
          })}</div>
        </aside>
        <section className="package-detail">{selected ? <>
          <header className="detail-heading"><div><h2>{selected.document.package.name}</h2><p>版本 {selected.document.package.version} · 已安装 · {selected.document.license.label}</p></div><button aria-label="资源包操作">•••</button></header>
          <div className="detail-summary"><div><b>{selected.document.resources.length}</b><span>个资源</span></div><div><b>{selected.document.assets.length}</b><span>张图片</span></div><div><b>{resourceTypes.length}</b><span>种资源类型</span></div><div className="available"><b>可用</b><span>离线状态</span></div></div>
          <nav className="type-filters" aria-label="资源类型"><button className={selectedType === "全部" ? "active" : ""} onClick={() => setSelectedType("全部")}>全部 <b>{selected.document.resources.length}</b></button>{resourceTypes.map(([label, count]) => <button key={label} className={selectedType === label ? "active" : ""} onClick={() => setSelectedType(label)}>{label} <b>{count}</b></button>)}</nav>
          <div className="resource-search"><input aria-label="搜索资源" placeholder="搜索名称" value={resourceQuery} onChange={(event) => setResourceQuery(event.target.value)} /><span>{resources.length} / {selected.document.resources.length}</span></div>
          <div className="resource-table"><div className="resource-table-head"><span /><b>名称</b><b>类型</b><b>使用位置</b></div>{resources.map((resource) => {
            const label = routeLabel(selected, resource.id);
            return <button className="resource-row" key={resource.id} onDoubleClick={() => onOpenResource(selected, resource.id)}><span className="template-icon">{typeIcons[resource.template.id] ?? "◆"}</span><strong>{resourceName(resource)}</strong><span>{label}</span><span>{label}</span></button>;
          })}</div>
          <footer className="detail-actions"><button>移除</button><button className="primary" disabled={!resources[0]} onClick={() => resources[0] && onOpenResource(selected, resources[0].id)}>浏览资源</button></footer>
        </> : <div className="empty-library"><h2>没有已安装的资源包</h2><button className="primary" onClick={() => inputRef.current?.click()}>安装资源包</button></div>}</section>
      </div>
    </section>
    <input ref={inputRef} hidden type="file" accept=".pbres" onChange={importPackage} />
    {dialog && <DialogSurface dialog={dialog} onCancel={() => setDialog(null)} onCommit={commit} onOpen={(installed) => { setSelectedId(installed.document.package.id); setDialog(null); }} />}
  </div>;
}
