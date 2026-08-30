import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode, type Ref } from "react";

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
  surfaceRef?: Ref<HTMLDivElement>;
  coordinateScale?: number;
  positionBounds?: {
    width: number;
    height: number;
    minimumVisible?: number;
    containment?: "partial" | "full";
    pixelsPerUnit?: number;
  };
  clampPosition?: (instance: TabletopInstance, position: { x: number; y: number }) => { x: number; y: number };
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

type LongPressState = {
  pointerId: number;
  startPointer: { x: number; y: number };
  timer: number;
};

export function TabletopSurface(props: TabletopSurfaceProps) {
  const dragRef = useRef<DragState | null>(null);
  const scaleRef = useRef<ScaleState | null>(null);
  const longPressRef = useRef<LongPressState | null>(null);
  const instanceElementsRef = useRef(new Map<string, HTMLDivElement>());
  const selectedIds = new Set(props.selectedInstanceIds ?? (props.selectedInstanceId ? [props.selectedInstanceId] : []));
  const clampPosition = (instance: TabletopInstance, position: { x: number; y: number }) => {
    if (props.clampPosition) return props.clampPosition(instance, position);
    if (!props.positionBounds) return position;
    return clampTabletopPosition(instance, props.positionBounds, position);
  };

  function clearLongPress() {
    if (!longPressRef.current) return;
    window.clearTimeout(longPressRef.current.timer);
    longPressRef.current = null;
  }

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
    clearLongPress();
    if (event.pointerType === "touch" && props.onInstanceContextMenu) {
      longPressRef.current = {
        pointerId: event.pointerId,
        startPointer: { x: event.clientX, y: event.clientY },
        timer: window.setTimeout(() => {
          longPressRef.current = null;
          dragRef.current = null;
          props.onInstanceContextMenu?.(instance.id, { x: event.clientX, y: event.clientY });
        }, 500),
      };
    }
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const longPress = longPressRef.current;
    if (longPress && Math.abs(event.clientX - longPress.startPointer.x) + Math.abs(event.clientY - longPress.startPointer.y) > 8) {
      clearLongPress();
    }
    const dx = (event.clientX - drag.startPointer.x) / (props.coordinateScale ?? 1);
    const dy = (event.clientY - drag.startPointer.y) / (props.coordinateScale ?? 1);
    for (const item of drag.startPositions) {
      const instance = props.document.instances.find((candidate) => candidate.id === item.instanceId)!;
      const position = clampPosition(instance, { x: item.position.x + dx, y: item.position.y + dy });
      const element = instanceElementsRef.current.get(item.instanceId);
      element?.style.setProperty("--tabletop-x", `${position.x}px`);
      element?.style.setProperty("--tabletop-y", `${position.y}px`);
    }
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    clearLongPress();
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
    instanceElementsRef.current.get(scale.instanceId)?.style.setProperty(
      "--tabletop-scale",
      String(Math.max(0.2, scale.startScale + delta)),
    );
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
  }

  return (
    <div ref={props.surfaceRef} className={props.className} style={props.style} data-pbdh-tabletop-surface="">
      {props.document.instances.map((instance) => {
        const isSelected = selectedIds.has(instance.id);
        const style = {
          "--tabletop-x": `${instance.position.x}px`,
          "--tabletop-y": `${instance.position.y}px`,
          "--tabletop-scale": instance.scale,
          "--tabletop-rotation": `${instance.rotation}deg`,
          zIndex: instance.layer,
        } as CSSProperties;
        return (
          <div
            key={instance.id}
            ref={(element) => {
              if (element) instanceElementsRef.current.set(instance.id, element);
              else instanceElementsRef.current.delete(instance.id);
            }}
            className={`tabletop-instance${isSelected ? " is-selected" : ""}`}
            data-tabletop-instance-id={instance.id}
            draggable={false}
            tabIndex={props.selectionEnabled === false ? -1 : 0}
            style={style}
            onPointerDown={(event) => startDrag(event, instance)}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={() => {
              clearLongPress();
              const drag = dragRef.current;
              dragRef.current = null;
              for (const item of drag?.startPositions ?? [{ instanceId: instance.id }]) {
                const source = props.document.instances.find((candidate) => candidate.id === item.instanceId);
                const element = instanceElementsRef.current.get(item.instanceId);
                if (!source || !element) continue;
                element.style.setProperty("--tabletop-x", `${source.position.x}px`);
                element.style.setProperty("--tabletop-y", `${source.position.y}px`);
              }
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
                instanceElementsRef.current.get(instance.id)?.style.setProperty("--tabletop-scale", String(instance.scale));
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

export type TabletopContextMenuProps = {
  x: number;
  y: number;
  className?: string;
  estimatedWidth?: number;
  estimatedHeight?: number;
  children: ReactNode;
  onClose: () => void;
};

export function TabletopContextMenu({
  x,
  y,
  className,
  estimatedWidth = 200,
  estimatedHeight = 160,
  children,
  onClose,
}: TabletopContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onCloseRef.current();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const closeOnBlur = () => onCloseRef.current();
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("blur", closeOnBlur);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("blur", closeOnBlur);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div
      ref={menuRef}
      className={className}
      data-pbdh-tabletop-context-menu=""
      role="menu"
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - estimatedWidth)),
        top: Math.max(8, Math.min(y, window.innerHeight - estimatedHeight)),
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
