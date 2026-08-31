import { createTabletopDocument } from "@pbdh/tabletop/core";
import { describe, expect, test } from "vitest";

import {
  fitGmTabletopViewport,
  gmTabletopZoomSteps,
  parseGmTabletopViewport,
  serializeGmTabletopViewport,
  stepGmTabletopViewportZoom,
  zoomGmTabletopViewportAt,
} from "../../apps/creator/src/workspace-prototype/gm-tabletop-viewport.ts";

describe("GM Tabletop viewport", () => {
  test("round-trips valid preferences and rejects unsupported zoom values", () => {
    const saved = { zoom: 1.25, pan: { x: -42, y: 17 } };
    expect(parseGmTabletopViewport(serializeGmTabletopViewport(saved))).toEqual(saved);
    expect(parseGmTabletopViewport('{"zoom":9,"pan":{"x":"bad","y":4}}')).toEqual({
      zoom: 0.8,
      pan: { x: 0, y: 4 },
    });
    expect(parseGmTabletopViewport("not-json")).toEqual({ zoom: 0.8, pan: { x: 0, y: 0 } });
  });

  test("zooms around the pointer without moving its world coordinate", () => {
    const current = { zoom: 0.8, pan: { x: 20, y: -10 } };
    const pointer = { x: 250, y: 180 };
    const before = {
      x: (pointer.x - current.pan.x) / current.zoom,
      y: (pointer.y - current.pan.y) / current.zoom,
    };
    const next = zoomGmTabletopViewportAt(current, pointer, 1.25);
    expect((pointer.x - next.pan.x) / next.zoom).toBeCloseTo(before.x);
    expect((pointer.y - next.pan.y) / next.zoom).toBeCloseTo(before.y);
  });

  test("uses only fixed zoom steps and resets an empty tabletop to 100%", () => {
    let viewport = { zoom: 0.8, pan: { x: 0, y: 0 } };
    for (let index = 0; index < 20; index += 1) {
      viewport = stepGmTabletopViewportZoom(viewport, { x: 0, y: 0 }, 1);
    }
    expect(viewport.zoom).toBe(gmTabletopZoomSteps.at(-1));

    const tabletop = createTabletopDocument("00000000-0000-7000-8000-000000000001", "空桌面");
    expect(fitGmTabletopViewport(tabletop, { width: 1200, height: 800 })).toEqual({
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
  });
});
