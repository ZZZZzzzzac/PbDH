import { describe, expect, test } from "vitest";

import {
  findLargestFittingFontSize,
  fitContainerText,
  resetContainerTextFit,
} from "../../packages/resource-renderer/src/react.tsx";

describe("fixed-card container text fitting", () => {
  test("keeps the natural font size until the final container overflows", () => {
    const container = createMeasuredContainer(() => 180);

    const result = fitContainerText(container, {
      minFontSizePx: 11,
      maxFontSizePx: 15,
      cssVariable: "--feature-font-size",
    });

    expect(result).toEqual({ fontSizePx: 15, fitted: false, overflowing: false });
    expect(container.style.getPropertyValue("--feature-font-size")).toBe("");
    expect(container.dataset.textFit).toBe("natural");
  });

  test("uses one fitted font size only after the combined content exceeds the container", () => {
    const container = createMeasuredContainer((fontSizePx) => fontSizePx <= 12.5 ? 198 : 224);

    const result = fitContainerText(container, {
      minFontSizePx: 11,
      maxFontSizePx: 15,
      cssVariable: "--feature-font-size",
    });

    expect(result).toEqual({ fontSizePx: 12.5, fitted: true, overflowing: false });
    expect(container.style.getPropertyValue("--feature-font-size")).toBe("12.5px");
    expect(container.dataset.textFit).toBe("fitted");
  });

  test("reports overflow at the minimum and can restore natural layout", () => {
    const container = createMeasuredContainer(() => 240);

    expect(fitContainerText(container, {
      minFontSizePx: 11,
      maxFontSizePx: 15,
      cssVariable: "--feature-font-size",
    })).toEqual({ fontSizePx: 11, fitted: true, overflowing: true });
    expect(container.dataset.textFit).toBe("overflow");

    resetContainerTextFit(container, "--feature-font-size");
    expect(container.style.getPropertyValue("--feature-font-size")).toBe("");
    expect(container.dataset.textFit).toBeUndefined();
  });

  test("finds the largest quarter-pixel size that fits", () => {
    expect(findLargestFittingFontSize({
      minFontSizePx: 11,
      maxFontSizePx: 15,
      fits: (fontSizePx) => fontSizePx <= 13.25,
    })).toEqual({ fontSizePx: 13.25, fitted: true, overflowing: false });
  });

  test("single-line fitting ignores glyph height overflow and measures only inline width", () => {
    const container = createMeasuredContainer(() => 22, (fontSizePx) => fontSizePx <= 24 ? 300 : 340);

    expect(fitContainerText(container, {
      minFontSizePx: 18,
      maxFontSizePx: 36,
      cssVariable: "--title-font-size",
      axis: "inline",
    })).toEqual({ fontSizePx: 24, fitted: true, overflowing: false });
  });

  test("single-line fitting does not accept the one-pixel tolerance used by body containers", () => {
    const title = createMeasuredContainer(() => 22, (fontSizePx) => fontSizePx < 36 ? 300 : 301);
    expect(fitContainerText(title, {
      minFontSizePx: 18,
      maxFontSizePx: 36,
      cssVariable: "--title-font-size",
      axis: "inline",
    })).toEqual({ fontSizePx: 35.75, fitted: true, overflowing: false });

    const body = createMeasuredContainer(() => 180, () => 301);
    expect(fitContainerText(body, {
      minFontSizePx: 11,
      maxFontSizePx: 15,
      cssVariable: "--feature-font-size",
    })).toEqual({ fontSizePx: 15, fitted: false, overflowing: false });
  });
});

function createMeasuredContainer(
  scrollHeight: (fontSizePx: number) => number,
  scrollWidth: (fontSizePx: number) => number = () => 300,
): HTMLElement {
  const properties = new Map<string, string>();
  const dataset: Record<string, string> = {};
  const style = {
    setProperty: (name: string, value: string) => properties.set(name, value),
    removeProperty: (name: string) => properties.delete(name) ? "" : "",
    getPropertyValue: (name: string) => properties.get(name) ?? "",
  };
  const container = {
    clientHeight: 200,
    clientWidth: 300,
    get scrollHeight() {
      const value = properties.get("--feature-font-size");
      return scrollHeight(value ? Number.parseFloat(value) : 15);
    },
    get scrollWidth() {
      const value = properties.get("--title-font-size") ?? properties.get("--feature-font-size");
      return scrollWidth(value ? Number.parseFloat(value) : 15);
    },
    style,
    dataset,
  };
  return container as unknown as HTMLElement;
}
