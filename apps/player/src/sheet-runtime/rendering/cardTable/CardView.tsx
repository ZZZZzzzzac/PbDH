import { X } from "lucide-react";
import type { CSSProperties } from "react";
import type { CardInstance } from "../../domain/cardEngine";
import type { CardPresentation } from "../../domain/cardPresentation";
import type { ResourceLibraryEntry } from "../../domain/resourceLibrary";
import type { CardTableModule } from "../../domain/systemPackage";
import { useRuntimeStore } from "../../store/runtimeStore";
import { CardFace, CardStateBadge } from "./CardFace";
import { CardIndicatorColumn } from "./CardIndicators";
import { definitionReferenceId, resolveRenderedCardPresentation } from "./cardDefinition";

export function CardView({
  instance,
  definition,
  module,
  presentation,
}: {
  instance: CardInstance;
  definition?: ResourceLibraryEntry;
  module: CardTableModule;
  presentation?: CardPresentation;
}) {
  const deleteCardInstance = useRuntimeStore((state) => state.deleteCardInstance);
  const name = resolveRenderedCardPresentation(definition, module, presentation).name || definitionReferenceId(instance);
  const stateAppearance = module.状态外观?.[instance.state];
  const stateBadgeId = stateAppearance ? `card-state-${instance.instanceId}` : undefined;

  return (
    <article
      className={`play-card${stateAppearance ? " has-card-state-appearance" : ""}`}
      data-card-instance-id={instance.instanceId}
      data-card-state={instance.state}
      style={{
        "--card-control-counter-rotation": `${-instance.rotation}deg`,
        "--play-card-state-color": stateAppearance?.描边颜色,
      } as CSSProperties}
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
