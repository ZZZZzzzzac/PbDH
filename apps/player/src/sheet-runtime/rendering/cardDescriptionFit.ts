import type { RefObject } from "react";
import { findLargestFittingFontSize, type FontSizeFitResult } from "./fontSizeFit";
import { fitTextContent, resetTextFit, useTextFit, waitForTextFits } from "./textFit";

export { findLargestFittingFontSize } from "./fontSizeFit";
export type CardDescriptionFitResult = FontSizeFitResult;

export const minimumCardDescriptionFontSizePx = 9;

export function fitCardDescription(element: HTMLElement): CardDescriptionFitResult {
  const result = fitTextContent(element, minimumCardDescriptionFontSizePx);
  element.dataset.cardDescriptionFit = result.overflowing ? "overflow" : result.fitted ? "fitted" : "natural";
  element.dataset.cardDescriptionFontSize = String(result.fontSizePx);
  return result;
}

export function useCardDescriptionFit(ref: RefObject<HTMLElement | null>, contentKey: string, enabled: boolean): boolean {
  return useTextFit(ref, contentKey, enabled, fitCardDescription, resetCardDescriptionFit);
}

export async function waitForCardDescriptionFits(root: ParentNode, timeoutMs = 750): Promise<void> {
  await waitForTextFits(root, timeoutMs);
}

function resetCardDescriptionFit(element: HTMLElement) {
  resetTextFit(element);
  delete element.dataset.cardDescriptionFit;
  delete element.dataset.cardDescriptionFontSize;
}
