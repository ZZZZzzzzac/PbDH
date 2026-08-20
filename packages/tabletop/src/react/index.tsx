import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

import type {
  TabletopCapabilitySet,
  TabletopCommand,
  TabletopDocumentModel,
  TabletopInstance,
} from "../core/index.ts";

export type TabletopSurfaceProps = {
  document: TabletopDocumentModel;
  capabilities: TabletopCapabilitySet;
  selectedInstanceId?: string;
  selectionEnabled?: boolean;
  className?: string;
  coordinateScale?: number;
  style?: CSSProperties;
  renderInstance: (instance: TabletopInstance) => ReactNode;
  onSelect: (instanceId: string) => void;
  onCommand: (command: TabletopCommand) => void;
  onInstanceContextMenu?: (instanceId: string, position: { x: number; y: number }) => void;
};

type DragState = {
  instanceId: string;
  pointerId: number;
  startPointer: { x: number; y: number };
  startPosition: { x: number; y: number };
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

  function startDrag(event: PointerEvent<HTMLDivElement>, instance: TabletopInstance) {
    if (event.button === 0 && props.selectionEnabled !== false) props.onSelect(instance.id);
    if ((event.target as Element).closest("button, input, textarea, select, [role='button']")) return;
    if (!props.capabilities.has("move") || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      instanceId: instance.id,
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startPosition: instance.position,
    };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    setDraftPositions((current) => ({
      ...current,
      [drag.instanceId]: {
        x: drag.startPosition.x + (event.clientX - drag.startPointer.x) / (props.coordinateScale ?? 1),
        y: drag.startPosition.y + (event.clientY - drag.startPointer.y) / (props.coordinateScale ?? 1),
      },
    }));
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const position = {
      x: drag.startPosition.x + (event.clientX - drag.startPointer.x) / (props.coordinateScale ?? 1),
      y: drag.startPosition.y + (event.clientY - drag.startPointer.y) / (props.coordinateScale ?? 1),
    };
    props.onCommand({
      type: "move",
      instanceId: drag.instanceId,
      position,
    });
    setDraftPositions((current) => {
      const next = { ...current };
      delete next[drag.instanceId];
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
            className={`tabletop-instance${props.selectedInstanceId === instance.id ? " is-selected" : ""}`}
            data-tabletop-instance-id={instance.id}
            draggable={false}
            style={style}
            onPointerDown={(event) => startDrag(event, instance)}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={() => {
              dragRef.current = null;
              setDraftPositions((current) => {
                const next = { ...current };
                delete next[instance.id];
                return next;
              });
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              props.onInstanceContextMenu?.(instance.id, { x: event.clientX, y: event.clientY });
            }}
            onDragStart={(event) => event.preventDefault()}
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
