import { useEffect, useRef, useState } from "react";
import type {
  ContractDiagnostic,
  ResourcePackageCandidate,
  ResourcePackageLogicalDocument,
  TabletopDocumentCandidate,
} from "@pbdh/contract-runtime";
import type { LocalDocumentKind, LocalDocumentSync } from "@pbdh/local-storage";
import { OperationStatus, formatStorageBytes } from "@pbdh/platform-ui";
import { ResourcePackageInfoDialog, TemplateUpgradeDialog, type ResourcePackageEditorValue, type SystemPackageOption, type TemplateUpgradeDialogSelection } from "@pbdh/publication-ui";
import type { ConversionDiagnostic, ResourceFormatId } from "@pbdh/resource-conversion";
import type { TemplateCoreCapability } from "@pbdh/templates/core";
import { currentTemplateReferences, listTemplateUpgradeRows, loadTemplateCore } from "@pbdh/templates/core/lazy";

import { Field } from "./creator-controls.tsx";
import { isSemanticVersion } from "./creator-file-actions.ts";
import { publicationLicenses, type PublicationCoverDraft } from "./creator-publication.ts";
import type { WorkspaceResourceSelection } from "./gm-tabletop-session.ts";
import type { CreatorMarketHandoff } from "./market-handoff.ts";
import {
  collapseCreatorDiagnostics,
  creatorDiagnosticMessage,
} from "./publication-feedback.ts";
import { TemplateIcon } from "./TemplateIcon.tsx";
import type { CreatorWorkspace, WorkspaceNodeRef } from "./workspace-model.ts";

export type CloudDocumentKind = Extract<LocalDocumentKind, "creator-workspace" | "gm-tabletop-document">;
export type CreatorOperation = "cloud-sync" | "cloud-conflict" | "trash-workspace" | "trash-tabletop" | "duplicate-tabletop" | "read-tabletop" | "import-tabletop" | "export-tabletop" | "read-package" | "convert-package" | "export-package" | "publication-cover" | "upgrade-templates";

export type CreatorConversionReview = {
  formatId: Exclude<ResourceFormatId, "pbres">;
  sourceFileName: string;
  candidate: ResourcePackageCandidate | null;
  converted: number;
  failed: number;
  diagnostics: ConversionDiagnostic[];
};

export type CreatorDialogState =
  | { kind: "new" }
  | { kind: "package-metadata"; workspaceKey: string }
  | { kind: "template-upgrade"; workspaceKey: string }
  | { kind: "new-resource"; workspaceKey: string }
  | { kind: "publish" }
  | { kind: "diagnostics"; title: string; diagnostics: ContractDiagnostic[] }
  | { kind: "conversion"; review: CreatorConversionReview }
  | { kind: "no-op"; name: string }
  | { kind: "update"; incoming: ResourcePackageCandidate; handoff?: CreatorMarketHandoff }
  | { kind: "conflict"; incoming: ResourcePackageCandidate; handoff?: CreatorMarketHandoff }
  | { kind: "delete-workspace-node"; workspaceKey: string; node: WorkspaceNodeRef; name: string }
  | { kind: "delete-selected-resources"; selections: WorkspaceResourceSelection[] }
  | { kind: "copy-resource-to-package"; sourceWorkspaceKey: string; resourceId: string; name: string }
  | { kind: "close-workspace"; workspaceKey: string; name: string }
  | { kind: "new-tabletop" }
  | { kind: "rename-tabletop"; tabletopId: string }
  | { kind: "delete-tabletop"; tabletopId: string; name: string }
  | { kind: "tabletop-import-conflict"; incoming: TabletopDocumentCandidate }
  | { kind: "sync-document"; documentKind: CloudDocumentKind; documentId: string; name: string }
  | { kind: "cloud-conflict"; documentKind: CloudDocumentKind; documentId: string; name: string }
  | null;

export type CreatorDialogCommand =
  | { type: "close" | "create-workspace" | "choose-publication-cover" | "publish" | "create-tabletop" }
  | { type: "set-new-name" | "set-copy-package-name" | "set-tabletop-name"; value: string }
  | { type: "set-package-info"; value: ResourcePackageEditorValue }
  | { type: "create-resource"; template: TemplateCoreCapability<any>; workspaceKey: string }
  | { type: "save-package" | "close-workspace"; workspaceKey: string }
  | { type: "upgrade-templates"; workspaceKey: string; selections: readonly TemplateUpgradeDialogSelection[] }
  | { type: "export-conversion" | "accept-conversion"; review: CreatorConversionReview }
  | { type: "commit-incoming" | "save-aside"; incoming: ResourcePackageCandidate; handoff?: CreatorMarketHandoff }
  | { type: "delete-workspace-node"; workspaceKey: string; node: WorkspaceNodeRef }
  | { type: "delete-selected-resources"; selections: WorkspaceResourceSelection[] }
  | { type: "copy-resource"; sourceWorkspaceKey: string; resourceId: string; targetWorkspaceKey: string }
  | { type: "copy-resource-to-new-package"; sourceWorkspaceKey: string; resourceId: string }
  | { type: "rename-tabletop" | "delete-tabletop"; tabletopId: string }
  | { type: "commit-tabletop-import"; incoming: TabletopDocumentCandidate; resolution: "copy" | "replace" }
  | { type: "confirm-cloud-sync"; documentKind: CloudDocumentKind; documentId: string }
  | { type: "resolve-cloud-conflict"; documentKind: CloudDocumentKind; documentId: string; resolution: "cloud" | "aside" | "local" };

function NewResourceChoices({ workspaceKey, execute }: { workspaceKey: string; execute(command: CreatorDialogCommand): void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const executeRef = useRef(execute);
  executeRef.current = execute;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function choose(reference: { id: string; version: string }) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const template = await loadTemplateCore(reference.id, reference.version);
      if (!template) throw new Error(`模板版本不可用：${reference.id}@${reference.version}`);
      if (mounted.current) executeRef.current({ type: "create-resource", template, workspaceKey });
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : "模板加载失败，请重试。");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return <>
    <div className="resource-type-choices">{currentTemplateReferences.map((reference) =>
      <button type="button" key={`${reference.id}@${reference.version}`} disabled={busy} onClick={() => void choose(reference)}>
        <TemplateIcon templateId={reference.id} />{reference.id}
      </button>)}</div>
    {busy && <div role="status">模板加载中…</div>}
    {error && <div role="alert">{error}</div>}
  </>;
}

export function CreatorDialogs({
  dialog,
  snapshot,
  execute,
}: {
  dialog: CreatorDialogState;
  snapshot: {
    systemPackageOptions: readonly SystemPackageOption[];
    packageInfo: ResourcePackageEditorValue;
    publicationCover: PublicationCoverDraft;
    publicationBusy: boolean;
    creatorOperation: CreatorOperation | null;
    newName: string;
    copyPackageName: string;
    tabletopName: string;
    workspaces: readonly CreatorWorkspace[];
    tabletopSync: ReadonlyMap<string, LocalDocumentSync>;
  };
  execute(command: CreatorDialogCommand): void;
}) {
  if (!dialog) return null;

  if (dialog.kind === "template-upgrade") {
    const workspace = snapshot.workspaces.find((item) => item.key === dialog.workspaceKey);
    if (!workspace) return null;
    return <TemplateUpgradeDialog
      rows={listTemplateUpgradeRows(workspace.document.resources)}
      packageVersion={workspace.document.package.version}
      busy={snapshot.creatorOperation === "upgrade-templates"}
      onClose={() => execute({ type: "close" })}
      onSubmit={(selections) => execute({ type: "upgrade-templates", workspaceKey: workspace.key, selections })}
    />;
  }

  if (dialog.kind === "publish" || dialog.kind === "package-metadata") {
    const publishing = dialog.kind === "publish";
    return <ResourcePackageInfoDialog
      storageDescription={dialog.kind === "package-metadata" ? `包内图片：${formatStorageBytes(snapshot.workspaces.find((item) => item.key === dialog.workspaceKey)?.document.assets.reduce((sum, asset) => sum + Number(asset.byteLength), 0) ?? 0)}；云空间占用请在账号中查看。` : undefined}
      heading={publishing ? "发布到资源市场" : "编辑资源包信息"}
      submitLabel={publishing ? "发布当前版本" : "保存资源包信息"}
      coverUrl={snapshot.publicationCover.url}
      systemPackageOptions={snapshot.systemPackageOptions}
      value={snapshot.packageInfo}
      licenseOptions={Object.entries(publicationLicenses).map(([id, license]) => ({ id, label: license.label }))}
      busy={snapshot.publicationBusy || snapshot.creatorOperation === "publication-cover"}
      submitDisabled={!snapshot.packageInfo.package.name.trim()
        || !isSemanticVersion(snapshot.packageInfo.package.version)
        || !snapshot.packageInfo.publication?.licenseId.trim()
        || (publishing && !snapshot.publicationCover.assetId)}
      busyLabel={snapshot.creatorOperation === "publication-cover"
        ? "正在处理封面…"
        : publishing ? "正在发布整包…" : "正在保存资源包信息…"}
      onChange={(value) => execute({ type: "set-package-info", value })}
      onChooseCover={() => execute({ type: "choose-publication-cover" })}
      onClose={() => execute({ type: "close" })}
      onSubmit={() => execute(publishing
        ? { type: "publish" }
        : { type: "save-package", workspaceKey: dialog.workspaceKey })}
    />;
  }

  return <div className="dialog-backdrop" role="presentation"><section className={`dialog dialog-${dialog.kind}`} role="dialog" aria-modal="true">
    {dialog.kind === "new" && <><h2>新建资源包</h2><Field className="dialog-field" label="名称" value={snapshot.newName} onChange={(value) => execute({ type: "set-new-name", value })} />
      <div className="dialog-actions"><button type="button" onClick={() => execute({ type: "close" })}>取消</button><button type="button" className="primary" onClick={() => execute({ type: "create-workspace" })}>创建</button></div></>}
    {dialog.kind === "new-resource" && <><h2>新建资源</h2><NewResourceChoices key={dialog.workspaceKey} workspaceKey={dialog.workspaceKey} execute={execute} />
      <div className="dialog-actions"><button type="button" onClick={() => execute({ type: "close" })}>取消</button></div></>}
    {dialog.kind === "diagnostics" && <><h2>{dialog.title}</h2><ul className="diagnostics">{collapseCreatorDiagnostics(dialog.diagnostics).map((item) => <li key={`${item.code}:${item.location}`}><b>{creatorDiagnosticMessage(item.code, typeof item.params.message === "string" ? item.params.message : undefined)}{typeof item.params.count === "number" && item.params.count > 1 ? `（共 ${item.params.count} 处）` : ""}</b></li>)}</ul>
      <div className="dialog-actions"><button type="button" className="primary" onClick={() => execute({ type: "close" })}>保留现状</button></div></>}
    {dialog.kind === "conversion" && <><h2>转换报告</h2><p><strong>{dialog.review.sourceFileName}</strong></p><p>格式 {dialog.review.formatId} · 转换 {dialog.review.converted} · 跳过或失败 {dialog.review.failed}</p>
      {dialog.review.diagnostics.length > 0 ? <ul className="diagnostics">{dialog.review.diagnostics.map((item, index) => <li key={`${item.code}:${item.resourceId ?? index}`}><b>{item.message}</b><small>{item.code}</small></li>)}</ul> : <p>没有发现字段损失。</p>}
      <div className="dialog-actions"><button type="button" onClick={() => execute({ type: "close" })}>取消</button>{dialog.review.candidate && <><button type="button" onClick={() => execute({ type: "export-conversion", review: dialog.review })}>导出 .pbres 备份</button><button type="button" className="primary" onClick={() => execute({ type: "accept-conversion", review: dialog.review })}>导入工作区</button></>}</div></>}
    {dialog.kind === "no-op" && <><h2>NO-OP · 同版本 / 同 Digest</h2><p>{dialog.name} 已是当前完整 Snapshot，不创建副本、不覆盖。</p><div className="dialog-actions"><button type="button" className="primary" onClick={() => execute({ type: "close" })}>打开现有 Workspace</button></div></>}
    {dialog.kind === "update" && <><h2>更新现有 Workspace</h2><p>当前 Workspace 未修改；导入内容 Digest 不同。确认后才替换。</p><div className="dialog-actions"><button type="button" onClick={() => execute({ type: "close" })}>取消</button><button type="button" className="primary" onClick={() => execute({ type: "commit-incoming", incoming: dialog.incoming, handoff: dialog.handoff })}>更新现有</button></div></>}
    {dialog.kind === "conflict" && <><h2>dirty 同 ID 冲突</h2><p>当前 Workspace 有本地修改，禁止自动合并。</p><div className="conflict-choices"><button type="button" onClick={() => execute({ type: "close" })}>取消（零写入）</button><button type="button" onClick={() => execute({ type: "save-aside", incoming: dialog.incoming, handoff: dialog.handoff })}>另存 · 新 Package ID / 1.0.0</button><button type="button" className="danger" onClick={() => execute({ type: "commit-incoming", incoming: dialog.incoming, handoff: dialog.handoff })}>覆盖 · 丢弃本地修改</button></div></>}
    {dialog.kind === "delete-workspace-node" && <><h2>删除{dialog.node.kind === "folder" ? "文件夹" : "资源"}</h2><p>删除“{dialog.name}”？{dialog.node.kind === "folder" ? "文件夹内的资源也会一并删除。" : ""}</p><div className="dialog-actions"><button type="button" onClick={() => execute({ type: "close" })}>取消</button><button type="button" className="danger" onClick={() => execute({ type: "delete-workspace-node", workspaceKey: dialog.workspaceKey, node: dialog.node })}>删除</button></div></>}
    {dialog.kind === "delete-selected-resources" && <><h2>批量删除资源</h2><p>删除已选的 {dialog.selections.length} 个资源？此操作会从对应资源包中移除它们。</p><div className="dialog-actions"><button type="button" onClick={() => execute({ type: "close" })}>取消</button><button type="button" className="danger" onClick={() => execute({ type: "delete-selected-resources", selections: dialog.selections })}>删除</button></div></>}
    {dialog.kind === "copy-resource-to-package" && <><h2>复制“{dialog.name}”到资源包</h2><p>复制后是独立资源，修改副本不会影响原资源。有关联的切换形态时会一起复制。</p><div className="conflict-choices">{snapshot.workspaces.filter((workspace) => workspace.key !== dialog.sourceWorkspaceKey).map((workspace) => <button type="button" key={workspace.key} onClick={() => execute({ type: "copy-resource", sourceWorkspaceKey: dialog.sourceWorkspaceKey, resourceId: dialog.resourceId, targetWorkspaceKey: workspace.key })}>{workspace.document.package.name}</button>)}</div>
      {snapshot.workspaces.length <= 1 && <p>当前没有其他资源包，可以在下面直接新建。</p>}<Field className="dialog-field" label="新资源包名称" value={snapshot.copyPackageName} onChange={(value) => execute({ type: "set-copy-package-name", value })} /><div className="dialog-actions"><button type="button" onClick={() => execute({ type: "close" })}>取消</button><button type="button" className="primary" disabled={!snapshot.copyPackageName.trim()} onClick={() => execute({ type: "copy-resource-to-new-package", sourceWorkspaceKey: dialog.sourceWorkspaceKey, resourceId: dialog.resourceId })}>新建并复制</button></div></>}
    {dialog.kind === "close-workspace" && <><h2>移到回收站</h2><p>{dialog.name}</p><div className="dialog-actions"><button type="button" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "close" })}>取消</button><button type="button" className="danger" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "close-workspace", workspaceKey: dialog.workspaceKey })}>{snapshot.creatorOperation === "trash-workspace" ? <OperationStatus label="正在移到回收站…" /> : "移到回收站"}</button></div></>}
    {dialog.kind === "new-tabletop" && <><h2>新建桌面</h2><Field className="dialog-field" label="名称" value={snapshot.tabletopName} onChange={(value) => execute({ type: "set-tabletop-name", value })} /><div className="dialog-actions"><button type="button" onClick={() => execute({ type: "close" })}>取消</button><button type="button" className="primary" disabled={!snapshot.tabletopName.trim()} onClick={() => execute({ type: "create-tabletop" })}>创建</button></div></>}
    {dialog.kind === "rename-tabletop" && <><h2>重命名桌面</h2><Field className="dialog-field" label="名称" value={snapshot.tabletopName} onChange={(value) => execute({ type: "set-tabletop-name", value })} /><div className="dialog-actions"><button type="button" onClick={() => execute({ type: "close" })}>取消</button><button type="button" className="primary" disabled={!snapshot.tabletopName.trim()} onClick={() => execute({ type: "rename-tabletop", tabletopId: dialog.tabletopId })}>保存</button></div></>}
    {dialog.kind === "delete-tabletop" && <><h2>{snapshot.tabletopSync.get(dialog.tabletopId)?.scope === "cloud" ? "移到回收站" : "删除桌面"}</h2><p>{dialog.name}</p><div className="dialog-actions"><button type="button" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "close" })}>取消</button><button type="button" className="danger" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "delete-tabletop", tabletopId: dialog.tabletopId })}>{snapshot.creatorOperation === "trash-tabletop" ? <OperationStatus label="正在移到回收站…" /> : "移到回收站"}</button></div></>}
    {dialog.kind === "tabletop-import-conflict" && <><h2>已有同一个桌面</h2><p>“{dialog.incoming.document.name}”的编号与现有桌面相同。请选择怎么处理。</p>{snapshot.creatorOperation === "import-tabletop" && <OperationStatus label="正在写入桌面…" size="regular" />}<div className="conflict-choices"><button type="button" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "close" })}>取消，不改数据</button><button type="button" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "commit-tabletop-import", incoming: dialog.incoming, resolution: "copy" })}>保留两份</button><button type="button" className="danger" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "commit-tabletop-import", incoming: dialog.incoming, resolution: "replace" })}>覆盖现有桌面</button></div></>}
    {dialog.kind === "sync-document" && <><h2>同步到云端</h2><p>{dialog.name}</p><p>同步前只保存在此浏览器，不等于云备份。同步后仍是同一个项目和编号。</p><div className="cloud-document-kind">{dialog.documentKind === "creator-workspace" ? "资源工作区" : "GM 桌面"}</div><div className="dialog-actions"><button type="button" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "close" })}>取消</button><button type="button" className="primary" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "confirm-cloud-sync", documentKind: dialog.documentKind, documentId: dialog.documentId })}>{snapshot.creatorOperation === "cloud-sync" ? <OperationStatus label="正在同步云端…" /> : "同步"}</button></div></>}
    {dialog.kind === "cloud-conflict" && <><h2>云端版本有更新</h2><p>{dialog.name}</p>{snapshot.creatorOperation === "cloud-conflict" && <OperationStatus label="正在处理云端版本…" size="regular" />}<div className="conflict-choices cloud-conflict-actions"><button type="button" className="primary" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "resolve-cloud-conflict", documentKind: dialog.documentKind, documentId: dialog.documentId, resolution: "cloud" })}>保留云端</button><button type="button" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "resolve-cloud-conflict", documentKind: dialog.documentKind, documentId: dialog.documentId, resolution: "aside" })}>本地另存</button><button type="button" className="danger" disabled={Boolean(snapshot.creatorOperation)} onClick={() => execute({ type: "resolve-cloud-conflict", documentKind: dialog.documentKind, documentId: dialog.documentId, resolution: "local" })}>用本地覆盖</button></div></>}
  </section></div>;
}
