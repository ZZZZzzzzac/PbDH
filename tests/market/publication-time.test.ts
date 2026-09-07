import { describe, expect, it } from "vitest";
import { publicationUpdateLabel } from "../../apps/market/src/publication-time.ts";

describe("publication update time", () => {
  const now = Date.parse("2026-09-07T12:00:00Z");
  it.each([
    ["2026-09-07T11:59:59Z", "刚刚更新"],
    ["2026-09-07T11:59:00Z", "1 分钟前更新"],
    ["2026-09-07T11:00:00Z", "1 小时前更新"],
    ["2026-09-06T12:00:00Z", "1 天前更新"],
    ["2026-09-05T12:00:00Z", "2 天前更新"],
    ["2026-09-07T19:59:00+08:00", "1 分钟前更新"],
    ["2026-09-07T12:01:00Z", "刚刚更新"],
    ["invalid", "更新时间未知"],
  ])("formats %s as %s", (timestamp, expected) => {
    expect(publicationUpdateLabel(timestamp, now)).toBe(expected);
  });
});
