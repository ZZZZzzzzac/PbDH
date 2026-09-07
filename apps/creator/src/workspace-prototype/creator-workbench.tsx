import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { RESOURCE_PACKAGE_VERSION } from "@pbdh/contract-runtime";
import { resolveTemplateFrontend, TemplateAuthoringSurface } from "@pbdh/templates/frontend";
import { templateRegistry } from "@pbdh/templates/core";

import { Icon } from "./creator-controls.tsx";
import { CreatorColumnResizeHandle, creatorColumnPreferences } from "./creator-layout.tsx";
import { ReplacementEditor, ResourceAttributionEditor } from "./resource-authoring.tsx";
import { ResourceIcon, TemplateRuntimePreview, resourceTitle } from "./resource-preview.tsx";
import { resolveResourceAttribution, type CreatorWorkspace, type WorkspaceResource } from "./workspace-model.ts";
import { orderTabsByKey, resourceTabKey, shouldActivateTabDrag, type TabDropPlacement } from "./tab-order.ts";

export type CreatorWorkbenchSnapshot = {
  workspaces: readonly CreatorWorkspace[];
  activeWorkspace?: CreatorWorkspace;
  activeResource?: WorkspaceResource;
  activeResourceId: string;
  tabOrder?: readonly string[];
  editorColumnShare: number;
  assetUrls: ReadonlyMap<string, string>;
};

export type CreatorWorkbenchCommand =
  | { type: "activate-resource" | "pin-resource" | "close-resource"; workspaceKey: string; resourceId: string }
  | { type: "reorder-resource-tab"; sourceKey: string; targetKey: string; placement: TabDropPlacement }
  | { type: "request-cloud-edit" | "choose-portrait" | "remove-portrait" }
  | { type: "set-editor-share"; value: number }
  | { type: "authoring-value"; path: string; value: unknown }
  | { type: "replace-authoring-data"; data: Record<string, unknown> }
  | { type: "attribution-value"; field: "artworkCredit" | "sourceLabel"; value: string }
  | { type: "replacement"; resourceId: string; replacementId: string; targetResourceId: string | null }
  | { type: "presentation-mode"; mode: "text" | "split" | "image" }
  | { type: "toggle-fixed-ratio" };

export function CreatorWorkbench({ snapshot, execute }: {
  snapshot: CreatorWorkbenchSnapshot;
  execute(command: CreatorWorkbenchCommand): void;
}) {
  const [draggedTabKey, setDraggedTabKey] = useState("");
  const [dropTarget, setDropTarget] = useState<{ key: string; placement: TabDropPlacement } | null>(null);
  const dragRef = useRef<{ pointerId: number; sourceKey: string; startX: number; moved: boolean } | null>(null);
  const suppressTabClickRef = useRef(false);
  const active = snapshot.activeWorkspace;
  const resource = snapshot.activeResource;
  const templateUpgradeAvailable = resource ? templateRegistry.upgradeTargets(resource.template.id, resource.template.version).length > 0 : false;
  const templateFrontend = resource
    ? resolveTemplateFrontend(resource.template.id, resource.template.version)
    : undefined;
  const template = resource
    ? templateRegistry.resolve(resource.template.id, resource.template.version)
    : undefined;
  const previewAssets = new Map(resource ? Object.values(resource.media).flatMap((id) => {
    const url = snapshot.assetUrls.get(id);
    return url ? [[id, { status: "ready" as const, url }] as const] : [];
  }) : []);
  const resourceTabs = orderTabsByKey(snapshot.workspaces.flatMap((workspace) => workspace.openResourceIds.flatMap((resourceId) => {
    const candidate = workspace.document.resources.find((item) => item.id === resourceId);
    return candidate ? [{ key: resourceTabKey(workspace.key, candidate.id), workspace, candidate }] : [];
  })), snapshot.tabOrder ?? [], (tab) => tab.key);

  function dropAt(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-resource-tab-key]");
    const key = element?.dataset.resourceTabKey;
    if (!element || !key || key === dragRef.current?.sourceKey) return null;
    const bounds = element.getBoundingClientRect();
    return { key, placement: clientX < bounds.left + bounds.width / 2 ? "before" : "after" } as const;
  }

  function movePointer(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && shouldActivateTabDrag(drag.startX, event.clientX)) {
      drag.moved = true;
      setDraggedTabKey(drag.sourceKey);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    event.preventDefault();
    setDropTarget(dropAt(event.clientX, event.clientY));
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const target = dropAt(event.clientX, event.clientY);
    if (drag.moved) {
      suppressTabClickRef.current = true;
      window.setTimeout(() => { suppressTabClickRef.current = false; }, 0);
      if (target) execute({ type: "reorder-resource-tab", sourceKey: drag.sourceKey, targetKey: target.key, placement: target.placement });
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDraggedTabKey("");
    setDropTarget(null);
  }

  function reorderWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, tabKey: string) {
    if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    const index = resourceTabs.findIndex((tab) => tab.key === tabKey);
    const target = resourceTabs[index + (event.key === "ArrowLeft" ? -1 : 1)];
    if (!target) return;
    event.preventDefault();
    execute({
      type: "reorder-resource-tab",
      sourceKey: tabKey,
      targetKey: target.key,
      placement: event.key === "ArrowLeft" ? "before" : "after",
    });
  }

  return <section className="creator-workbench">
    <nav className="resource-tabs" aria-label="打开的资源">
      {resourceTabs.map(({ key, workspace, candidate }) => {
        const current = workspace.key === active?.key && candidate.id === snapshot.activeResourceId;
        const targetClass = dropTarget?.key === key ? ` is-drop-${dropTarget.placement}` : "";
        return <div
          className={`resource-tab${current ? " is-current" : ""}${candidate.id === workspace.previewResourceId ? " is-preview" : ""}${draggedTabKey === key ? " is-dragging" : ""}${targetClass}`}
          data-resource-tab-key={key}
          key={key}
          onPointerDown={(event) => {
            if (event.button !== 0 || (event.target as Element).closest(".resource-tab-close")) return;
            dragRef.current = { pointerId: event.pointerId, sourceKey: key, startX: event.clientX, moved: false };
          }}
          onPointerMove={movePointer}
          onPointerUp={finishPointer}
          onPointerCancel={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            dragRef.current = null;
            setDraggedTabKey("");
            setDropTarget(null);
          }}
        >
          <button type="button" className="resource-tab-main" title="拖动调整顺序；Alt+方向键移动" onKeyDown={(event) => reorderWithKeyboard(event, key)} onClick={() => {
            if (suppressTabClickRef.current) { suppressTabClickRef.current = false; return; }
            execute({ type: "activate-resource", workspaceKey: workspace.key, resourceId: candidate.id });
          }} onDoubleClick={() => execute({ type: "pin-resource", workspaceKey: workspace.key, resourceId: candidate.id })}><ResourceIcon resource={candidate} /><span>{resourceTitle(candidate)}</span></button>
          <button type="button" className="resource-tab-close" aria-label={`关闭 ${resourceTitle(candidate)}`} onClick={() => execute({ type: "close-resource", workspaceKey: workspace.key, resourceId: candidate.id })}><Icon name="x" /></button>
        </div>;
      })}
    </nav>
    {active && resource ? <div className="workbench-body" onPointerDown={() => execute({ type: "pin-resource", workspaceKey: active.key, resourceId: resource.id })}>
      <div className="authoring-column" onFocusCapture={() => execute({ type: "request-cloud-edit" })} onBlurCapture={() => execute({ type: "request-cloud-edit" })}>
        {templateFrontend && <TemplateAuthoringSurface
          authoring={templateFrontend.authoring}
          data={resource.data as Record<string, unknown>}
          onValue={(path, value) => execute({ type: "authoring-value", path, value })}
          onData={(data) => execute({ type: "replace-authoring-data", data })}
        />}
        <ResourceAttributionEditor
          artworkCredit={resolveResourceAttribution(resource, active.document.package.name).artworkCredit}
          sourceLabel={resolveResourceAttribution(resource, active.document.package.name).sourceLabel}
          onChange={(field, value) => execute({ type: "attribution-value", field, value })}
        />
        {templateFrontend?.authoring.replacements === "after" && active.document.contractVersion === RESOURCE_PACKAGE_VERSION && template?.tabletop.replacements.map((replacement) => <ReplacementEditor
          key={replacement.id}
          label={replacement.label}
          value={resource.replacements?.find((candidate) => candidate.replacementId === replacement.id)?.targetResourceId ?? ""}
          options={active.document.resources.filter((candidate) => candidate.id !== resource.id).map((candidate) => ({ id: candidate.id, name: resourceTitle(candidate) }))}
          onChange={(targetResourceId) => execute({ type: "replacement", resourceId: resource.id, replacementId: replacement.id, targetResourceId })}
        />)}
        <dl className="resource-metadata" aria-label="调试信息">
          <div><dt>模板</dt><dd>{resource.template.id}</dd></div>
          <div><dt>模板版本</dt><dd>{resource.template.version}{templateUpgradeAvailable && <b className="resource-template-update">新!</b>}</dd></div>
          <div><dt>渲染器</dt><dd>{template?.rendererRevision ?? "未知"}</dd></div>
          <div><dt>资源包版本</dt><dd>{active.document.package.version}</dd></div>
          <div><dt>合约版本</dt><dd>{active.document.contractVersion}</dd></div>
        </dl>
      </div>

      <CreatorColumnResizeHandle label="调整编辑区与预览区宽度" value={snapshot.editorColumnShare} preference={creatorColumnPreferences.editor} cssVariable="--creator-editor-share" onChange={(value) => execute({ type: "set-editor-share", value })} />

      <aside className="preview-panel">
        <header><h1>实时预览</h1><div>
          <div className="card-mode" role="group" aria-label="卡面模式">{(["text", "split", "image"] as const).map((mode) => <button type="button" key={mode} aria-pressed={resource.presentation.mode === mode} onClick={() => execute({ type: "presentation-mode", mode })}>{{ text: "纯文字", split: "图+文", image: "纯图片" }[mode]}</button>)}</div>
          <button type="button" className="fixed-ratio" role="switch" aria-checked={resource.presentation.fixedRatio} onClick={() => execute({ type: "toggle-fixed-ratio" })}><span>固定比例</span><i /></button>
        </div></header>
        {templateFrontend && template ? <TemplateRuntimePreview key={`${active.document.package.id}:${resource.id}:${resource.template.id}:${resource.template.version}`} resource={resource} packageName={active.document.package.name} assets={previewAssets} frontend={templateFrontend} template={template} /> : null}
        <footer className="preview-media"><span className="media-icon"><Icon name="image" /></span><strong>{resource.media.portrait ? "已设置卡图" : "未设置卡图"}</strong><button type="button" onClick={() => execute({ type: "choose-portrait" })}><Icon name="image" />{resource.media.portrait ? "替换" : "添加"}</button>{resource.media.portrait ? <button type="button" onClick={() => execute({ type: "remove-portrait" })}><Icon name="trash" />删除卡图</button> : null}</footer>
      </aside>
    </div> : <div className="closed-tabs-empty"><strong>没有打开的资源</strong></div>}
  </section>;
}
