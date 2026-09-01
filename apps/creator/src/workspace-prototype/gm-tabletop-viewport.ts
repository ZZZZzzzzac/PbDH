import { canonicalCardDesignSize } from "@pbdh/resource-renderer/core";
import type { TabletopDocumentModel } from "@pbdh/tabletop/core";

import { gmCardPixelsPerDesignUnit } from "./gm-tabletop-geometry.ts";

export type GmTabletopViewport = {
  zoom: number;
  pan: { x: number; y: number };
};

export const gmTabletopZoomSteps = [0.4, 0.5, 0.67, 0.8, 1, 1.25, 1.6] as const;
export const defaultGmTabletopViewport: GmTabletopViewport = { zoom: 0.8, pan: { x: 0, y: 0 } };

export function parseGmTabletopViewport(raw: string | null): GmTabletopViewport {
  if (!raw) return defaultGmTabletopViewport;
  try {
    const saved = JSON.parse(raw) as null | { zoom?: number; pan?: { x?: number; y?: number } };
    return {
      zoom: saved?.zoom && gmTabletopZoomSteps.includes(saved.zoom as never) ? saved.zoom : defaultGmTabletopViewport.zoom,
      pan: { x: Number(saved?.pan?.x) || 0, y: Number(saved?.pan?.y) || 0 },
    };
  } catch {
    return defaultGmTabletopViewport;
  }
}

export function serializeGmTabletopViewport(viewport: GmTabletopViewport): string {
  return JSON.stringify(viewport);
}

export function zoomGmTabletopViewportAt(
  viewport: GmTabletopViewport,
  pointer: { x: number; y: number },
  nextZoom: number,
): GmTabletopViewport {
  const world = {
    x: (pointer.x - viewport.pan.x) / viewport.zoom,
    y: (pointer.y - viewport.pan.y) / viewport.zoom,
  };
  return {
    zoom: nextZoom,
    pan: { x: pointer.x - world.x * nextZoom, y: pointer.y - world.y * nextZoom },
  };
}

export function stepGmTabletopViewportZoom(
  viewport: GmTabletopViewport,
  pointer: { x: number; y: number },
  direction: -1 | 1,
): GmTabletopViewport {
  const currentIndex = gmTabletopZoomSteps.reduce((best, step, index) =>
    Math.abs(step - viewport.zoom) < Math.abs(gmTabletopZoomSteps[best]! - viewport.zoom) ? index : best, 0);
  const nextIndex = Math.min(gmTabletopZoomSteps.length - 1, Math.max(0, currentIndex + direction));
  return zoomGmTabletopViewportAt(viewport, pointer, gmTabletopZoomSteps[nextIndex]!);
}

export function fitGmTabletopViewport(
  tabletop: TabletopDocumentModel,
  viewportSize: { width: number; height: number },
): GmTabletopViewport {
  if (tabletop.instances.length === 0) return { zoom: 1, pan: { x: 0, y: 0 } };
  const bounds = tabletop.instances.reduce((result, instance) => {
    const width = canonicalCardDesignSize.width * gmCardPixelsPerDesignUnit * instance.scale;
    const height = canonicalCardDesignSize.height * gmCardPixelsPerDesignUnit * instance.scale;
    return {
      left: Math.min(result.left, instance.position.x),
      top: Math.min(result.top, instance.position.y),
      right: Math.max(result.right, instance.position.x + width),
      bottom: Math.max(result.bottom, instance.position.y + height),
    };
  }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const required = Math.min(
    (viewportSize.width - 48) / Math.max(1, bounds.right - bounds.left),
    (viewportSize.height - 48) / Math.max(1, bounds.bottom - bounds.top),
  );
  const zoom = [...gmTabletopZoomSteps].reverse().find((step) => step <= required) ?? gmTabletopZoomSteps[0];
  return {
    zoom,
    pan: {
      x: (viewportSize.width - (bounds.right - bounds.left) * zoom) / 2 - bounds.left * zoom,
      y: (viewportSize.height - (bounds.bottom - bounds.top) * zoom) / 2 - bounds.top * zoom,
    },
  };
}
