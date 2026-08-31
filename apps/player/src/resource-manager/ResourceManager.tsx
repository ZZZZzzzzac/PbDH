import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";

import {
  type ResourcePackageCandidate,
  type ContractDiagnostic,
  type SystemPackageDocument,
  writePbres,
} from "@pbdh/contract-runtime";
import {
  resourceConversionRegistry,
  type ConversionDiagnostic,
  type ResourceContainer,
  type ResourceFormatId,
} from "@pbdh/resource-conversion";
import { CanonicalCardSurface, CardPreviewDialog } from "@pbdh/resource-renderer/react";
import { canonicalCardDesignSize, type ManagedAsset, type SurfaceResource } from "@pbdh/resource-renderer/core";
import { trustedRendererFor } from "@pbdh/templates/frontend";
import { OperationStatus } from "@pbdh/platform-ui";

import {
  type InstalledResourcePackage,
  type ResourceLibrary,
  type ResourcePackageInstallPlan,
  planResourcePackageInstall,
} from "../resources/resource-library.ts";
import type { ResourcePackageSource } from "../resources/resource-package-repository.ts";
import type { PlayerMarketHandoff } from "../resources/market-handoff.ts";
import { prepareResourcePackageInstall } from "../resources/prepare-resource-package-install.ts";
import { materializePlayerResourceConversion } from "../resources/materialize-resource-conversion.ts";
import { playerResourceManagerDesign } from "./design.generated.ts";

export type ResourcePackageIngress =
  | {
      id: string;
      source: "market";
      bytes: Uint8Array;
      expectedMarketHandoff: PlayerMarketHandoff;
    }
  | {
      id: string;
      source: "market";
      diagnostics: ContractDiagnostic[];
    };

type ResourceManagerProps = {
  currentSystem: SystemPackageDocument;
  library: ResourceLibrary;
  onCommitInstall: (
    plan: Exclude<ResourcePackageInstallPlan, { kind: "no-op" }>,
    source: ResourcePackageSource,
  ) => Promise<void>;
  onRemovePackage: (packageId: string) => Promise<void>;
  embeddedPackageIndex: ReadonlyMap<string, { version: string; snapshotDigest: string }>;
  loadEmbeddedPackage: (packageId: string) => Promise<ResourcePackageCandidate | null>;
  incomingPackage?: ResourcePackageIngress;
  onIncomingPackageHandled?: (id: string) => void;
  onClose: () => void;
};

type Dialog =
  | { kind: "install"; plan: Extract<ResourcePackageInstallPlan, { kind: "insert" }>; source: ResourcePackageSource }
  | { kind: "update"; plan: Extract<ResourcePackageInstallPlan, { kind: "update" }>; source: ResourcePackageSource }
  | { kind: "no-op"; installed: InstalledResourcePackage }
  | { kind: "remove"; installed: InstalledResourcePackage }
  | { kind: "invalid"; diagnostics: ContractDiagnostic[] }
  | null;

type ResourcePreview = {
  installed: InstalledResourcePackage;
  resourceId: string;
};

type ConversionReview = {
  formatId: ResourceFormatId;
  sourceFileName: string;
  candidate: ResourcePackageCandidate | null;
  plan: ResourcePackageInstallPlan | null;
  converted: number;
  failed: number;
  diagnostics: ConversionDiagnostic[];
};

const thirdPartyFormats: Array<{ id: Exclude<ResourceFormatId, "pbres">; label: string }> = [
  { id: "zzz", label: "导入ZZZ格式" },
  { id: "rinkcx", label: "导入Rink格式" },
  { id: "dhsheet", label: "导入dhsheet格式" },
  { id: "kid", label: "导入不咕鸟格式" },
];

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

export function supportsPlayerResourcePreview(
  resource: InstalledResourcePackage["document"]["resources"][number],
): boolean {
  return trustedRendererFor(resource.template.id, resource.template.version) !== undefined;
}

function countsByDestination(plan: Exclude<ResourcePackageInstallPlan, { kind: "no-op" }>) {
  const counts = new Map<string, number>();
  for (const route of plan.routes) {
    const label = route.nativeEntry?.label ?? "其他资源";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts];
}

function useResourceAssets(
  installed: InstalledResourcePackage,
  resource: InstalledResourcePackage["document"]["resources"][number],
): ReadonlyMap<string, ManagedAsset> {
  const [assets, setAssets] = useState<ReadonlyMap<string, ManagedAsset>>(() => new Map());
  useEffect(() => {
    const urls: string[] = [];
    const next = new Map<string, ManagedAsset>();
    for (const assetId of Object.values(resource.media)) {
      const bytes = installed.media.get(assetId);
      if (!bytes) {
        next.set(assetId, { status: "error", reason: "missing installed media" });
        continue;
      }
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const url = URL.createObjectURL(new Blob([buffer], { type: "image/webp" }));
      urls.push(url);
      next.set(assetId, { status: "ready", url });
    }
    setAssets(next);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [installed, resource]);
  return assets;
}

export function PlayerResourcePreviewDialog({
  installed,
  resourceId,
  onClose,
}: ResourcePreview & { onClose: () => void }) {
  const resource = installed.document.resources.find((candidate) => candidate.id === resourceId);
  if (!resource) return null;
  return <PlayerResourcePreviewContent installed={installed} resource={resource} onClose={onClose} />;
}

function PlayerResourcePreviewContent({
  installed,
  resource,
  onClose,
}: {
  installed: InstalledResourcePackage;
  resource: InstalledResourcePackage["document"]["resources"][number];
  onClose: () => void;
}) {
  const assets = useResourceAssets(installed, resource);
  const name = resourceName(resource);
  const renderer = trustedRendererFor(resource.template.id, resource.template.version);
  return <CardPreviewDialog
    designWidth={canonicalCardDesignSize.width}
    designHeight={canonicalCardDesignSize.height}
    fixedRatio={resource.presentation.fixedRatio}
    label={`${name}资源详情`}
    onClose={onClose}
  >
    {renderer ? <CanonicalCardSurface
      resource={resource as unknown as SurfaceResource<Record<string, unknown>>}
      expectedRendererRevision={renderer.revision}
      renderer={renderer}
      assets={assets}
      label={`${name}玩家规范卡面`}
    /> : <p>当前 Player 版本尚不能呈现此模板的规范卡面。</p>}
  </CardPreviewDialog>;
}

function DialogSurface({
  dialog,
  onCancel,
  onCommit,
  onOpen,
  onRemove,
  currentSystem,
  busyLabel,
}: {
  dialog: Exclude<Dialog, null>;
  onCancel: () => void;
  onCommit: (plan: Exclude<ResourcePackageInstallPlan, { kind: "no-op" }>, source: ResourcePackageSource) => void | Promise<void>;
  onOpen: (installed: InstalledResourcePackage) => void;
  onRemove: (installed: InstalledResourcePackage) => void | Promise<void>;
  currentSystem: SystemPackageDocument;
  busyLabel?: string;
}) {
  const [technicalDetails, setTechnicalDetails] = useState(false);
  const busy = Boolean(busyLabel);
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
      <footer><button onClick={onCancel}>关闭</button><button className="primary" onClick={() => onOpen(dialog.installed)}>查看资源包</button></footer>
    </section>
  </div>;

  if (dialog.kind === "remove") return <div className="player-dialog-backdrop">
    <section className="player-dialog compact" role="alertdialog" aria-modal="true" aria-label="确认移除资源包">
      <header><h2>移除资源包</h2><button aria-label="关闭" disabled={busy} onClick={onCancel}>×</button></header>
      <div className="dialog-content">
        <div className="diagnostic info"><strong>{dialog.installed.document.package.name}</strong><span>将从本机移除 {dialog.installed.document.resources.length} 个资源和 {dialog.installed.document.assets.length} 张图片。</span></div>
        <p>以后不能再从这个包选择新资源。人物卡里已经写入的字段和卡牌桌面里的独立卡牌不会改变。</p>
      </div>
      <footer><button disabled={busy} onClick={onCancel}>取消</button><button className="danger" disabled={busy} onClick={() => onRemove(dialog.installed)}>{busyLabel ? <OperationStatus label={busyLabel} /> : "确认移除"}</button></footer>
    </section>
  </div>;

  const { plan } = dialog;
  const document = plan.candidate.document;
  const routeCounts = countsByDestination(plan);
  return <div className="player-dialog-backdrop">
    <section className="player-dialog" role="dialog" aria-modal="true">
      <header><h2>{dialog.kind === "update" ? "更新资源包" : "安装资源包"}</h2><button aria-label="关闭" disabled={busy} onClick={onCancel}>×</button></header>
      <div className="dialog-content">
        <div className="package-heading"><span className="package-symbol">▣</span><div><h3>{document.package.name}</h3><small>版本 {document.package.version} · {dialog.source === "market" ? "Market 取得" : dialog.source === "bundled" ? "系统包内置" : "本地文件"}</small></div></div>
        {plan.kind === "update" && <div className="version-change"><span>{plan.existing.document.package.version}</span><b>→</b><span>{document.package.version}</span></div>}
        <div className="summary-grid"><div><b>{document.resources.length}</b><span>个资源</span></div><div><b>{document.assets.length}</b><span>张图片</span></div><div><b>{routeCounts.length}</b><span>种使用位置</span></div></div>
        <div className="diagnostic success"><strong>可用于当前系统</strong><span>{routeCounts.map(([label, count]) => `${label} ${count}`).join(" · ")}</span></div>
        <div className="license-row"><span>当前系统</span><b>{currentSystem.package.name} v{currentSystem.package.version}</b></div>
        <div className="license-row"><span>资源包目标</span><b>{resourceTargetLabel(document)}</b></div>
        <div className="license-row"><span>快照</span><b>{document.snapshotDigest}</b></div>
        <div className="license-row"><span>文件检查</span><b>结构与图片完整</b></div>
        <div className="type-summary"><strong>资源类型</strong><div>{routeCounts.map(([label, count]) => <span key={label}><b>{label}</b>{count}</span>)}</div></div>
        <div className="license-row"><span>许可</span><b>{document.license.label}</b></div>
      </div>
      <footer><button disabled={busy} onClick={onCancel}>取消</button><button className="primary" disabled={busy} onClick={() => onCommit(plan, dialog.source)}>{busyLabel ? <OperationStatus label={busyLabel} /> : dialog.source === "bundled" ? "恢复内置版本" : dialog.kind === "update" ? "更新" : "安装"}</button></footer>
    </section>
  </div>;
}

export function ResourceManager({ currentSystem, library, onCommitInstall, onRemovePackage, embeddedPackageIndex, loadEmbeddedPackage, incomingPackage, onIncomingPackageHandled, onClose }: ResourceManagerProps) {
  const packages = [...library.values()];
  const [selectedId, setSelectedId] = useState(packages[0]?.document.package.id ?? "");
  const [packageQuery, setPackageQuery] = useState("");
  const [resourceQuery, setResourceQuery] = useState("");
  const [selectedType, setSelectedType] = useState("全部");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [preview, setPreview] = useState<ResourcePreview>();
  const [removingPackageId, setRemovingPackageId] = useState<string>();
  const [operation, setOperation] = useState<"checking" | "converting" | "installing" | "removing" | "restoring" | null>(null);
  const [conversionReview, setConversionReview] = useState<ConversionReview>();
  const inputRef = useRef<HTMLInputElement>(null);
  const conversionInputRef = useRef<HTMLInputElement>(null);
  const conversionFormatRef = useRef<Exclude<ResourceFormatId, "pbres">>("zzz");
  const handledIngressIds = useRef(new Set<string>());
  const selected = library.get(selectedId) ?? packages[0];
  const filteredPackages = packages.filter((installed) =>
    installed.document.package.name.toLocaleLowerCase().includes(packageQuery.toLocaleLowerCase()));
  const nativePackages = filteredPackages.filter((installed) =>
    embeddedPackageIndex.has(installed.document.package.id));
  const additionalPackages = filteredPackages.filter((installed) =>
    !embeddedPackageIndex.has(installed.document.package.id));

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

  async function preparePackage(bytes: Uint8Array, source: "file" | "market", expectedMarketHandoff?: PlayerMarketHandoff) {
    const result = await prepareResourcePackageInstall({ bytes, currentSystem, library, expectedMarketHandoff });
    if (result.kind === "invalid") return setDialog({ kind: "invalid", diagnostics: result.diagnostics });
    if (result.plan.kind === "no-op") return setDialog({ kind: "no-op", installed: result.plan.existing });
    setDialog(result.plan.kind === "insert"
      ? { kind: "install", plan: result.plan, source }
      : { kind: "update", plan: result.plan, source });
  }

  useEffect(() => {
    if (!incomingPackage || handledIngressIds.current.has(incomingPackage.id)) return;
    handledIngressIds.current.add(incomingPackage.id);
    onIncomingPackageHandled?.(incomingPackage.id);
    if ("diagnostics" in incomingPackage) {
      setDialog({ kind: "invalid", diagnostics: incomingPackage.diagnostics });
      return;
    }
    setOperation("checking");
    void preparePackage(incomingPackage.bytes, incomingPackage.source, incomingPackage.expectedMarketHandoff)
      .finally(() => setOperation(null));
  }, [incomingPackage]);

  async function importPackage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || operation) return;
    setOperation("checking");
    try {
      await preparePackage(new Uint8Array(await file.arrayBuffer()), "file");
    } finally {
      setOperation(null);
    }
  }

  function selectConversionFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void convertThirdPartyFile(conversionFormatRef.current, file);
  }

  async function convertThirdPartyFile(formatId: Exclude<ResourceFormatId, "pbres">, file: File) {
    if (operation) return;
    setOperation("converting");
    try {
      const imported = await resourceConversionRegistry.import(formatId, {
        bytes: new Uint8Array(await file.arrayBuffer()),
        fileName: file.name,
        container: resourceContainer(file.name),
      });
      if (!imported.ok) {
        setConversionReview({
          formatId,
          sourceFileName: file.name,
          candidate: null,
          plan: null,
          converted: imported.report.converted,
          failed: imported.report.failed,
          diagnostics: imported.report.diagnostics,
        });
        return;
      }
      const materialized = await materializePlayerResourceConversion(imported.batch, currentSystem);
      const candidate = materialized.candidate;
      setConversionReview({
        formatId,
        sourceFileName: file.name,
        candidate,
        plan: candidate ? planResourcePackageInstall({ currentSystem, library, candidate }) : null,
        converted: materialized.converted,
        failed: imported.report.failed + materialized.skipped,
        diagnostics: [...imported.report.diagnostics, ...materialized.diagnostics],
      });
    } catch (error) {
      setConversionReview({
        formatId,
        sourceFileName: file.name,
        candidate: null,
        plan: null,
        converted: 0,
        failed: 1,
        diagnostics: [{
          code: "player.resource-conversion.failed",
          severity: "error",
          message: error instanceof Error ? error.message : "第三方资源转换失败。",
        }],
      });
    } finally {
      setOperation(null);
    }
  }

  function exportConvertedPackage(review: ConversionReview) {
    if (!review.candidate) return;
    downloadBytes(
      writePbres(review.candidate.document, review.candidate.media),
      `${safeFileName(review.candidate.document.package.name)}.pbres`,
    );
  }

  async function installConvertedPackage(review: ConversionReview) {
    if (!review.plan || review.plan.kind === "no-op") return;
    await commit(review.plan, "file");
    setConversionReview(undefined);
  }

  async function commit(plan: Exclude<ResourcePackageInstallPlan, { kind: "no-op" }>, source: ResourcePackageSource) {
    if (operation) return;
    setOperation("installing");
    try {
      await onCommitInstall(plan, source);
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
    } finally {
      setOperation(null);
    }
  }

  async function removeSelectedPackage(installed: InstalledResourcePackage) {
    if (operation || removingPackageId || embeddedPackageIndex.has(installed.document.package.id)) return;
    const packageId = installed.document.package.id;
    setRemovingPackageId(packageId);
    setOperation("removing");
    try {
      await onRemovePackage(packageId);
      setDialog(null);
      setSelectedId(packages.find((candidate) => candidate.document.package.id !== packageId)?.document.package.id ?? "");
    } catch (error) {
      console.error("无法移除资源包", error);
    } finally {
      setRemovingPackageId(undefined);
      setOperation(null);
    }
  }

  async function restoreSelectedEmbeddedPackage(installed = selected) {
    if (!installed || operation || removingPackageId || !embeddedPackageIndex.has(installed.document.package.id)) return;
    setRemovingPackageId(installed.document.package.id);
    setOperation("restoring");
    try {
      const candidate = await loadEmbeddedPackage(installed.document.package.id);
      if (!candidate) throw new Error("找不到系统包内置资源。");
      const plan = planResourcePackageInstall({ currentSystem, library, candidate });
      if (plan.kind === "no-op") return;
      if (plan.kind === "insert") setDialog({ kind: "install", plan, source: "bundled" });
      else setDialog({ kind: "update", plan, source: "bundled" });
    } catch {
      setDialog({
        kind: "invalid",
        diagnostics: [{
          code: "player.resource-package.embedded-restore-failed",
          severity: "error",
          family: "player",
          version: "1",
          location: "",
          params: {},
        }],
      });
    } finally {
      setRemovingPackageId(undefined);
      setOperation(null);
    }
  }

  function openResource(installed: InstalledResourcePackage, resourceId?: string) {
    const target = installed.document.resources.find((resource) => resource.id === resourceId)
      ?? installed.document.resources[0];
    if (target) setPreview({ installed, resourceId: target.id });
  }

  function renderPackageRow(installed: InstalledResourcePackage) {
    const isSelected = installed.document.package.id === selected?.document.package.id;
    const destinations = new Set(installed.routes.map((route) => route.nativeEntry?.label ?? "其他资源"));
    const action = embeddedResourcePackageAction(installed, embeddedPackageIndex);
    return <div key={installed.document.package.id} className={`package-row ${isSelected ? "selected" : ""}`}>
      <button className="package-row-select" type="button" onClick={() => setSelectedId(installed.document.package.id)}>
        <div><span className="package-icon">▣</span><strong>{installed.document.package.name}</strong><small>{installed.document.package.version}</small></div>
        <p><span>{installed.document.resources.length} 个资源</span><span>{destinations.size} 种类型</span></p>
      </button>
      {action === "restore" ? (
        <button className="package-row-remove" type="button" aria-label={`恢复 ${installed.document.package.name}`} disabled={Boolean(operation)} onClick={() => { setSelectedId(installed.document.package.id); void restoreSelectedEmbeddedPackage(installed); }}>{operation === "restoring" && removingPackageId === installed.document.package.id ? <OperationStatus label="" /> : "↻"}</button>
      ) : action === "remove" ? (
        <button className="package-row-remove" type="button" aria-label={`移除 ${installed.document.package.name}`} disabled={Boolean(operation)} onClick={() => setDialog({ kind: "remove", installed })}>×</button>
      ) : null}
    </div>;
  }

  return <div className="resource-manager-layer" style={style} data-design-source={playerResourceManagerDesign.document}>
    <section className="player-package-manager" role="dialog" aria-modal="true" aria-label="资源管理器">
      <header className="manager-bar"><h1>资源管理器</h1><span>{operation === "checking" ? <OperationStatus label="正在检查资源包…" /> : operation === "converting" ? <OperationStatus label="正在转换资源…" /> : currentSystem.package.name}</span><div className="manager-import-actions">{thirdPartyFormats.map((format) => <button key={format.id} type="button" disabled={Boolean(operation)} onClick={() => { conversionFormatRef.current = format.id; conversionInputRef.current?.click(); }}>{format.label}</button>)}<button className="install" disabled={Boolean(operation)} onClick={() => inputRef.current?.click()}>导入pbres格式</button></div><button className="close" aria-label="关闭资源管理器" disabled={Boolean(operation)} onClick={onClose}>×</button></header>
      <div className="manager-body">
        <aside className="package-list"><div className="list-title"><h2>已安装资源包</h2><span>{packages.length}</span></div>
          <input aria-label="搜索资源包" placeholder="搜索资源包" value={packageQuery} onChange={(event) => setPackageQuery(event.target.value)} />
          <div className="package-scroll">
            {nativePackages.length ? <><h3 className="package-group-title">原生资源包</h3>{nativePackages.map(renderPackageRow)}</> : null}
            {additionalPackages.length ? <><h3 className="package-group-title">额外资源包</h3>{additionalPackages.map(renderPackageRow)}</> : null}
          </div>
        </aside>
        <section className="package-detail">{selected ? <>
          <header className="package-detail-heading"><div><h2>{selected.document.package.name}</h2><p>版本 {selected.document.package.version} · 已安装 · {selected.document.license.label}</p></div></header>
          <div className="detail-summary"><div><b>{selected.document.resources.length}</b><span>个资源</span></div><div><b>{selected.document.assets.length}</b><span>张图片</span></div><div><b>{resourceTypes.length}</b><span>种资源类型</span></div></div>
          <nav className="type-filters" aria-label="资源类型"><button className={selectedType === "全部" ? "active" : ""} onClick={() => setSelectedType("全部")}>全部 <b>{selected.document.resources.length}</b></button>{resourceTypes.map(([label, count]) => <button key={label} className={selectedType === label ? "active" : ""} onClick={() => setSelectedType(label)}>{label} <b>{count}</b></button>)}</nav>
          <div className="resource-search"><input aria-label="搜索资源" placeholder="搜索名称" value={resourceQuery} onChange={(event) => setResourceQuery(event.target.value)} /><span>{resources.length} / {selected.document.resources.length}</span></div>
          <div className="manager-resource-table"><div className="resource-table-head"><span /><b>名称</b><b>类型</b><b>使用位置</b></div>{resources.map((resource) => {
            const label = routeLabel(selected, resource.id);
            return <button className="manager-resource-row" key={resource.id} onClick={() => openResource(selected, resource.id)}><span className="template-icon">{typeIcons[resource.template.id] ?? "◆"}</span><strong>{resourceName(resource)}</strong><span>{label}</span><span>{label}</span></button>;
          })}</div>
        </> : <div className="empty-library"><h2>没有已安装的资源包</h2><button className="primary" onClick={() => inputRef.current?.click()}>导入pbres格式</button></div>}</section>
      </div>
    </section>
    <input ref={inputRef} hidden type="file" accept=".pbres" onChange={importPackage} />
    <input ref={conversionInputRef} hidden type="file" accept=".json,.dhcb,.png,application/json,image/png" onChange={selectConversionFile} />
    {dialog && <DialogSurface dialog={dialog} currentSystem={currentSystem} busyLabel={operation === "installing" ? "正在写入资源库…" : operation === "removing" ? "正在移除资源包…" : undefined} onCancel={() => setDialog(null)} onCommit={commit} onRemove={removeSelectedPackage} onOpen={(installed) => { setSelectedId(installed.document.package.id); setDialog(null); }} />}
    {conversionReview ? <div className="player-dialog-backdrop">
      <section className="player-dialog" role="alertdialog" aria-modal="true" aria-label="第三方资源转换报告">
        <header><h2>转换报告</h2><button aria-label="关闭" disabled={Boolean(operation)} onClick={() => setConversionReview(undefined)}>×</button></header>
        <div className="dialog-content">
          <div className={`diagnostic ${conversionReview.candidate ? "success" : "error"}`}><strong>{conversionReview.sourceFileName}</strong><span>格式 {conversionReview.formatId} · 转换 {conversionReview.converted} · 跳过或失败 {conversionReview.failed}</span></div>
          {conversionReview.diagnostics.length ? <ul className="technical-details">{conversionReview.diagnostics.map((item, index) => <li key={`${item.code}:${item.resourceId ?? index}`}><code>{item.code}</code><span>{item.message}</span></li>)}</ul> : <p>没有发现字段损失。</p>}
        </div>
        <footer><button disabled={Boolean(operation)} onClick={() => setConversionReview(undefined)}>取消</button>{conversionReview.candidate ? <><button disabled={Boolean(operation)} onClick={() => exportConvertedPackage(conversionReview)}>导出 .pbres 备份</button><button className="primary" disabled={Boolean(operation)} onClick={() => void installConvertedPackage(conversionReview)}>{operation === "installing" ? <OperationStatus label="正在写入资源库…" /> : "确认并安装"}</button></> : null}</footer>
      </section>
    </div> : null}
    {preview && <PlayerResourcePreviewDialog {...preview} onClose={() => setPreview(undefined)} />}
  </div>;
}

function resourceTargetLabel(document: ResourcePackageCandidate["document"]): string {
  return document.targets.length === 0
    ? "未声明目标（按兼容性分流）"
    : document.targets.map((target) => `${target.systemPackageId} ${target.version}`).join("、");
}

function resourceContainer(fileName: string): ResourceContainer {
  const extension = fileName.split(".").at(-1)?.toLocaleLowerCase();
  if (extension === "dhcb") return "dhcb";
  if (extension === "png") return "png";
  return "json";
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/gu, "-").trim() || "resources";
}

function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function embeddedResourcePackageAction(
  installed: InstalledResourcePackage,
  index: ReadonlyMap<string, { version: string; snapshotDigest: string }>,
): "locked" | "restore" | "remove" {
  const embedded = index.get(installed.document.package.id);
  if (!embedded) return "remove";
  return installed.document.package.version === embedded.version
    && installed.document.snapshotDigest === embedded.snapshotDigest
    ? "locked"
    : "restore";
}
