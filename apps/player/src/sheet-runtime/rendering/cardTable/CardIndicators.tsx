import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { readCardIndicators, type CardInstance } from "../../domain/cardEngine";
import { useRuntimeStore } from "../../store/runtimeStore";
import { usePointerActions } from "../usePointerActions";

const cardIndicatorColorNames = ["青色", "红色", "金色", "绿色", "蓝色", "紫色", "粉色", "灰色", "橙色", "湖蓝色"] as const;

export function CardIndicatorColumn({ instance }: { instance: CardInstance }) {
  const transitionCardIndicator = useRuntimeStore((state) => state.transitionCardIndicator);

  return (
    <div className="card-indicator-column" data-part="indicator-column">
      {readCardIndicators(instance).map((indicator) => (
        <CardIndicatorBadge
          key={indicator.indicatorId}
          colorIndex={indicator.colorIndex}
          colorName={cardIndicatorColorNames[indicator.colorIndex] ?? `颜色 ${indicator.colorIndex + 1}`}
          count={indicator.value}
          onIncrement={() => transitionCardIndicator(instance.instanceId, indicator.indicatorId, "increment")}
          onDecrement={() => transitionCardIndicator(instance.instanceId, indicator.indicatorId, "decrement")}
        />
      ))}
    </div>
  );
}

function CardIndicatorBadge({
  colorIndex,
  colorName,
  count,
  onIncrement,
  onDecrement,
}: {
  colorIndex: number;
  colorName: string;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const pointerActions = usePointerActions(onIncrement, onDecrement, true);
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "+" || event.key === "ArrowUp") {
      event.preventDefault();
      onIncrement();
    } else if (event.key === "-" || event.key === "ArrowDown") {
      event.preventDefault();
      onDecrement();
    }
  };

  return (
    <button
      className="card-indicator-badge"
      data-part="indicator"
      data-color-index={colorIndex}
      type="button"
      title={`${colorName}指示物：${count}；左键增加，右键减少`}
      aria-label={`${colorName}指示物：${count}；左键增加，右键减少${count === 0 ? "，再次减少会移除" : ""}`}
      onClick={(event) => { event.stopPropagation(); pointerActions.onClick(event); }}
      onContextMenu={(event) => { event.stopPropagation(); pointerActions.onContextMenu?.(event); }}
      onPointerDown={(event) => { event.stopPropagation(); pointerActions.onPointerDown?.(event); }}
      onPointerMove={pointerActions.onPointerMove}
      onPointerUp={pointerActions.onPointerUp}
      onPointerCancel={pointerActions.onPointerCancel}
      onPointerLeave={pointerActions.onPointerLeave}
      onKeyDown={onKeyDown}
    >
      <span className="card-indicator-count" aria-hidden="true">{count}</span>
    </button>
  );
}
