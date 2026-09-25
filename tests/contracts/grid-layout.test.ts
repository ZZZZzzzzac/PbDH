import { describe, expect, it } from "vitest";
import cases from "../../contracts/conformance/system-package-grid/1.0.0/cases.json";
import { validateGridLayout } from "../../apps/player/src/sheet-runtime/domain/gridLayoutContract";
import { gridSize } from "../../apps/player/src/sheet-runtime/domain/gridLayout";

describe("版本化格子布局契约", () => {
  for (const fixture of cases) it(fixture.name, () => expect(validateGridLayout(fixture.value)).toBe(fixture.valid));
  it("尺寸解析与直角旋转", () => {
    expect(gridSize("1×4", 90)).toEqual({ width: 4, height: 1 });
    expect(gridSize("大件")).toBeNull();
    expect(gridSize("0×2")).toBeNull();
    expect(gridSize("1×2 extra")).toBeNull();
  });
});
