const fontSizePrecisionPx = 0.25;
const maxFitIterations = 8;

export interface FontSizeFitResult {
  fontSizePx: number;
  fitted: boolean;
  overflowing: boolean;
}

export interface FindLargestFittingFontSizeInput {
  minFontSizePx: number;
  maxFontSizePx: number;
  fits: (fontSizePx: number) => boolean;
}

export function findLargestFittingFontSize(input: FindLargestFittingFontSizeInput): FontSizeFitResult {
  const minFontSizePx = roundToPrecision(Math.min(input.minFontSizePx, input.maxFontSizePx));
  const maxFontSizePx = roundToPrecision(Math.max(input.minFontSizePx, input.maxFontSizePx));

  if (input.fits(maxFontSizePx)) return { fontSizePx: maxFontSizePx, fitted: false, overflowing: false };
  if (!input.fits(minFontSizePx)) return { fontSizePx: minFontSizePx, fitted: true, overflowing: true };

  let low = minFontSizePx;
  let high = maxFontSizePx;
  let iterations = 0;
  while (high - low > fontSizePrecisionPx && iterations < maxFitIterations) {
    const midpoint = floorToPrecision((low + high) / 2);
    if (midpoint <= low || midpoint >= high) break;
    if (input.fits(midpoint)) low = midpoint;
    else high = midpoint;
    iterations += 1;
  }

  return { fontSizePx: low, fitted: true, overflowing: false };
}

function floorToPrecision(value: number): number {
  return Math.floor(value / fontSizePrecisionPx) * fontSizePrecisionPx;
}

function roundToPrecision(value: number): number {
  return Math.round(value / fontSizePrecisionPx) * fontSizePrecisionPx;
}
