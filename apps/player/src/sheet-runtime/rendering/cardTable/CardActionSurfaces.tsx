import { CardPreviewDialog } from "@pbdh/resource-renderer/react";
import { canonicalCardDesignSize, usesFixedSurfaceRatio } from "@pbdh/resource-renderer/core";
import { TabletopContextMenu } from "@pbdh/tabletop/react";
import type { CSSProperties } from "react";
import { maxCardIndicators, readCardIndicators, type CardInstance } from "../../domain/cardEngine";
import type { CardPresentation } from "../../domain/cardPresentation";
import type { ResourceLibraryEntry } from "../../domain/resourceLibrary";
import type { CardTableModule } from "../../domain/systemPackage";
import { useRuntimeStore } from "../../store/runtimeStore";
import { CardFace, CardStateBadge } from "./CardFace";
import { definitionReferenceId, resolveRenderedCardPresentation } from "./cardDefinition";
import { cardReplacementOptions, cardReplacementTemplate } from "../../domain/cardReplacement";
import { readLoadedTemplateCore } from "@pbdh/templates/core/lazy";
import { useTemplateCore, TemplateLoadStatus } from "@pbdh/templates/frontend/lazy";

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
  const replaceCardInstance = useRuntimeStore((state) => state.replaceCardInstance);
  const characterData = useRuntimeStore((state) => state.characterData);
  const system = useRuntimeStore((state) => state.currentPackage);
  const reference = characterData && system && instance ? cardReplacementTemplate(characterData, system, instance.instanceId) : undefined;
  const core = useTemplateCore(reference?.id, reference?.version);

  if (!instance) return null;
  const nextState = nextCardState(stateOptions, instance.state);
  const replacements = characterData && system && core.value ? cardReplacementOptions(readLoadedTemplateCore, characterData, system, instance.instanceId) : [];

  return (
    <TabletopContextMenu className="card-context-menu" x={x} y={y} estimatedWidth={148} estimatedHeight={280} onClose={onClose}>
      <div data-guide-interaction-surface="true" data-output-exclude="true">
        <button type="button" role="menuitem" onClick={() => onViewDetail(instance.instanceId)}>查看详情</button>
      {canFlip ? (
        <button type="button" role="menuitem" onClick={() => { flipCardInstance(instance.instanceId); onClose(); }}>
          翻至{instance.face === "front" ? "背面" : "正面"}
        </button>
      ) : null}
      {reference && !core.value && <TemplateLoadStatus state={core} />}
      {replacements.map((replacement) => <button key={replacement.id} type="button" role="menuitem" disabled={!replacement.target} onClick={() => { replaceCardInstance(instance.instanceId, replacement.id); onClose(); }}>切换为{replacement.name}{replacement.target ? "" : "（资源缺失）"}</button>)}
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
    </TabletopContextMenu>
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
  return (
    <CardPreviewDialog
      designWidth={canonicalCardDesignSize.width}
      designHeight={canonicalCardDesignSize.height}
      fixedRatio={definition?.resourceCopy ? usesFixedSurfaceRatio(definition.resourceCopy.presentation) : true}
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
