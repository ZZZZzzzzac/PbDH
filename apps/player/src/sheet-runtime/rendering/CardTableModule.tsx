import { Layers } from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import type { TabletopCapability, TabletopCommand, TabletopDocumentModel } from "@pbdh/tabletop/core";
import { TabletopSurface } from "@pbdh/tabletop/react";
import {
  clampCardTablePosition,
  createCardTableLayout,
  defaultCardWidthPx,
  maxCardWidthPx,
  minCardWidthPx,
  type CardInstance,
  type CardTableLayout,
} from "../domain/cardEngine";
import { type CardTableModule as CardTableModuleConfig, type SystemPackage } from "../domain/systemPackage";
import { useRuntimeStore } from "../store/runtimeStore";
import { CardContextMenu, CardDetailOverlay } from "./cardTable/CardActionSurfaces";
import { CardView } from "./cardTable/CardView";
import {
  findCardPresentation,
  hasReverseCardDefinition,
  resolveVisibleCardDefinition,
} from "./cardTable/cardDefinition";

interface CardTableModuleProps {
  module: CardTableModuleConfig;
  systemPackage: SystemPackage;
}

interface CardMenuState {
  instanceId: string;
  x: number;
  y: number;
}

interface HeightResizeState {
  pointerId: number;
  startY: number;
  startHeightPx: number;
}

export function CardTableModule({ module, systemPackage }: CardTableModuleProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [cardMenu, setCardMenu] = useState<CardMenuState | null>(null);
  const [detailInstanceId, setDetailInstanceId] = useState<string | null>(null);
  const characterData = useRuntimeStore((state) => state.characterData);
  const instances = characterData?.cards.instances ?? [];
  const updateCardInstancePosition = useRuntimeStore((state) => state.updateCardInstancePosition);
  const bringCardInstanceToFront = useRuntimeStore((state) => state.bringCardInstanceToFront);
  const tidyCardTable = useRuntimeStore((state) => state.tidyCardTable);
  const pendingPlacementIds = useRuntimeStore((state) => state.pendingCardTablePlacements[module.ID]);
  const placePendingCardInstances = useRuntimeStore((state) => state.placePendingCardInstances);
  const cardWidthPx = useRuntimeStore((state) => state.cardTableCardWidths[module.ID] ?? defaultCardWidthPx);
  const setCardTableCardWidth = useRuntimeStore((state) => state.setCardTableCardWidth);
  const manualSurfaceHeightPx = useRuntimeStore((state) => state.cardTableSurfaceHeights[module.ID]);
  const setCardTableSurfaceHeight = useRuntimeStore((state) => state.setCardTableSurfaceHeight);
  const visibleInstances = instances.filter((instance) => instance.tableModuleId === module.ID).sort(compareCards);
  const [surfaceWidthPx, setSurfaceWidthPx] = useState(0);
  const [surfaceViewportHeightPx, setSurfaceViewportHeightPx] = useState(0);
  const [heightResizeState, setHeightResizeState] = useState<HeightResizeState | null>(null);
  const manualSurfaceHeightRef = useRef(manualSurfaceHeightPx);
  manualSurfaceHeightRef.current = manualSurfaceHeightPx;
  const tableLayout = createCardTableLayout({
    surfaceWidthPx: surfaceWidthPx || 800,
    cardCount: visibleInstances.length,
    preferredCardWidthPx: cardWidthPx,
    minSurfaceHeightPx: Math.max(surfaceViewportHeightPx, manualSurfaceHeightPx ?? 0),
  });
  const visibleInstanceById = new Map(visibleInstances.map((instance) => [instance.instanceId, instance]));
  const tabletopDocument = createPlayerTabletopDocument(visibleInstances, module.ID, tableLayout);
  const menuInstance = cardMenu
    ? visibleInstances.find((instance) => instance.instanceId === cardMenu.instanceId)
    : undefined;
  const detailInstance = detailInstanceId
    ? visibleInstances.find((instance) => instance.instanceId === detailInstanceId)
    : undefined;

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const allocationElement = table.closest<HTMLElement>(".module-slot") ?? table.parentElement;

    const updateSurfaceSize = () => {
      if (table.closest(".app-shell.print-mode")) return;
      const rect = table.getBoundingClientRect();
      setSurfaceWidthPx(Math.max(0, table.clientWidth));
      if (manualSurfaceHeightRef.current !== undefined) return;
      const allocatedHeight = allocationElement?.clientHeight ?? 0;
      setSurfaceViewportHeightPx(Math.max(420, allocatedHeight || window.innerHeight - rect.top - 16));
    };

    updateSurfaceSize();
    window.addEventListener("resize", updateSurfaceSize);
    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", updateSurfaceSize);
    }

    const observer = new ResizeObserver(updateSurfaceSize);
    observer.observe(table);
    if (allocationElement && allocationElement !== table) observer.observe(allocationElement);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSurfaceSize);
    };
  }, []);

  useLayoutEffect(() => {
    if (!pendingPlacementIds?.length || surfaceWidthPx <= 0) return;
    placePendingCardInstances(module.ID, tableLayout);
  }, [
    cardWidthPx,
    module.ID,
    pendingPlacementIds,
    placePendingCardInstances,
    surfaceViewportHeightPx,
    surfaceWidthPx,
    tableLayout.columns,
    tableLayout.insetXPct,
    tableLayout.insetYPct,
    tableLayout.stepXPct,
    tableLayout.stepYPct,
  ]);

  const closeCardMenu = () => {
    setCardMenu(null);
  };

  const applySharedSurfaceCommand = (command: TabletopCommand) => {
    const moves = command.type === "move" ? [command] : command.type === "move-many" ? command.moves : [];
    for (const move of moves) {
      const position = pixelPositionToPercent(tableLayout, move.position);
      updateCardInstancePosition(move.instanceId, position.xPct, position.yPct);
    }
  };

  const applyManualSurfaceHeight = (heightPx: number) => {
    const automaticHeightPx = Math.max(420, surfaceViewportHeightPx);
    setCardTableSurfaceHeight(module.ID, heightPx <= automaticHeightPx ? null : heightPx);
  };

  const beginHeightResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setHeightResizeState({
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeightPx: tableLayout.surfaceHeightPx,
    });
  };

  const continueHeightResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (!heightResizeState || heightResizeState.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    applyManualSurfaceHeight(heightResizeState.startHeightPx + event.clientY - heightResizeState.startY);
  };

  const endHeightResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (heightResizeState?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    setHeightResizeState(null);
  };

  const resizeHeightWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      setCardTableSurfaceHeight(module.ID, null);
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    applyManualSurfaceHeight(tableLayout.surfaceHeightPx + (event.key === "ArrowDown" ? 80 : -80));
  };

  return (
    <section className="card-table-module" data-module-id={module.ID} data-module-type={module.类型} data-part="container">
      <div
        className="card-table-surface"
        data-part="surface"
        ref={tableRef}
        style={cardTableSurfaceStyle(tableLayout)}
        aria-label={`${module.标签}自由桌面`}
        onPointerDown={closeCardMenu}
      >
        <div className="card-table-actions card-table-side-actions" data-part="actions" onPointerDown={(event) => event.stopPropagation()}>
          <button className="card-action-button" data-part="tidy-button" type="button" onClick={() => tidyCardTable(module.ID, tableLayout)}>
            <Layers aria-hidden="true" size={16} />
            <span>整理</span>
          </button>
          <label className="card-size-control" data-part="size-control">
            <span>大小</span>
            <input
              type="range"
              min={minCardWidthPx}
              max={maxCardWidthPx}
              step={10}
              value={cardWidthPx}
              onChange={(event) => setCardTableCardWidth(module.ID, Number(event.currentTarget.value))}
              aria-label={`${module.标签}卡牌大小`}
            />
            <output>{cardWidthPx}px</output>
          </label>
          <span className="card-count">{visibleInstances.length} 张</span>
        </div>
        <TabletopSurface
          className="player-tabletop-surface"
          document={tabletopDocument}
          capabilities={playerSurfaceCapabilities}
          renderInstance={(surfaceInstance) => {
            const instance = visibleInstanceById.get(surfaceInstance.id);
            return instance ? <CardView
              instance={instance}
              definition={resolveVisibleCardDefinition(systemPackage, characterData, module, instance)}
              module={module}
              presentation={findCardPresentation(systemPackage, module, instance)}
            /> : null;
          }}
          onSelect={(instanceId) => {
            bringCardInstanceToFront(instanceId);
            closeCardMenu();
          }}
          onCommand={applySharedSurfaceCommand}
          onInstanceContextMenu={(instanceId, position) => {
            bringCardInstanceToFront(instanceId);
            setCardMenu({ instanceId, x: position.x, y: position.y });
          }}
          clampPosition={(_instance, position) => clampPlayerPixelPosition(tableLayout, position)}
          style={{ width: tableLayout.surfaceWidthPx, height: tableLayout.surfaceHeightPx }}
        />
        <button
          className="card-table-resize-handle"
          data-part="resize-handle"
          type="button"
          aria-label="调整卡牌桌面高度"
          title="上下拖动调整桌面高度；双击恢复自动高度"
          onPointerDown={beginHeightResize}
          onPointerMove={continueHeightResize}
          onPointerUp={endHeightResize}
          onPointerCancel={endHeightResize}
          onDoubleClick={() => setCardTableSurfaceHeight(module.ID, null)}
          onKeyDown={resizeHeightWithKeyboard}
        />
        {cardMenu ? createPortal(
          <CardContextMenu
            instance={menuInstance}
            canFlip={hasReverseCardDefinition(systemPackage, characterData, module, menuInstance)}
            stateOptions={module.状态选项 ?? []}
            x={cardMenu.x}
            y={cardMenu.y}
            onClose={closeCardMenu}
            onViewDetail={(instanceId) => { setDetailInstanceId(instanceId); closeCardMenu(); }}
          />,
          document.body,
        ) : null}
      </div>
      {detailInstanceId ? (
        <CardDetailOverlay
          instance={detailInstance}
          definition={resolveVisibleCardDefinition(systemPackage, characterData, module, detailInstance)}
          module={module}
          presentation={findCardPresentation(systemPackage, module, detailInstance)}
          onClose={() => setDetailInstanceId(null)}
        />
      ) : null}
    </section>
  );
}

function cardTableSurfaceStyle(layout: CardTableLayout): CSSProperties {
  return {
    "--play-card-width": `${layout.cardWidthPx}px`,
    height: `${layout.surfaceHeightPx}px`,
    minHeight: `${layout.surfaceHeightPx}px`,
  } as CSSProperties;
}

function compareCards(left: CardInstance, right: CardInstance): number {
  return left.zIndex - right.zIndex || left.instanceId.localeCompare(right.instanceId);
}

const playerSurfaceCapabilities = new Set<TabletopCapability>(["move"]);

function createPlayerTabletopDocument(
  instances: CardInstance[],
  tableModuleId: string,
  layout: CardTableLayout,
): TabletopDocumentModel {
  return {
    id: `player:${tableModuleId}`,
    name: tableModuleId,
    canvas: { width: layout.surfaceWidthPx, height: layout.surfaceHeightPx },
    assets: [],
    instances: instances.map((instance) => ({
      id: instance.instanceId,
      resource: {
        source: null,
        template: { id: "player.card", version: "1.0.0" },
        presentation: { mode: "text", fixedRatio: true },
        data: {},
        labels: [],
        replacements: [],
        media: {},
      },
      state: {},
      position: {
        x: instance.xPct * layout.surfaceWidthPx / 100,
        y: instance.yPct * layout.surfaceHeightPx / 100,
      },
      layer: instance.zIndex,
      rotation: instance.rotation,
      flipped: instance.face === "back",
      scale: instance.scale,
    })),
  };
}

function pixelPositionToPercent(layout: CardTableLayout, position: { x: number; y: number }) {
  return clampCardTablePosition(
    layout,
    position.x / layout.surfaceWidthPx * 100,
    position.y / layout.surfaceHeightPx * 100,
  );
}

function clampPlayerPixelPosition(layout: CardTableLayout, position: { x: number; y: number }) {
  const percent = pixelPositionToPercent(layout, position);
  return {
    x: percent.xPct * layout.surfaceWidthPx / 100,
    y: percent.yPct * layout.surfaceHeightPx / 100,
  };
}
