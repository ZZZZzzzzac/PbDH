import { useLayoutEffect, type RefObject } from "react";

export type FontSizeFitResult = {
  fontSizePx: number;
  fitted: boolean;
  overflowing: boolean;
};

export type ContainerTextFitOptions = {
  enabled?: boolean;
  minFontSizePx: number;
  maxFontSizePx: number;
  cssVariable: `--${string}`;
};

const fitPrecisionPx = .25;
const overflowTolerancePx = 1;

export function findLargestFittingFontSize({
  minFontSizePx,
  maxFontSizePx,
  fits,
}: {
  minFontSizePx: number;
  maxFontSizePx: number;
  fits: (fontSizePx: number) => boolean;
}): FontSizeFitResult {
  const minimum = Math.min(minFontSizePx, maxFontSizePx);
  const maximum = Math.max(minFontSizePx, maxFontSizePx);

  if (fits(maximum)) return { fontSizePx: maximum, fitted: false, overflowing: false };
  if (!fits(minimum)) return { fontSizePx: minimum, fitted: true, overflowing: true };

  let lower = minimum;
  let upper = maximum;
  for (let iteration = 0; iteration < 12 && upper - lower > fitPrecisionPx; iteration += 1) {
    const midpoint = Math.floor(((lower + upper) / 2) / fitPrecisionPx) * fitPrecisionPx;
    if (midpoint <= lower) break;
    if (fits(midpoint)) lower = midpoint;
    else upper = midpoint;
  }
  return { fontSizePx: lower, fitted: true, overflowing: false };
}

export function fitContainerText(
  container: HTMLElement,
  options: Omit<ContainerTextFitOptions, "enabled">,
): FontSizeFitResult {
  const { cssVariable, minFontSizePx, maxFontSizePx } = options;
  const applyFontSize = (fontSizePx: number) => {
    container.style.setProperty(cssVariable, `${fontSizePx}px`);
  };
  const fits = (fontSizePx: number) => {
    applyFontSize(fontSizePx);
    return container.scrollHeight <= container.clientHeight + overflowTolerancePx
      && container.scrollWidth <= container.clientWidth + overflowTolerancePx;
  };
  const result = findLargestFittingFontSize({ minFontSizePx, maxFontSizePx, fits });

  if (result.fitted) applyFontSize(result.fontSizePx);
  else container.style.removeProperty(cssVariable);
  container.dataset.textFit = result.overflowing ? "overflow" : result.fitted ? "fitted" : "natural";
  container.dataset.textFitFontSize = String(result.fontSizePx);
  return result;
}

export function resetContainerTextFit(container: HTMLElement, cssVariable: `--${string}`): void {
  container.style.removeProperty(cssVariable);
  delete container.dataset.textFit;
  delete container.dataset.textFitFontSize;
}

export function useContainerTextFit(
  containerRef: RefObject<HTMLElement | null>,
  contentKey: string,
  {
    enabled = true,
    minFontSizePx,
    maxFontSizePx,
    cssVariable,
  }: ContainerTextFitOptions,
): void {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!enabled) {
      resetContainerTextFit(container, cssVariable);
      return;
    }

    let disposed = false;
    let frame = 0;
    const fit = () => {
      frame = 0;
      if (!disposed) fitContainerText(container, { minFontSizePx, maxFontSizePx, cssVariable });
    };
    const scheduleFit = () => {
      if (disposed || frame) return;
      if (typeof requestAnimationFrame === "undefined") {
        fit();
        return;
      }
      frame = requestAnimationFrame(fit);
    };

    fit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleFit);
    observer?.observe(container);
    if (typeof document !== "undefined" && document.fonts) void document.fonts.ready.then(scheduleFit);

    return () => {
      disposed = true;
      observer?.disconnect();
      if (frame && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(frame);
    };
  }, [containerRef, contentKey, cssVariable, enabled, maxFontSizePx, minFontSizePx]);
}
