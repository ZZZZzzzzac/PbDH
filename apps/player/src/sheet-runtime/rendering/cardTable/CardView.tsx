import { X } from "lucide-react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import type { CardInstance } from "../../domain/cardEngine";
import type { CardPresentation } from "../../domain/cardPresentation";
import type { ResourceLibraryEntry } from "../../domain/resourceLibrary";
import type { CardTableModule } from "../../domain/systemPackage";
import { useRuntimeStore } from "../../store/runtimeStore";
import { CardFace, CardStateBadge } from "./CardFace";
import { CardIndicatorColumn } from "./CardIndicators";
import { definitionReferenceId, resolveRenderedCardPresentation } from "./cardDefinition";

export interface CardDragState {
  instanceId: string;
  pointerId: number;
  offsetXPct: number;
  offsetYPct: number;
  pendingXPct: number;
  pendingYPct: number;
}

export function CardView({
  instance,
  dragState,
  definition,
  module,
  presentation,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
}: {
  instance: CardInstance;
  dragState: CardDragState | null;
  definition?: ResourceLibraryEntry;
  module: CardTableModule;
  presentation?: CardPresentation;
  onPointerDown: (event: PointerEvent<HTMLElement>, instance: CardInstance) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>, instance: CardInstance) => void;
}) {
  const deleteCardInstance = useRuntimeStore((state) => state.deleteCardInstance);
  const name = resolveRenderedCardPresentation(definition, module, presentation).name || definitionReferenceId(instance);
  const isDragging = dragState?.instanceId === instance.instanceId;
  const stateAppearance = module.状态外观?.[instance.state];
  const stateBadgeId = stateAppearance ? `card-state-${instance.instanceId}` : undefined;

  return (
    <article
      className={`play-card${stateAppearance ? " has-card-state-appearance" : ""}`}
      data-card-instance-id={instance.instanceId}
      data-card-state={instance.state}
      style={{
        left: `${isDragging ? dragState.pendingXPct : instance.xPct}%`,
        top: `${isDragging ? dragState.pendingYPct : instance.yPct}%`,
        zIndex: instance.zIndex,
        transform: `rotate(${instance.rotation}deg) scale(${instance.scale})`,
        "--card-control-counter-rotation": `${-instance.rotation}deg`,
        "--play-card-state-color": stateAppearance?.描边颜色,
      } as CSSProperties}
      onPointerDown={(event) => onPointerDown(event, instance)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(event) => onContextMenu(event, instance)}
      aria-label={name}
      aria-describedby={stateBadgeId}
    >
      <button
        className="play-card-delete"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          deleteCardInstance(instance.instanceId);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={`删除 ${name}`}
      >
        <X aria-hidden="true" size={14} />
      </button>
      <CardIndicatorColumn instance={instance} />
      <CardFace definition={definition} definitionRef={instance.definitionRef} module={module} presentation={presentation} fallbackName={name} />
      {stateAppearance ? <CardStateBadge id={stateBadgeId} label={stateAppearance.徽标} /> : null}
    </article>
  );
}
