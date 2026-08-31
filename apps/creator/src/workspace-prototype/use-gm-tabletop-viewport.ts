import { useEffect, useRef, useState } from "react";

import type { TabletopDocumentModel } from "@pbdh/tabletop/core";

import {
  fitGmTabletopViewport,
  parseGmTabletopViewport,
  serializeGmTabletopViewport,
  stepGmTabletopViewportZoom,
  zoomGmTabletopViewportAt,
} from "./gm-tabletop-viewport.ts";

export function useGmTabletopViewport(
  tabletop: TabletopDocumentModel | undefined,
  enabled: boolean,
) {
  const [zoom, setZoomState] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const surfaceRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const loadedDocumentIdRef = useRef("");

  useEffect(() => {
    if (!tabletop?.id) return;
    const saved = parseGmTabletopViewport(localStorage.getItem(`pbdh:gm-tabletop-view:${tabletop.id}`));
    setZoomState(saved.zoom);
    setPan(saved.pan);
    loadedDocumentIdRef.current = tabletop.id;
  }, [tabletop?.id]);

  useEffect(() => {
    if (!tabletop?.id || loadedDocumentIdRef.current !== tabletop.id) return;
    localStorage.setItem(
      `pbdh:gm-tabletop-view:${tabletop.id}`,
      serializeGmTabletopViewport({ zoom, pan }),
    );
  }, [pan, tabletop?.id, zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !enabled) return;
    const zoomAtPointer = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const next = stepGmTabletopViewportZoom(
        { zoom, pan },
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        event.deltaY < 0 ? 1 : -1,
      );
      setZoomState(next.zoom);
      setPan(next.pan);
    };
    viewport.addEventListener("wheel", zoomAtPointer, { passive: false });
    return () => viewport.removeEventListener("wheel", zoomAtPointer);
  }, [enabled, pan, zoom]);

  function setZoom(nextZoom: number) {
    const viewport = viewportRef.current;
    const center = viewport
      ? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }
      : { x: 0, y: 0 };
    const next = zoomGmTabletopViewportAt({ zoom, pan }, center, nextZoom);
    setZoomState(next.zoom);
    setPan(next.pan);
  }

  function previewPan(nextPan: { x: number; y: number }) {
    if (!surfaceRef.current) return;
    surfaceRef.current.style.transform = `translate(${nextPan.x}px, ${nextPan.y}px) scale(${zoom})`;
  }

  function fit() {
    if (!tabletop) return;
    const viewport = viewportRef.current;
    if (!viewport) {
      setZoomState(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const next = fitGmTabletopViewport(tabletop, {
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    });
    setZoomState(next.zoom);
    setPan(next.pan);
  }

  return {
    snapshot: { zoom, pan },
    refs: { surface: surfaceRef, viewport: viewportRef },
    execute: { setZoom, setPan, previewPan, fit },
    contentWidth: () => (viewportRef.current?.clientWidth ?? 1200) / zoom,
  };
}
