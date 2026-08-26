import type { CountableResourceModule as CountableResourceModuleConfig } from "../domain/systemPackage";
import { canTransitionCountableState, transitionCountableState, type CountableDirection } from "../domain/countableState";
import { useRuntimeStore } from "../store/runtimeStore";
import { readCountableState } from "./moduleState";
import { useTextFit } from "./textFit";
import { usePointerActions } from "./usePointerActions";
import { clampInt } from "../utils";
import { useRef, useState, type CSSProperties } from "react";

interface CountableResourceModuleProps {
  module: CountableResourceModuleConfig;
}

type CountableState = { current: number; max: number | null };

export function CountableResourceModule({ module }: CountableResourceModuleProps) {
  const min = module.最小值 ?? 0;
  const step = module.步长 ?? 1;
  const editableMax = module.最大值可改 ?? false;
  const fallback: CountableState = {
    current: clampInt(module.默认值 ?? min, min, module.最大值 ?? null),
    max: module.最大值 ?? null,
  };

  const rawValue = useRuntimeStore((state) => state.characterData?.character.values[module.ID]);
  const updateModuleValue = useRuntimeStore((state) => state.updateModuleValue);
  const packageAssetUrls = useRuntimeStore((state) => state.packageAssetUrls);
  const state = readCountableState(rawValue, fallback);
  const max = state.max;
  const current = clampInt(state.current, min, max);

  const setState = (next: Partial<CountableState>) => {
    updateModuleValue(module.ID, { ...state, ...next });
  };
  const setCurrent = (nextCurrent: number) => setState({ current: clampInt(nextCurrent, min, max) });
  const setMax = (nextMax: number | null) => setState({ max: nextMax });
  const markerPresentation = module.显示方式 === "标记";
  const markerGroupRef = useRef<HTMLSpanElement>(null);
  const normalizedState = { current, max };
  const transitionConfig = { min, step, editableMax };
  const applyMarkerAction = (target: "current" | "maximum", direction: CountableDirection) => {
    const next = transitionCountableState(normalizedState, transitionConfig, target, direction);
    if (next.current !== current || next.max !== max) updateModuleValue(module.ID, next);
  };
  const canUseMarkerButton = (direction: CountableDirection) =>
    canTransitionCountableState(normalizedState, transitionConfig, "current", direction)
    || canTransitionCountableState(normalizedState, transitionConfig, "maximum", direction);
  const decrementPointerActions = usePointerActions(
    () => markerPresentation ? applyMarkerAction("current", "decrement") : setCurrent(current - step),
    () => applyMarkerAction("maximum", "decrement"),
    markerPresentation,
  );
  const incrementPointerActions = usePointerActions(
    () => markerPresentation ? applyMarkerAction("current", "increment") : setCurrent(current + step),
    () => applyMarkerAction("maximum", "increment"),
    markerPresentation,
  );
  useTextFit(
    markerGroupRef,
    `${module.标记尺寸 ?? ""}:${JSON.stringify(module.当前值标记)}:${current}:${JSON.stringify(module.剩余值标记)}:${max}`,
    markerPresentation,
  );

  const configuredStyles = {
    ...(module.标记尺寸 === undefined ? {} : { "--countable-marker-size": `${module.标记尺寸}px` }),
    ...(module.加减号字号 === undefined ? {} : { "--countable-stepper-font-size": `${module.加减号字号}px` }),
  } as CSSProperties;

  return (
    <div
      className="container"
      data-module-id={module.ID}
      data-module-type={module.类型}
      data-part="container"
      style={configuredStyles}
    >
      <div className="label" data-part="label">{module.标签}</div>
      <div className="counter" data-part="counter">
        <button
          className="button stepper"
          data-part="decrement-button"
          type="button"
          {...decrementPointerActions}
          disabled={markerPresentation ? !canUseMarkerButton("decrement") : current <= min}
          aria-label={`${module.标签}减少`}
        >
          -
        </button>
        {markerPresentation ? (
          <span
            ref={markerGroupRef}
            className="counter-value-group marker-group"
            data-part="marker-group"
            data-countable-unbounded={max === null ? "true" : undefined}
            role="img"
            aria-label={`${module.标签}：当前值 ${current}，${max === null ? "无上限" : `上限 ${max}`}`}
          >
            <span data-part="current-markers">
              {module.当前值标记 ? renderMarkerCells(module.当前值标记, current, "current", packageAssetUrls) : null}
            </span>
            <span data-part="remaining-markers">
              {module.剩余值标记 ? renderMarkerCells(module.剩余值标记, max === null ? 0 : Math.max(0, max - current), "remaining", packageAssetUrls) : null}
            </span>
          </span>
        ) : (
          <span className="counter-value-group" data-part="value-group">
            <input
              className="input number-input"
              data-part="input"
              inputMode="numeric"
              aria-label={module.标签}
              value={current}
              onChange={(event) => setCurrent(parseInteger(event.target.value, fallback.current))}
            />
            {max !== null ? (
              <span className="value" data-part="maximum">
                /{" "}
                {editableMax ? (
                  <input
                    className="input max-input"
                    data-part="maximum-input"
                    inputMode="numeric"
                    aria-label={`${module.标签}上限`}
                    value={max}
                    onChange={(event) => setMax(parseIntegerNullable(event.target.value))}
                  />
                ) : (
                  max
                )}
              </span>
            ) : null}
          </span>
        )}
        <button
          className="button stepper"
          data-part="increment-button"
          type="button"
          {...incrementPointerActions}
          disabled={markerPresentation ? !canUseMarkerButton("increment") : max !== null && current >= max}
          aria-label={`${module.标签}增加`}
        >
          +
        </button>
      </div>
    </div>
  );
}

type MarkerDescriptor = NonNullable<CountableResourceModuleConfig["当前值标记"]>;

function renderMarkerCells(
  marker: MarkerDescriptor,
  count: number,
  kind: "current" | "remaining",
  packageAssetUrls: Record<string, string>,
) {
  const markerKey = marker.类型 === "文字" ? marker.内容 : marker.资源路径;
  return Array.from({ length: count }, (_, index) => (
    <span
      key={`${kind}-${marker.类型}-${markerKey}-${index}`}
      className="marker-cell"
      data-part="marker"
      data-marker-kind={kind}
      data-marker-type={marker.类型 === "文字" ? "text" : "image"}
      aria-hidden="true"
    >
      {marker.类型 === "文字" ? (
        <span className="marker-glyph">{marker.内容}</span>
      ) : (
        <MarkerImage src={packageAssetUrls[marker.资源路径]} />
      )}
    </span>
  ));
}

function MarkerImage({ src }: { src?: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  if (!src || failedSrc === src) {
    return <span className="marker-glyph marker-image-fallback" data-part="marker-image-fallback">□</span>;
  }
  return (
    <img
      className="marker-glyph marker-image"
      data-part="marker-image"
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setFailedSrc(src)}
    />
  );
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntegerNullable(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
