import { fitTextContent, useTextFit } from "./textFit";

export const minimumMarkerFontSizePx = 5;

export function fitMarkerPresentation(element: HTMLElement) {
  return fitTextContent(element, minimumMarkerFontSizePx);
}

export function useMarkerPresentationFit(ref: React.RefObject<HTMLElement | null>, contentKey: string, enabled: boolean): void {
  useTextFit(ref, contentKey, enabled, fitMarkerPresentation);
}
