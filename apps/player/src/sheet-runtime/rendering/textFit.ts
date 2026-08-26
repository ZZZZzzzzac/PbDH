import { useLayoutEffect, useState, type RefObject } from "react";
import { findLargestFittingFontSize, type FontSizeFitResult } from "./fontSizeFit";

export const minimumTextFontSizePx = 9;

export function fitTextContent(element: HTMLElement, minimumFontSizePx = minimumTextFontSizePx): FontSizeFitResult {
  return fitTextContentWithMeasure(
    element,
    minimumFontSizePx,
    () => element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1,
  );
}

export function fitSingleLineTextContent(element: HTMLElement, minimumFontSizePx = minimumTextFontSizePx): FontSizeFitResult {
  const content = element.querySelector<HTMLElement>('[data-restricted-markdown] > :first-child');
  return fitTextContentWithMeasure(
    element,
    minimumFontSizePx,
    () => (content?.scrollHeight ?? element.scrollHeight) <= element.clientHeight + 1
      && (content?.scrollWidth ?? element.scrollWidth) <= element.clientWidth + 1,
  );
}

function fitTextContentWithMeasure(element: HTMLElement, minimumFontSizePx: number, fits: () => boolean): FontSizeFitResult {
  element.style.removeProperty("font-size");
  const computedFontSizePx = Number.parseFloat(getComputedStyle(element).fontSize);
  const naturalFontSizePx = Number.isFinite(computedFontSizePx) && computedFontSizePx > 0 ? computedFontSizePx : 16;
  const maxFontSizePx = Math.max(minimumFontSizePx, naturalFontSizePx);
  const measuredResult = findLargestFittingFontSize({
    minFontSizePx: minimumFontSizePx,
    maxFontSizePx,
    fits: (fontSizePx) => {
      element.style.fontSize = `${fontSizePx}px`;
      return fits();
    },
  });
  const result = naturalFontSizePx < minimumFontSizePx
    ? { ...measuredResult, fitted: true }
    : measuredResult;

  if (!result.fitted) {
    element.style.removeProperty("font-size");
  } else {
    element.style.fontSize = `${result.fontSizePx}px`;
  }
  element.dataset.textFit = result.overflowing ? "overflow" : result.fitted ? "fitted" : "natural";
  element.dataset.textFitFontSize = String(result.fontSizePx);
  element.dataset.textFitPending = "false";
  return result;
}

export function useTextFit(
  ref: RefObject<HTMLElement | null>,
  contentKey: string,
  enabled: boolean,
  fit: (element: HTMLElement) => FontSizeFitResult = fitTextContent,
  reset: (element: HTMLElement) => void = resetTextFit,
): boolean {
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) {
      if (element) reset(element);
      setOverflowing(false);
      return;
    }

    let disposed = false;
    const runFit = () => {
      if (disposed || !element.isConnected) return;
      const result = fit(element);
      setOverflowing((current) => (current === result.overflowing ? current : result.overflowing));
    };
    const scheduleFit = () => {
      if (disposed) return;
      element.dataset.textFitPending = "true";
      scheduleFitTask(element, runFit);
    };

    scheduleFit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleFit);
    observer?.observe(element);
    if (!observer) window.addEventListener("resize", scheduleFit);
    document.fonts?.ready.then(scheduleFit).catch(() => undefined);

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("resize", scheduleFit);
      cancelFitTask(element);
    };
  }, [contentKey, enabled, fit, ref, reset]);

  return overflowing;
}

export async function waitForTextFits(root: ParentNode, timeoutMs = 750): Promise<void> {
  await document.fonts?.ready;
  const deadline = performance.now() + timeoutMs;
  while (root.querySelector('[data-text-fit-pending="true"]') && performance.now() < deadline) {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
}

export function resetTextFit(element: HTMLElement) {
  element.style.removeProperty("font-size");
  delete element.dataset.textFit;
  delete element.dataset.textFitFontSize;
  delete element.dataset.textFitPending;
}

type FitTask = () => void;
const scheduledFitTasks = new Map<HTMLElement, FitTask>();
let scheduledFrameId: number | null = null;

function scheduleFitTask(element: HTMLElement, task: FitTask) {
  scheduledFitTasks.set(element, task);
  if (scheduledFrameId !== null) return;
  scheduledFrameId = window.requestAnimationFrame(() => {
    scheduledFrameId = null;
    const tasks = [...scheduledFitTasks.values()];
    scheduledFitTasks.clear();
    tasks.forEach((scheduledTask) => scheduledTask());
  });
}

function cancelFitTask(element: HTMLElement) {
  scheduledFitTasks.delete(element);
  if (scheduledFitTasks.size === 0 && scheduledFrameId !== null) {
    window.cancelAnimationFrame(scheduledFrameId);
    scheduledFrameId = null;
  }
}
