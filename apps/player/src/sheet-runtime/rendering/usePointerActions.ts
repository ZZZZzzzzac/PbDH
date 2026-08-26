import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

const longPressDurationMs = 500;
const longPressMoveTolerancePx = 10;

export function usePointerActions(onClick: () => void, onContextAction: () => void, contextGestureEnabled: boolean) {
  const timerRef = useRef<number | null>(null);
  const contextResetTimerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const suppressContextMenuRef = useRef(false);

  const cancelPending = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    originRef.current = null;
  };

  useEffect(() => () => {
    cancelPending();
    if (contextResetTimerRef.current !== null) window.clearTimeout(contextResetTimerRef.current);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!contextGestureEnabled || event.pointerType !== "touch") return;
    cancelPending();
    originRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      suppressClickRef.current = true;
      suppressContextMenuRef.current = true;
      onContextAction();
      contextResetTimerRef.current = window.setTimeout(() => {
        suppressContextMenuRef.current = false;
        contextResetTimerRef.current = null;
      }, longPressDurationMs);
    }, longPressDurationMs);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const origin = originRef.current;
    if (!origin || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) <= longPressMoveTolerancePx) return;
    cancelPending();
  };

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick();
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!contextGestureEnabled) return;
    event.preventDefault();
    if (suppressContextMenuRef.current) {
      suppressContextMenuRef.current = false;
      return;
    }
    onContextAction();
  };

  return {
    onClick: handleClick,
    onContextMenu: contextGestureEnabled ? handleContextMenu : undefined,
    onPointerDown: contextGestureEnabled ? handlePointerDown : undefined,
    onPointerMove: contextGestureEnabled ? handlePointerMove : undefined,
    onPointerUp: contextGestureEnabled ? cancelPending : undefined,
    onPointerCancel: contextGestureEnabled ? cancelPending : undefined,
    onPointerLeave: contextGestureEnabled ? cancelPending : undefined,
  };
}
