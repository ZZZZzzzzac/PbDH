import { Component, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  prepareCanonicalSurface,
  canonicalCardDesignSize,
  usesFixedSurfaceRatio,
  type ManagedAsset,
  type RendererRevisionCapability,
  type SurfaceResource,
  type SurfaceAttribution,
} from "./core.ts";
import { useContainerTextFit } from "./text-fit.ts";

export {
  RestrictedMarkdown,
  RestrictedMarkdownRenderer,
  type RestrictedMarkdownProps,
} from "./RestrictedMarkdown.tsx";
export {
  findLargestFittingFontSize,
  fitContainerText,
  resetContainerTextFit,
  useContainerTextFit,
  type ContainerTextFitOptions,
  type FontSizeFitResult,
} from "./text-fit.ts";

const boundaryStyles = `
:host {
  all: initial;
  display: block;
  contain: layout paint style;
  color-scheme: light;
  --restricted-markdown-red: #a8443e;
  --restricted-markdown-orange: #a35f24;
  --restricted-markdown-yellow: #8a741f;
  --restricted-markdown-green: #39704f;
  --restricted-markdown-blue: #356a83;
  --restricted-markdown-purple: #71558a;
  --restricted-markdown-gray: #667074;
}
*, *::before, *::after { box-sizing: border-box; }
.pbdh-surface-root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
}
.pbdh-surface-root.is-fluid { height: auto; overflow: visible; }
.pbdh-surface-status {
  width: 100%;
  height: 100%;
  display: grid;
  place-content: center;
  gap: 2px;
  padding: 5px;
  border: 0.35px solid #6f6559;
  background: #e8e0d3;
  color: #2b2520;
  font: 600 3.2px/1.35 Georgia, serif;
  text-align: center;
}
.pbdh-surface-status code { font: 500 2.5px/1.4 Consolas, monospace; }
[data-restricted-markdown] { min-width: 0; }
[data-restricted-markdown] :is(p, ul, ol) { margin: 0; }
[data-restricted-markdown] :is(ul, ol) { padding-inline-start: 1.25em; }
[data-restricted-markdown] li + li { margin-top: .2em; }
[data-restricted-markdown] > :first-child { margin-top: 0; }
[data-restricted-markdown] > :last-child { margin-bottom: 0; }
.restricted-markdown-color[data-markdown-color="red"] { color: var(--restricted-markdown-red); }
.restricted-markdown-color[data-markdown-color="orange"] { color: var(--restricted-markdown-orange); }
.restricted-markdown-color[data-markdown-color="yellow"] { color: var(--restricted-markdown-yellow); }
.restricted-markdown-color[data-markdown-color="green"] { color: var(--restricted-markdown-green); }
.restricted-markdown-color[data-markdown-color="blue"] { color: var(--restricted-markdown-blue); }
.restricted-markdown-color[data-markdown-color="purple"] { color: var(--restricted-markdown-purple); }
.restricted-markdown-color[data-markdown-color="gray"] { color: var(--restricted-markdown-gray); }
.pbdh-card-footer { box-sizing: border-box; width: 100%; min-width: 0; min-height: clamp(3.5px, 5.5cqw, 20px); flex: none; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; gap: clamp(2px, 3.3cqw, 12px); padding: clamp(.5px, .85cqw, 3px) clamp(2px, 3.3cqw, 12px); font: italic 550 clamp(1.5px, 2.4cqw, 8.5px)/1.15 "Noto Sans SC", sans-serif; letter-spacing: .01em; }
.pbdh-card-footer span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pbdh-card-footer span:last-child { text-align: right; }
@media print {
  :host { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

export function CardFooter({ attribution, overlay = false }: {
  attribution: SurfaceAttribution;
  overlay?: boolean;
}) {
  const artworkCredit = attribution.artworkCredit.trim();
  const sourceLabel = attribution.sourceLabel.trim();
  if (!artworkCredit && !sourceLabel) return null;
  return <footer className={`pbdh-card-footer${overlay ? " is-overlay" : ""}`} data-card-footer="true">
    <span>{artworkCredit}</span><span>{sourceLabel}</span>
  </footer>;
}

export function TextFitContainer({
  className,
  contentKey,
  enabled,
  minFontSizePx = 11,
  maxFontSizePx = 15,
  cssVariable = "--pbdh-card-content-font-size",
  children,
}: {
  className?: string;
  contentKey: string;
  enabled: boolean;
  minFontSizePx?: number;
  maxFontSizePx?: number;
  cssVariable?: `--${string}`;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useContainerTextFit(containerRef, contentKey, { enabled, minFontSizePx, maxFontSizePx, cssVariable });
  return <div className={className} ref={containerRef}>{children}</div>;
}

export function SingleLineTextFit({
  className,
  contentKey,
  minFontSizePx,
  maxFontSizePx,
  cssVariable,
  children,
}: {
  className?: string;
  contentKey: string;
  minFontSizePx: number;
  maxFontSizePx: number;
  cssVariable: `--${string}`;
  children: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useContainerTextFit(headingRef, contentKey, {
    axis: "inline",
    minFontSizePx,
    maxFontSizePx,
    cssVariable,
  });
  return <h1 ref={headingRef} className={className} data-single-line-text-fit="true">{children}</h1>;
}

export type CanonicalCardSurfaceProps<TData, TState> = {
  resource: SurfaceResource<TData>;
  expectedRendererRevision: string;
  renderer?: RendererRevisionCapability<TData, TState, ReactNode>;
  assets: ReadonlyMap<string, ManagedAsset>;
  state?: unknown;
  onStateCommand?: (commandId: string, value: string) => void;
  label?: string;
};

export type CanonicalCardCoverSvg = {
  svg: string;
  width: number;
  height: number;
};

export type CanonicalCardCoverWebp = {
  blob: Blob;
  bytes: Uint8Array;
  width: number;
  height: number;
};

const coverPixelsPerDesignUnit = 10;

const previewStyles = `
[data-pbdh-card-preview-backdrop] {
  position: fixed;
  z-index: 160;
  inset: 0;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 20px 64px 20px 20px;
  background: rgba(15, 20, 22, .74);
}
[data-pbdh-card-preview-dialog] {
  position: relative;
  width: min(var(--pbdh-preview-width), calc((100vh - 40px) * var(--pbdh-preview-ratio)), calc(100vw - 84px));
  aspect-ratio: var(--pbdh-preview-ratio);
}
[data-pbdh-card-preview-stage] {
  position: absolute;
  inset: 0;
  display: grid;
  overflow: hidden;
}
[data-pbdh-card-preview-close] {
  position: absolute;
  z-index: 2;
  top: 0;
  right: -44px;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: #fffdf8;
  background: rgba(33, 21, 15, .92);
  box-shadow: 0 3px 12px rgba(0, 0, 0, .34);
  cursor: pointer;
  font: 24px/1 system-ui, sans-serif;
}
[data-pbdh-card-preview-close]:hover { background: #641f1d; }
@media print { [data-pbdh-card-preview-backdrop] { display: none !important; } }
`;

export function CardDisplay({
  designWidth = canonicalCardDesignSize.width,
  designHeight,
  fixedRatio = true,
  displayWidth = "100%",
  displayAspectRatio,
  fit = "cover",
  children,
}: {
  designWidth?: number;
  designHeight: number;
  fixedRatio?: boolean;
  displayWidth?: CSSProperties["width"];
  displayAspectRatio?: number;
  fit?: "cover" | "contain";
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const safeWidth = Number.isFinite(designWidth) && designWidth > 0
    ? designWidth
    : canonicalCardDesignSize.width;
  const [measuredHeight, setMeasuredHeight] = useState(designHeight);
  const safeHeight = fixedRatio
    ? canonicalCardDesignSize.height
    : (Number.isFinite(measuredHeight) && measuredHeight > 0
        ? measuredHeight
        : canonicalCardDesignSize.height);
  const safeDisplayAspectRatio = fixedRatio && Number.isFinite(displayAspectRatio) && Number(displayAspectRatio) > 0
    ? Number(displayAspectRatio)
    : safeWidth / safeHeight;
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const resize = () => {
      const widthScale = frame.clientWidth / safeWidth;
      const heightScale = frame.clientHeight / safeHeight;
      const next = fit === "contain" ? Math.min(widthScale, heightScale) : Math.max(widthScale, heightScale);
      setScale(Math.max(0.01, next));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    resize();
    return () => observer.disconnect();
  }, [fit, safeHeight, safeWidth]);

  useLayoutEffect(() => {
    if (fixedRatio) {
      setMeasuredHeight(canonicalCardDesignSize.height);
      return;
    }
    const content = innerRef.current?.firstElementChild as HTMLElement | null;
    if (!content) return;
    const update = () => setMeasuredHeight(Math.max(content.offsetHeight, content.scrollHeight, designHeight));
    const observer = new ResizeObserver(update);
    observer.observe(content);
    update();
    return () => observer.disconnect();
  }, [children, designHeight, fixedRatio]);

  return <div
    ref={frameRef}
    data-pbdh-card-display=""
    style={{ position: "relative", width: displayWidth, aspectRatio: safeDisplayAspectRatio, overflow: "hidden" }}
  >
    <div ref={innerRef} data-pbdh-card-display-inner="" style={{
      position: "absolute",
      left: "50%",
      top: "50%",
      width: `${safeWidth}px`,
      height: `${safeHeight}px`,
      transform: `translate(-50%, -50%) scale(${scale})`,
      transformOrigin: "center",
    }}>
      {children}
    </div>
  </div>;
}

export function CardPreviewDialog({
  designWidth = canonicalCardDesignSize.width,
  designHeight,
  fixedRatio = true,
  label,
  onClose,
  children,
}: {
  designWidth?: number;
  designHeight: number;
  fixedRatio?: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const safeWidth = Number.isFinite(designWidth) && designWidth > 0
    ? designWidth
    : canonicalCardDesignSize.width;
  const safeHeight = fixedRatio
    ? canonicalCardDesignSize.height
    : (Number.isFinite(designHeight) && designHeight > 0
        ? designHeight
        : canonicalCardDesignSize.height);
  const displayWidth = 480;
  const displayAspectRatio = 63 / 88;
  const dialog = <div data-pbdh-card-preview-backdrop="" onClick={onClose}>
    <style>{previewStyles}</style>
    <section
      data-pbdh-card-preview-dialog=""
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={{
        "--pbdh-preview-width": `${displayWidth}px`,
        "--pbdh-preview-ratio": displayAspectRatio,
      } as CSSProperties}
      onClick={(event) => event.stopPropagation()}
    >
      <button data-pbdh-card-preview-close="" type="button" aria-label="关闭卡牌详情" onClick={onClose}>×</button>
      <div data-pbdh-card-preview-stage=""><CardDisplay
        designWidth={safeWidth}
        designHeight={safeHeight}
        fixedRatio={fixedRatio}
        displayAspectRatio={displayAspectRatio}
        fit="contain"
      >{children}</CardDisplay></div>
    </section>
  </div>;
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}

export async function buildCanonicalCardCoverSvg<TData, TState>(
  props: CanonicalCardSurfaceProps<TData, TState>,
  pixelsPerDesignUnit = coverPixelsPerDesignUnit,
): Promise<CanonicalCardCoverSvg> {
  const resource = {
    ...props.resource,
    presentation: { ...props.resource.presentation, fixedRatio: true },
  };
  const prepared = prepareCanonicalSurface({ ...props, resource });
  if (prepared.status !== "ready") {
    throw new Error(prepared.diagnostics.map((item) => item.code).join(", ") || "renderer.cover.unavailable");
  }
  const designWidth = canonicalCardDesignSize.width;
  const designHeight = canonicalCardDesignSize.height;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(<>
    <style>{boundaryStyles}</style>
    <style>{prepared.renderer.styles}</style>
    <div className="pbdh-surface-root">
      {prepared.renderer.render(prepared.renderInput)}
    </div>
  </>);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${designWidth}" height="${designHeight}" viewBox="0 0 ${designWidth} ${designHeight}">`,
    `<foreignObject width="${designWidth}" height="${designHeight}">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${designWidth}px;height:${designHeight}px;overflow:hidden">`,
    markup,
    "</div></foreignObject></svg>",
  ].join("");
  return {
    svg,
    width: Math.round(designWidth * pixelsPerDesignUnit),
    height: Math.round(designHeight * pixelsPerDesignUnit),
  };
}

export async function renderCanonicalCardCoverToWebp<TData, TState>(
  props: CanonicalCardSurfaceProps<TData, TState>,
  pixelsPerDesignUnit = coverPixelsPerDesignUnit,
): Promise<CanonicalCardCoverWebp> {
  const cover = await buildCanonicalCardCoverSvg(props, pixelsPerDesignUnit);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cover.svg)}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = cover.width;
  canvas.height = cover.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("renderer.cover.canvas-unavailable");
  context.drawImage(image, 0, 0, cover.width, cover.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob || blob.type !== "image/webp") throw new Error("renderer.cover.webp-unavailable");
  return {
    blob,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: cover.width,
    height: cover.height,
  };
}

class RendererBoundary extends Component<{
  resetKey: string;
  children: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: Readonly<{ resetKey: string; children: ReactNode }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return <div className="pbdh-surface-status" role="status">
        <span>无法呈现卡面</span>
        <code>renderer.render.failed</code>
      </div>;
    }
    return this.props.children;
  }
}

export function CanonicalCardSurface<TData, TState>(
  props: CanonicalCardSurfaceProps<TData, TState>,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
  const prepared = prepareCanonicalSurface(props);

  useEffect(() => {
    if (!hostRef.current) return;
    setShadowRoot(hostRef.current.shadowRoot ?? hostRef.current.attachShadow({ mode: "open" }));
  }, []);

  const fixedRatio = usesFixedSurfaceRatio(props.resource.presentation);
  const rendererResetKey = JSON.stringify([
    props.expectedRendererRevision,
    props.resource,
    props.state,
  ]);
  const content = prepared.status === "ready"
    ? prepared.renderer.render(prepared.renderInput)
    : (
      <div className="pbdh-surface-status" role="status">
        <span>{prepared.status === "loading" ? "媒体加载中" : "无法呈现卡面"}</span>
        {prepared.diagnostics.map((item) => <code key={`${item.code}:${item.location}`}>{item.code}</code>)}
      </div>
    );

  return (
    <div
      ref={hostRef}
      data-pbdh-canonical-surface=""
      aria-label={props.label ?? "Canonical Card Surface"}
      style={{ display: "block", width: "100%", height: "auto", aspectRatio: fixedRatio ? "63 / 88" : undefined }}
    >
      {shadowRoot && createPortal(
        <>
          <style>{boundaryStyles}</style>
          {prepared.status === "ready" && <style>{prepared.renderer.styles}</style>}
          <div className={`pbdh-surface-root${fixedRatio ? "" : " is-fluid"}`}>
            <RendererBoundary resetKey={rendererResetKey}>{content}</RendererBoundary>
          </div>
        </>,
        shadowRoot,
      )}
    </div>
  );
}
