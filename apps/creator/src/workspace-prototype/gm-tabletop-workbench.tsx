import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

import type { LocalDocumentSync } from "@pbdh/local-storage";
import { canonicalCardDesignSize, usesFixedSurfaceRatio } from "@pbdh/resource-renderer/core";
import { CardDisplay } from "@pbdh/resource-renderer/react";
import type { TabletopCommand, TabletopDocumentModel } from "@pbdh/tabletop/core";
import { TabletopSurface } from "@pbdh/tabletop/react";
import { resolveTemplateFrontend, TemplateAuthoringSurface, useTemplateAuthoring, TemplateLoadStatus } from "@pbdh/templates/frontend/lazy";
import { templateResourceTitle } from "@pbdh/templates/core/lazy";

import { CloudSyncIndicator, Icon } from "./creator-controls.tsx";
import { gmTabletopCapabilities } from "./gm-tabletop-session.ts";
import { gmTabletopZoomSteps } from "./gm-tabletop-viewport.ts";
import { GmTabletopCard } from "./gm-tabletop-card.tsx";
import { gmCardPixelsPerDesignUnit } from "./gm-tabletop-geometry.ts";
import { AutoFitPreview, ResourceIcon } from "./resource-preview.tsx";
import { orderTabsByKey, shouldActivateTabDrag, type TabDropPlacement } from "./tab-order.ts";

export type GmTabletopWorkbenchSnapshot = {
  tabletops: readonly TabletopDocumentModel[];
  activeTabletop?: TabletopDocumentModel;
  activeTabletopId: string;
  tabOrder?: readonly string[];
  sync: ReadonlyMap<string, LocalDocumentSync>;
  savingTabletopId: string | null;
  view: "canvas" | "instance-editor";
  selectedInstanceId: string;
  selectedInstanceIds: readonly string[];
  zoom: number;
  pan: { x: number; y: number };
  assetUrls: ReadonlyMap<string, string>;
};

export type GmTabletopWorkbenchCommand =
  | { type: "new-tabletop" | "clear-selection" | "close-context" | "fit" | "request-cloud-edit" }
  | { type: "activate-tabletop" | "request-delete-tabletop"; tabletopId: string }
  | { type: "reorder-tabletop-tab"; sourceKey: string; targetKey: string; placement: TabDropPlacement }
  | { type: "open-tabletop-context"; tabletopId: string; x: number; y: number }
  | { type: "set-view"; view: "canvas" | "instance-editor" }
  | { type: "set-pan" | "preview-pan"; pan: { x: number; y: number } }
  | { type: "set-zoom"; zoom: number }
  | { type: "open-canvas-context"; x: number; y: number }
  | { type: "place-resource"; resourceId: string; position: { x: number; y: number } }
  | { type: "select-instance"; instanceId: string; mode: "replace" | "add" | "toggle" }
  | { type: "open-instance-context"; instanceId: string; x: number; y: number }
  | { type: "tabletop-command"; command: TabletopCommand }
  | { type: "edit-instance-data"; path: string[]; value: unknown }
  | { type: "replace-instance-data"; data: Record<string, unknown> };

export function GmTabletopWorkbench({
  snapshot,
  viewportRef,
  surfaceRef,
  execute,
}: {
  snapshot: GmTabletopWorkbenchSnapshot;
  viewportRef: RefObject<HTMLDivElement | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  execute(command: GmTabletopWorkbenchCommand): void;
}) {
  const [draggedTabKey, setDraggedTabKey] = useState("");
  const [dropTarget, setDropTarget] = useState<{ key: string; placement: TabDropPlacement } | null>(null);
  const tabDragRef = useRef<{ pointerId: number; sourceKey: string; startX: number; moved: boolean } | null>(null);
  const suppressTabClickRef = useRef(false);
  const panDragRef = useRef<null | {
    pointerId: number;
    button: number;
    startPointer: { x: number; y: number };
    startPan: { x: number; y: number };
    moved: boolean;
  }>(null);
  const suppressContextMenuRef = useRef(false);
  const selectedInstance = snapshot.activeTabletop?.instances.find((instance) => instance.id === snapshot.selectedInstanceId);
  const authoring = useTemplateAuthoring(
    snapshot.view === "instance-editor" ? selectedInstance?.resource.template.id : undefined,
    snapshot.view === "instance-editor" ? selectedInstance?.resource.template.version : undefined,
  );
  const selectedFrontend = selectedInstance
    ? resolveTemplateFrontend(selectedInstance.resource.template.id, selectedInstance.resource.template.version)
    : undefined;
  const orderedTabletops = orderTabsByKey(snapshot.tabletops, snapshot.tabOrder ?? [], (tabletop) => tabletop.id);

  function dropAt(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-tabletop-tab-key]");
    const key = element?.dataset.tabletopTabKey;
    if (!element || !key || key === tabDragRef.current?.sourceKey) return null;
    const bounds = element.getBoundingClientRect();
    return { key, placement: clientX < bounds.left + bounds.width / 2 ? "before" : "after" } as const;
  }

  function moveTabPointer(event: PointerEvent<HTMLDivElement>) {
    const drag = tabDragRef.current;
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

  function finishTabPointer(event: PointerEvent<HTMLDivElement>) {
    const drag = tabDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const target = dropAt(event.clientX, event.clientY);
    if (drag.moved) {
      suppressTabClickRef.current = true;
      window.setTimeout(() => { suppressTabClickRef.current = false; }, 0);
      if (target) execute({ type: "reorder-tabletop-tab", sourceKey: drag.sourceKey, targetKey: target.key, placement: target.placement });
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    tabDragRef.current = null;
    setDraggedTabKey("");
    setDropTarget(null);
  }

  function reorderWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, tabKey: string) {
    if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    const index = orderedTabletops.findIndex((tabletop) => tabletop.id === tabKey);
    const target = orderedTabletops[index + (event.key === "ArrowLeft" ? -1 : 1)];
    if (!target) return;
    event.preventDefault();
    execute({
      type: "reorder-tabletop-tab",
      sourceKey: tabKey,
      targetKey: target.id,
      placement: event.key === "ArrowLeft" ? "before" : "after",
    });
  }

  return <section className="gm-workbench">
    <nav className="tabletop-tabs" aria-label="打开的桌面">
      {orderedTabletops.map((tabletop) => <div
        className={`tabletop-tab${tabletop.id === snapshot.activeTabletop?.id ? " is-current" : ""}${draggedTabKey === tabletop.id ? " is-dragging" : ""}${dropTarget?.key === tabletop.id ? ` is-drop-${dropTarget.placement}` : ""}`}
        data-tabletop-tab-key={tabletop.id}
        key={tabletop.id}
        onContextMenu={(event) => {
          event.preventDefault();
          execute({ type: "open-tabletop-context", tabletopId: tabletop.id, x: event.clientX, y: event.clientY });
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest(".tabletop-tab-close")) return;
          tabDragRef.current = { pointerId: event.pointerId, sourceKey: tabletop.id, startX: event.clientX, moved: false };
        }}
        onPointerMove={moveTabPointer}
        onPointerUp={finishTabPointer}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          tabDragRef.current = null;
          setDraggedTabKey("");
          setDropTarget(null);
        }}
      >
        <button type="button" className="tabletop-tab-main" title="拖动调整顺序；Alt+方向键移动" onKeyDown={(event) => reorderWithKeyboard(event, tabletop.id)} onClick={() => {
          if (suppressTabClickRef.current) { suppressTabClickRef.current = false; return; }
          execute({ type: "activate-tabletop", tabletopId: tabletop.id });
        }}><span>▦</span><b>{tabletop.name}</b><CloudSyncIndicator sync={snapshot.sync.get(tabletop.id)} saving={snapshot.savingTabletopId === tabletop.id} /></button>
        <button type="button" className="tabletop-tab-close" aria-label={`删除 ${tabletop.name}`} title="删除桌面" onClick={() => execute({ type: "request-delete-tabletop", tabletopId: tabletop.id })}><Icon name="x" /></button>
      </div>)}
      <button type="button" className="tabletop-tab-action" aria-label="新建桌面" title="新建桌面" onClick={() => execute({ type: "new-tabletop" })}>＋</button>
    </nav>

    {!snapshot.activeTabletop && <div className="gm-tabletop-empty"><strong>还没有桌面</strong><button type="button" onClick={() => execute({ type: "new-tabletop" })}>＋ 新建桌面</button></div>}

    {snapshot.activeTabletop && snapshot.view === "canvas" && <div
      ref={viewportRef}
      className="tabletop-viewport"
      tabIndex={0}
      aria-label={`${snapshot.activeTabletop.name}桌面；方向键平移，0 回到 100%，F 适合内容`}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const delta = {
          ArrowLeft: { x: 48, y: 0 }, ArrowRight: { x: -48, y: 0 },
          ArrowUp: { x: 0, y: 48 }, ArrowDown: { x: 0, y: -48 },
        }[event.key];
        if (delta) {
          event.preventDefault();
          execute({ type: "set-pan", pan: { x: snapshot.pan.x + delta.x, y: snapshot.pan.y + delta.y } });
        } else if (event.key === "0") {
          event.preventDefault();
          execute({ type: "set-zoom", zoom: 1 });
        } else if (event.key.toLocaleLowerCase() === "f") {
          event.preventDefault();
          execute({ type: "fit" });
        }
      }}
      onPointerDown={(event) => {
        if ((event.target as Element).closest("[data-tabletop-instance-id]")) return;
        execute({ type: "close-context" });
        if (event.button === 0 && event.pointerType !== "touch") {
          execute({ type: "clear-selection" });
          return;
        }
        if (event.pointerType !== "touch" && event.button !== 1 && event.button !== 2) return;
        if (event.pointerType === "touch" || event.button === 1) event.preventDefault();
        if (event.button === 2) suppressContextMenuRef.current = false;
        event.currentTarget.style.cursor = "grabbing";
        event.currentTarget.setPointerCapture(event.pointerId);
        panDragRef.current = { pointerId: event.pointerId, button: event.button, startPointer: { x: event.clientX, y: event.clientY }, startPan: snapshot.pan, moved: false };
      }}
      onPointerMove={(event) => {
        const drag = panDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.startPointer.x;
        const dy = event.clientY - drag.startPointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        execute({ type: "preview-pan", pan: { x: drag.startPan.x + dx, y: drag.startPan.y + dy } });
      }}
      onPointerUp={(event) => {
        const drag = panDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        suppressContextMenuRef.current = drag.button === 2 && drag.moved;
        execute({ type: "set-pan", pan: { x: drag.startPan.x + event.clientX - drag.startPointer.x, y: drag.startPan.y + event.clientY - drag.startPointer.y } });
        panDragRef.current = null;
        event.currentTarget.style.cursor = "";
      }}
      onPointerCancel={(event) => {
        execute({ type: "preview-pan", pan: snapshot.pan });
        panDragRef.current = null;
        event.currentTarget.style.cursor = "";
      }}
      onContextMenu={(event) => {
        if ((event.target as Element).closest("[data-tabletop-instance-id]")) return;
        event.preventDefault();
        if (suppressContextMenuRef.current) {
          suppressContextMenuRef.current = false;
          return;
        }
        execute({ type: "open-canvas-context", x: event.clientX, y: event.clientY });
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("application/x-pbdh-resource")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        const resourceId = event.dataTransfer.getData("application/x-pbdh-resource");
        if (!resourceId) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        execute({ type: "place-resource", resourceId, position: {
          x: (event.clientX - rect.left - snapshot.pan.x) / snapshot.zoom,
          y: (event.clientY - rect.top - snapshot.pan.y) / snapshot.zoom,
        } });
      }}
    >
      <TabletopSurface
        surfaceRef={surfaceRef}
        document={snapshot.activeTabletop}
        capabilities={gmTabletopCapabilities}
        selectedInstanceId={snapshot.selectedInstanceId}
        selectedInstanceIds={snapshot.selectedInstanceIds}
        renderInstance={(instance) => <CardDisplay designWidth={canonicalCardDesignSize.width} designHeight={canonicalCardDesignSize.height} fixedRatio={usesFixedSurfaceRatio(instance.resource.presentation)} displayWidth="250px" displayAspectRatio={63 / 88}>
          <GmTabletopCard instance={instance} assetUrls={snapshot.assetUrls} onCommand={(command) => execute({ type: "tabletop-command", command })} />
        </CardDisplay>}
        onSelect={(instanceId, mode) => execute({ type: "select-instance", instanceId, mode })}
        onCommand={(command) => execute({ type: "tabletop-command", command })}
        onInstanceContextMenu={(instanceId, position) => execute({ type: "open-instance-context", instanceId, x: position.x, y: position.y })}
        coordinateScale={snapshot.zoom}
        positionBounds={{ ...snapshot.activeTabletop.canvas, containment: "full", pixelsPerUnit: gmCardPixelsPerDesignUnit }}
        style={{ width: snapshot.activeTabletop.canvas.width, height: snapshot.activeTabletop.canvas.height, transform: `translate(${snapshot.pan.x}px, ${snapshot.pan.y}px) scale(${snapshot.zoom})` }}
      />
      <div className="tabletop-zoom-status" aria-label="桌面缩放">
        <button type="button" aria-label="缩小桌面" onClick={() => {
          const index = gmTabletopZoomSteps.indexOf(snapshot.zoom as never);
          execute({ type: "set-zoom", zoom: gmTabletopZoomSteps[Math.max(0, index - 1)] ?? gmTabletopZoomSteps[0] });
        }}>−</button>
        <output aria-live="polite">{Math.round(snapshot.zoom * 100)}%</output>
        <button type="button" aria-label="放大桌面" onClick={() => {
          const index = gmTabletopZoomSteps.indexOf(snapshot.zoom as never);
          execute({ type: "set-zoom", zoom: gmTabletopZoomSteps[Math.min(gmTabletopZoomSteps.length - 1, index + 1)] ?? gmTabletopZoomSteps.at(-1)! });
        }}>＋</button>
        <i aria-hidden="true" />
        <button type="button" className="zoom-reset" onClick={() => execute({ type: "set-zoom", zoom: 1 })}>100%</button>
        <button type="button" className="zoom-fit" onClick={() => execute({ type: "fit" })}>适合内容</button>
      </div>
    </div>}

    {snapshot.view === "instance-editor" && selectedInstance && <>
      <div className="instance-editor-toolbar"><button type="button" onClick={() => execute({ type: "set-view", view: "canvas" })}>← 返回桌面</button><strong><ResourceIcon resource={selectedInstance.resource} />{templateResourceTitle(selectedInstance.resource.template.id, selectedInstance.resource.template.version, selectedInstance.resource.data) ?? selectedInstance.id} · 实例</strong></div>
      <div className="workbench-body instance-editor-body" onFocusCapture={() => execute({ type: "request-cloud-edit" })} onBlurCapture={() => execute({ type: "request-cloud-edit" })}>
        {selectedFrontend && (authoring.value ? <TemplateAuthoringSurface authoring={authoring.value} data={selectedInstance.resource.data} onValue={(path, value) => execute({ type: "edit-instance-data", path: path.split("."), value })} onData={(data) => execute({ type: "replace-instance-data", data })} /> : <TemplateLoadStatus state={authoring} />)}
        <aside className="preview-panel"><header><h1>实例预览</h1><span className="instance-edit-note">修改只作用于桌面上的这张卡</span></header><AutoFitPreview><GmTabletopCard instance={selectedInstance} assetUrls={snapshot.assetUrls} onCommand={(command) => execute({ type: "tabletop-command", command })} /></AutoFitPreview><footer className="preview-media"><span className="media-icon"><Icon name="image" /></span><strong>{selectedInstance.resource.media.portrait ? "已设置卡图" : "未设置卡图"}</strong><button type="button" disabled><Icon name="image" />替换</button></footer></aside>
      </div>
    </>}
  </section>;
}
