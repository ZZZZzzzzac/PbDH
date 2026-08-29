import { CardPreviewDialog } from "@pbdh/resource-renderer/react";
import type { CSSProperties } from "react";
import { maxCardIndicators, readCardIndicators, type CardInstance } from "../../domain/cardEngine";
import type { CardPresentation } from "../../domain/cardPresentation";
import type { ResourceLibraryEntry } from "../../domain/resourceLibrary";
import type { CardTableModule } from "../../domain/systemPackage";
import { useRuntimeStore } from "../../store/runtimeStore";
import { CardFace, CardStateBadge } from "./CardFace";
import { definitionReferenceId, resolveRenderedCardPresentation } from "./cardDefinition";

export function CardContextMenu({
  instance,
  canFlip,
  stateOptions,
  x,
  y,
  onClose,
  onViewDetail,
}: {
  instance?: CardInstance;
  canFlip: boolean;
  stateOptions: string[];
  x: number;
  y: number;
  onClose: () => void;
  onViewDetail: (instanceId: string) => void;
}) {
  const updateCardInstanceState = useRuntimeStore((state) => state.updateCardInstanceState);
  const flipCardInstance = useRuntimeStore((state) => state.flipCardInstance);
  const rotateCardInstance = useRuntimeStore((state) => state.rotateCardInstance);
  const setCardInstanceUpright = useRuntimeStore((state) => state.setCardInstanceUpright);
  const addCardIndicator = useRuntimeStore((state) => state.addCardIndicator);
  const deleteCardInstance = useRuntimeStore((state) => state.deleteCardInstance);

  if (!instance) return null;
  const nextState = nextCardState(stateOptions, instance.state);

  return (
    <div className="card-context-menu" data-guide-interaction-surface="true" data-output-exclude="true" style={{ left: x, top: y }} role="menu" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" role="menuitem" onClick={() => onViewDetail(instance.instanceId)}>查看详情</button>
      {canFlip ? (
        <button type="button" role="menuitem" onClick={() => { flipCardInstance(instance.instanceId); onClose(); }}>
          翻至{instance.face === "front" ? "背面" : "正面"}
        </button>
      ) : null}
      <button type="button" role="menuitem" onClick={() => { rotateCardInstance(instance.instanceId, 1); onClose(); }}>顺时针旋转 90°</button>
      {instance.rotation !== 0 ? (
        <button type="button" role="menuitem" onClick={() => { setCardInstanceUpright(instance.instanceId); onClose(); }}>恢复竖置</button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        disabled={readCardIndicators(instance).length >= maxCardIndicators}
        onClick={() => { addCardIndicator(instance.instanceId); onClose(); }}
      >
        {readCardIndicators(instance).length >= maxCardIndicators ? "指示物已满（10）" : "添加指示物"}
      </button>
      {nextState !== instance.state ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            updateCardInstanceState(instance.instanceId, nextState);
            onClose();
          }}
        >
          标记为{nextState}
        </button>
      ) : null}
      <button
        className="danger"
        type="button"
        role="menuitem"
        onClick={() => {
          deleteCardInstance(instance.instanceId);
          onClose();
        }}
      >
        删除
      </button>
    </div>
  );
}

export function CardDetailOverlay({
  instance,
  definition,
  module,
  presentation,
  onClose,
}: {
  instance?: CardInstance;
  definition?: ResourceLibraryEntry;
  module: CardTableModule;
  presentation?: CardPresentation;
  onClose: () => void;
}) {
  if (!instance) return null;

  const name = resolveRenderedCardPresentation(definition, module, presentation).name || definitionReferenceId(instance);
  const stateAppearance = module.状态外观?.[instance.state];
  const width = Number(definition?.resourceCopy?.presentation.width ?? 63);
  const height = Number(definition?.resourceCopy?.presentation.height ?? 88);
  return (
    <CardPreviewDialog
      width={width}
      height={height}
      fixedRatio={definition?.resourceCopy?.presentation.fixedRatio ?? true}
      label={`${name}详情`}
      onClose={onClose}
    >
      <div
        className={`card-detail-face${stateAppearance ? " has-card-state-appearance" : ""}`}
        data-card-state={instance.state}
        style={{ "--play-card-state-color": stateAppearance?.描边颜色 } as CSSProperties}
      >
        <CardFace definition={definition} definitionRef={instance.definitionRef} module={module} presentation={presentation} fallbackName={name} autoFitDescription={false} />
        {stateAppearance ? <CardStateBadge label={stateAppearance.徽标} /> : null}
      </div>
    </CardPreviewDialog>
  );
}

function nextCardState(stateOptions: string[], currentState: string): string {
  if (stateOptions.length === 0) return currentState;
  const currentIndex = stateOptions.indexOf(currentState);
  return stateOptions[(currentIndex + 1) % stateOptions.length] ?? stateOptions[0];
}
