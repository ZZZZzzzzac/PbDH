import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { CharacterCreationGuide, GuideSession, GuideStep } from "../domain/characterCreationGuide";
import { RestrictedMarkdown } from "./RestrictedMarkdown";

interface GuideSpotlightProps {
  guide: CharacterCreationGuide;
  session: GuideSession;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
  onExit: () => void;
}

interface TargetState {
  element: HTMLElement | null;
  rect: DOMRect | null;
  unavailable: boolean;
}

interface PanelPosition {
  top: number;
  left: number;
}

const spotlightPadding = 6;
const guideMobileBreakpoint = "(max-width: 640px)";

export function GuideSpotlight({ guide, session, onPrevious, onNext, onFinish, onExit }: GuideSpotlightProps) {
  const step = guide.步骤[session.stepIndex];
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const warnedUnavailableStepRef = useRef<string | null>(null);
  const [interactionSurface, setInteractionSurface] = useState<HTMLElement | null>(() => findGuideInteractionSurface());
  const [targetState, setTargetState] = useState<TargetState>(() => resolveTargetState(step));
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const isMobile = useMediaQuery(guideMobileBreakpoint);

  useEffect(() => {
    const updateInteractionSurface = () => {
      const next = findGuideInteractionSurface();
      setInteractionSurface((current) => current === next ? current : next);
    };

    updateInteractionSurface();
    const observer = new MutationObserver(updateInteractionSurface);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  useLayoutEffect(() => {
    const guideTarget = findGuideTarget(step);
    const element = interactionSurface ?? guideTarget;
    if (!interactionSurface && guideTarget) {
      guideTarget.scrollIntoView({ block: "center", inline: "center" });
    }

    const updateTarget = () => {
      const next = resolveTargetState(step, interactionSurface);
      setTargetState(next);
      if (next.unavailable && step.目标 && warnedUnavailableStepRef.current !== step.ID) {
        warnedUnavailableStepRef.current = step.ID;
      }
    };

    updateTarget();
    const frame = window.requestAnimationFrame(updateTarget);
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    const observer = element && typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateTarget) : null;
    if (element) {
      observer?.observe(element);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
      observer?.disconnect();
    };
  }, [interactionSurface, step]);

  useLayoutEffect(() => {
    if (isMobile || !targetState.rect || targetState.unavailable) {
      setPanelPosition(null);
      return;
    }

    setPanelPosition(placePanel(targetState.rect, panelRef.current));
  }, [isMobile, session.stepIndex, targetState.rect, targetState.unavailable]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }
    return makeBackgroundInert(targetState.unavailable ? null : targetState.element, overlay);
  }, [targetState.element, targetState.unavailable]);

  useEffect(() => {
    if (interactionSurface) {
      return;
    }
    const primary = overlayRef.current?.querySelector<HTMLElement>("[data-guide-primary]");
    primary?.focus();
  }, [interactionSurface, session.stepIndex]);

  const isLastStep = session.stepIndex === guide.步骤.length - 1;
  const maskStyles = targetState.rect && !targetState.unavailable ? createMaskStyles(targetState.rect) : [fullViewportMask()];
  const panelStyle: CSSProperties = {
    ...(!isMobile ? { width: "fit-content" } : {}),
    ...(panelPosition ? { top: panelPosition.top, left: panelPosition.left } : {}),
  };
  const actionsStyle = placeActions(targetState.rect && !targetState.unavailable ? targetState.rect : null);
  const actions = (
    <div
      className={`guide-actions${!step.目标 ? " guide-actions-default" : ""}`}
      style={!step.目标 ? undefined : actionsStyle}
      role="toolbar"
      aria-label="车卡指引操作"
    >
      <button type="button" className="icon-button secondary-button" onClick={onExit} aria-label="退出车卡指引">
        退出
      </button>
      <button
        type="button"
        className="icon-button secondary-button"
        onClick={onPrevious}
        disabled={session.stepIndex === 0}
        aria-label="上一步"
      >
        上一步
      </button>
      {isLastStep ? (
        <button type="button" className="icon-button" onClick={onFinish} data-guide-primary aria-label="完成车卡指引">
          完成
        </button>
      ) : (
        <button type="button" className="icon-button" onClick={onNext} data-guide-primary aria-label="下一步">
          下一步
        </button>
      )}
    </div>
  );

  return createPortal(
    <div className="guide-spotlight-root" ref={overlayRef} data-guide-step-id={step.ID}>
      {maskStyles.map((style, index) => (
        <div className="guide-mask-region" style={style} key={index} aria-hidden="true" />
      ))}
      {targetState.rect && !targetState.unavailable ? (
        <div className="guide-target-ring" style={ringStyle(targetState.rect)} aria-hidden="true" />
      ) : null}
      {!interactionSurface && step.目标 ? actions : null}
      {!interactionSurface ? <section
        className={`guide-panel${isMobile ? " guide-panel-mobile" : ""}${!targetState.rect || targetState.unavailable ? " guide-panel-default" : ""}`}
        style={panelStyle}
        ref={panelRef}
        role="dialog"
        aria-label="车卡指引"
      >
        <div className="guide-step-content" aria-live="polite">
          <p className="guide-progress">
            {session.stepIndex + 1} / {guide.步骤.length}
          </p>
          <h2>{step.标题}</h2>
          <RestrictedMarkdown className="guide-instructions" value={step.说明} />
          {targetState.unavailable ? <p className="guide-target-unavailable" role="status">当前目标不可见，请先完成前置步骤。</p> : null}
        </div>
        {!step.目标 ? actions : null}
      </section> : null}
    </div>,
    document.body,
  );
}

function findGuideTarget(step: GuideStep): HTMLElement | null {
  if (!step.目标) {
    return null;
  }

  const { id, attribute } = step.目标.类型 === "module"
    // Uses data-module-slot-id (on the layout slot wrapper from SheetRenderer) over data-module-id
    // (on the module's internal container) because the slot wrapper is the stable layout boundary
    // for spotlight geometry.
    ? { id: step.目标.模块ID, attribute: "data-module-slot-id" }
    : step.目标.类型 === "page"
      ? { id: step.目标.页面ID, attribute: "data-template-page-id" }
      : { id: step.目标.区域ID, attribute: "data-guide-region-id" };
  return document.querySelector<HTMLElement>(`[${attribute}="${escapeAttributeValue(id)}"]`);
}

function findGuideInteractionSurface(): HTMLElement | null {
  const surfaces = document.querySelectorAll<HTMLElement>("[data-guide-interaction-surface]");
  return surfaces.item(surfaces.length - 1);
}

function resolveTargetState(step: GuideStep, interactionSurface: HTMLElement | null = null): TargetState {
  if (interactionSurface?.isConnected && isElementVisible(interactionSurface)) {
    return { element: interactionSurface, rect: interactionSurface.getBoundingClientRect(), unavailable: false };
  }
  if (!step.目标) {
    return { element: null, rect: null, unavailable: false };
  }

  const element = findGuideTarget(step);
  if (!element || !isElementVisible(element)) {
    return { element, rect: null, unavailable: true };
  }

  return { element, rect: element.getBoundingClientRect(), unavailable: false };
}

function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return element.isConnected && !element.hidden && style.display !== "none" && style.visibility !== "hidden";
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function createMaskStyles(rect: DOMRect): CSSProperties[] {
  const left = clamp(rect.left - spotlightPadding, 0, window.innerWidth);
  const right = clamp(rect.right + spotlightPadding, 0, window.innerWidth);
  const top = clamp(rect.top - spotlightPadding, 0, window.innerHeight);
  const bottom = clamp(rect.bottom + spotlightPadding, 0, window.innerHeight);

  return [
    { top: 0, left: 0, width: "100vw", height: top },
    { top, left: 0, width: left, height: Math.max(0, bottom - top) },
    { top, left: right, right: 0, height: Math.max(0, bottom - top) },
    { top: bottom, left: 0, right: 0, bottom: 0 },
  ];
}

function fullViewportMask(): CSSProperties {
  return { inset: 0 };
}

function ringStyle(rect: DOMRect): CSSProperties {
  const left = clamp(rect.left - spotlightPadding, 0, window.innerWidth);
  const top = clamp(rect.top - spotlightPadding, 0, window.innerHeight);
  const right = clamp(rect.right + spotlightPadding, 0, window.innerWidth);
  const bottom = clamp(rect.bottom + spotlightPadding, 0, window.innerHeight);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function placeActions(rect: DOMRect | null): CSSProperties {
  const margin = 8;
  if (!rect) {
    return { position: "fixed", top: margin, left: margin };
  }

  const estimatedHeight = 44;
  const estimatedWidth = 260;
  const outsideTop = rect.top - spotlightPadding - estimatedHeight - margin;
  return {
    position: "fixed",
    top: outsideTop >= margin ? outsideTop : clamp(rect.top + spotlightPadding, margin, window.innerHeight - estimatedHeight - margin),
    left: clamp(rect.left - spotlightPadding, margin, Math.max(margin, window.innerWidth - estimatedWidth - margin)),
  };
}

function placePanel(rect: DOMRect, panel: HTMLElement | null): PanelPosition {
  const margin = 12;
  const gap = 16;
  const width = panel?.offsetWidth || 360;
  const height = panel?.offsetHeight || 220;
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  const alignedLeft = clamp(rect.left, margin, maxLeft);

  if (rect.bottom + gap + height <= window.innerHeight - margin) {
    return { top: rect.bottom + gap, left: alignedLeft };
  }
  if (rect.top - gap - height >= margin) {
    return { top: rect.top - gap - height, left: alignedLeft };
  }
  if (rect.right + gap + width <= window.innerWidth - margin) {
    return { top: clamp(rect.top, margin, maxTop), left: rect.right + gap };
  }
  if (rect.left - gap - width >= margin) {
    return { top: clamp(rect.top, margin, maxTop), left: rect.left - gap - width };
  }

  return { top: clamp((window.innerHeight - height) / 2, margin, maxTop), left: clamp((window.innerWidth - width) / 2, margin, maxLeft) };
}

function makeBackgroundInert(target: HTMLElement | null, overlay: HTMLElement): () => void {
  const changed = new Map<HTMLElement, boolean>();
  const markInert = (element: HTMLElement) => {
    if (element === overlay || element.contains(overlay) || overlay.contains(element)) {
      return;
    }
    if (!changed.has(element)) {
      changed.set(element, element.inert);
    }
    element.inert = true;
  };

  if (!target) {
    const appRoot = document.querySelector<HTMLElement>(".app-shell");
    if (appRoot) {
      markInert(appRoot);
    }
  } else {
    let current: HTMLElement = target;
    while (current.parentElement) {
      const parent = current.parentElement;
      for (const sibling of [...parent.children]) {
        if (sibling !== current && sibling instanceof HTMLElement) {
          markInert(sibling);
        }
      }
      current = parent;
      if (parent === document.body) {
        break;
      }
    }
  }

  return () => {
    for (const [element, wasInert] of changed) {
      element.inert = wasInert;
    }
  };
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false));

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
