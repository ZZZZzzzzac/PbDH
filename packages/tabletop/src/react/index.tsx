import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

import {
  clampTabletopPosition,
  type TabletopCapabilitySet,
  type TabletopCommand,
  type TabletopDocumentModel,
  type TabletopInstance,
} from "../core/index.ts";

export type TabletopSurfaceProps = {
  document: TabletopDocumentModel;
  capabilities: TabletopCapabilitySet;
  selectedInstanceId?: string;
  selectedInstanceIds?: readonly string[];
  selectionEnabled?: boolean;
  className?: string;
  coordinateScale?: number;
  positionBounds?: { width: number; height: number; minimumVisible?: number };
  style?: CSSProperties;
  renderInstance: (instance: TabletopInstance) => ReactNode;
  onSelect: (instanceId: string, mode: "replace" | "add" | "toggle") => void;
  onCommand: (command: TabletopCommand) => void;
  onInstanceContextMenu?: (instanceId: string, position: { x: number; y: number }) => void;
};

type DragState = {
  pointerId: number;
  startPointer: { x: number; y: number };
  startPositions: Array<{ instanceId: string; position: { x: number; y: number } }>;
};

type ScaleState = {
  instanceId: string;
  pointerId: number;
  startPointer: { x: number; y: number };
  startScale: number;
};

export function TabletopSurface(props: TabletopSurfaceProps) {
  const dragRef = useRef<DragState | null>(null);
  const scaleRef = useRef<ScaleState | null>(null);
  const [draftPositions, setDraftPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draftScales, setDraftScales] = useState<Record<string, number>>({});
  const selectedIds = new Set(props.selectedInstanceIds ?? (props.selectedInstanceId ? [props.selectedInstanceId] : []));
  const clampPosition = (instance: TabletopInstance, position: { x: number; y: number }) => {
    if (!props.positionBounds) return position;
    return clampTabletopPosition(instance, props.positionBounds, position);
  };

  function startDrag(event: PointerEvent<HTMLDivElement>, instance: TabletopInstance) {
    const selectionMode = event.ctrlKey || event.metaKey ? "toggle" : event.shiftKey ? "add" : "replace";
    if (event.button === 0 && props.selectionEnabled !== false) props.onSelect(instance.id, selectionMode);
    if ((event.target as Element).closest("button, input, textarea, select, [role='button']")) return;
    if (!props.capabilities.has("move") || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const draggedInstances = selectionMode === "replace" && selectedIds.has(instance.id)
      ? props.document.instances.filter((candidate) => selectedIds.has(candidate.id))
      : [instance];
    dragRef.current = {
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startPositions: draggedInstances.map((candidate) => ({
        instanceId: candidate.id,
        position: candidate.position,
      })),
    };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const dx = (event.clientX - drag.startPointer.x) / (props.coordinateScale ?? 1);
    const dy = (event.clientY - drag.startPointer.y) / (props.coordinateScale ?? 1);
    setDraftPositions((current) => Object.fromEntries([
      ...Object.entries(current),
      ...drag.startPositions.map((item) => {
        const instance = props.document.instances.find((candidate) => candidate.id === item.instanceId)!;
        return [item.instanceId, clampPosition(instance, {
          x: item.position.x + dx,
          y: item.position.y + dy,
        })];
      }),
    ]));
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const dx = (event.clientX - drag.startPointer.x) / (props.coordinateScale ?? 1);
    const dy = (event.clientY - drag.startPointer.y) / (props.coordinateScale ?? 1);
    const moves = drag.startPositions.map((item) => {
      const instance = props.document.instances.find((candidate) => candidate.id === item.instanceId)!;
      return {
        instanceId: item.instanceId,
        position: clampPosition(instance, { x: item.position.x + dx, y: item.position.y + dy }),
      };
    });
    props.onCommand(moves.length === 1
      ? { type: "move", ...moves[0]! }
      : { type: "move-many", moves });
    setDraftPositions((current) => {
      const next = { ...current };
      for (const item of drag.startPositions) delete next[item.instanceId];
      return next;
    });
  }

  function startScale(event: PointerEvent<HTMLSpanElement>, instance: TabletopInstance) {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scaleRef.current = {
      instanceId: instance.id,
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startScale: instance.scale,
    };
  }

  function moveScale(event: PointerEvent<HTMLSpanElement>) {
    event.stopPropagation();
    const scale = scaleRef.current;
    if (!scale || scale.pointerId !== event.pointerId) return;
    event.preventDefault();
    const delta = ((event.clientX - scale.startPointer.x) + (event.clientY - scale.startPointer.y))
      / (300 * (props.coordinateScale ?? 1));
    setDraftScales((current) => ({
      ...current,
      [scale.instanceId]: Math.max(0.2, scale.startScale + delta),
    }));
  }

  function finishScale(event: PointerEvent<HTMLSpanElement>) {
    event.stopPropagation();
    const scale = scaleRef.current;
    if (!scale || scale.pointerId !== event.pointerId) return;
    scaleRef.current = null;
    const delta = ((event.clientX - scale.startPointer.x) + (event.clientY - scale.startPointer.y))
      / (300 * (props.coordinateScale ?? 1));
    props.onCommand({
      type: "uniform-scale",
      instanceId: scale.instanceId,
      scale: Math.max(0.2, scale.startScale + delta),
    });
    setDraftScales((current) => {
      const next = { ...current };
      delete next[scale.instanceId];
      return next;
    });
  }

  return (
    <div className={props.className} style={props.style} data-pbdh-tabletop-surface="">
      {props.document.instances.map((instance) => {
        const isSelected = selectedIds.has(instance.id);
        const position = draftPositions[instance.id] ?? instance.position;
        const style = {
          "--tabletop-x": `${position.x}px`,
          "--tabletop-y": `${position.y}px`,
          "--tabletop-scale": draftScales[instance.id] ?? instance.scale,
          "--tabletop-rotation": `${instance.rotation}deg`,
          zIndex: instance.layer,
        } as CSSProperties;
        return (
          <div
            key={instance.id}
            className={`tabletop-instance${isSelected ? " is-selected" : ""}`}
            data-tabletop-instance-id={instance.id}
            draggable={false}
            tabIndex={props.selectionEnabled === false ? -1 : 0}
            style={style}
            onPointerDown={(event) => startDrag(event, instance)}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={() => {
              const drag = dragRef.current;
              dragRef.current = null;
              setDraftPositions((current) => {
                const next = { ...current };
                for (const item of drag?.startPositions ?? [{ instanceId: instance.id }]) {
                  delete next[item.instanceId];
                }
                return next;
              });
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              props.onInstanceContextMenu?.(instance.id, { x: event.clientX, y: event.clientY });
            }}
            onDragStart={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget || !props.capabilities.has("move")) return;
              const delta = {
                ArrowLeft: { x: -8, y: 0 },
                ArrowRight: { x: 8, y: 0 },
                ArrowUp: { x: 0, y: -8 },
                ArrowDown: { x: 0, y: 8 },
              }[event.key];
              if (!delta) return;
              event.preventDefault();
              const targets = selectedIds.has(instance.id)
                ? props.document.instances.filter((candidate) => selectedIds.has(candidate.id))
                : [instance];
              const moves = targets.map((candidate) => ({
                instanceId: candidate.id,
                position: clampPosition(candidate, {
                  x: candidate.position.x + delta.x,
                  y: candidate.position.y + delta.y,
                }),
              }));
              props.onCommand(moves.length === 1
                ? { type: "move", ...moves[0]! }
                : { type: "move-many", moves });
            }}
          >
            {props.renderInstance(instance)}
            {props.selectionEnabled !== false && props.selectedInstanceId === instance.id && props.capabilities.has("uniform-scale") && <span
              className="tabletop-scale-handle"
              aria-label="等比缩放"
              role="slider"
              aria-valuemin={20}
              aria-valuenow={Math.round(instance.scale * 100)}
              tabIndex={0}
              onPointerDown={(event) => startScale(event, instance)}
              onPointerMove={moveScale}
              onPointerUp={finishScale}
              onPointerCancel={() => {
                scaleRef.current = null;
                setDraftScales((current) => {
                  const next = { ...current };
                  delete next[instance.id];
                  return next;
                });
              }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowRight"
                  && event.key !== "ArrowDown" && event.key !== "ArrowLeft") return;
                event.preventDefault();
                const direction = event.key === "ArrowUp" || event.key === "ArrowRight" ? 0.05 : -0.05;
                props.onCommand({
                  type: "uniform-scale",
                  instanceId: instance.id,
                  scale: Math.max(0.2, instance.scale + direction),
                });
              }}
            />}
          </div>
        );
      })}
    </div>
  );
}
