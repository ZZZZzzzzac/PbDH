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
});

function createMeasuredContainer(scrollHeight: (fontSizePx: number) => number): HTMLElement {
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
    scrollWidth: 300,
    style,
    dataset,
  };
  return container as unknown as HTMLElement;
}
