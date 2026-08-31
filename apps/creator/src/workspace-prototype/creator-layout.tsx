import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

export type CreatorAppMode = "creator" | "gm";

export const creatorColumnPreferences = {
  workspace: { key: "pbdh.creator.columns.workspace", initial: 30, min: 0, max: 45 },
  editor: { key: "pbdh.creator.columns.editor", initial: 3 / 7 * 100, min: 30, max: 65 },
} as const;

export function storedColumnShare(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === "undefined") return fallback;
  const storedValue = window.localStorage.getItem(key);
  if (storedValue === null) return fallback;
  const value = Number(storedValue);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function CreatorColumnResizeHandle({
  label,
  value,
  preference,
  cssVariable,
  onChange,
}: {
  label: string;
  value: number;
  preference: (typeof creatorColumnPreferences)[keyof typeof creatorColumnPreferences];
  cssVariable: "--creator-workspace-share" | "--creator-editor-share";
  onChange(value: number): void;
}) {
  const liveValueRef = useRef(value);
  useEffect(() => { liveValueRef.current = value; }, [value]);

  function update(next: number, commit: boolean) {
    const clamped = Math.min(preference.max, Math.max(preference.min, next));
    liveValueRef.current = clamped;
    document.querySelector<HTMLElement>(".creator-prototype")?.style.setProperty(cssVariable, `${clamped}%`);
    window.localStorage.setItem(preference.key, String(clamped));
    if (commit) onChange(clamped);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return;
    update((event.clientX - bounds.left) / bounds.width * 100, false);
  }

  function finish(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onChange(liveValueRef.current);
  }

  function adjustWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = value + (event.key === "ArrowLeft" ? -1 : 1);
    update(next, true);
  }

  return <div
    className="creator-column-resize-handle"
    role="separator"
    aria-label={label}
    aria-orientation="vertical"
    aria-valuemin={preference.min}
    aria-valuemax={preference.max}
    aria-valuenow={Math.round(value)}
    tabIndex={0}
    title="拖动调整宽度；方向键微调；双击恢复默认"
    onDoubleClick={() => {
      update(preference.initial, true);
    }}
    onKeyDown={adjustWithKeyboard}
    onPointerDown={(event) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={move}
    onPointerUp={finish}
    onPointerCancel={finish}
  ><i /></div>;
}

