import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  prepareCanonicalSurface,
  type ManagedAsset,
  type RendererRevisionCapability,
  type SurfaceResource,
} from "./core.ts";

const boundaryStyles = `
:host {
  all: initial;
  display: block;
  contain: layout paint style;
  color-scheme: light;
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
  gap: 2mm;
  padding: 5mm;
  border: 0.35mm solid #6f6559;
  background: #e8e0d3;
  color: #2b2520;
  font: 600 3.2mm/1.35 Georgia, serif;
  text-align: center;
}
.pbdh-surface-status code { font: 500 2.5mm/1.4 Consolas, monospace; }
@media print {
  :host { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

export type CanonicalCardSurfaceProps<TData, TState> = {
  resource: SurfaceResource<TData>;
  expectedRendererRevision: string;
  renderer?: RendererRevisionCapability<TData, TState, ReactNode>;
  assets: ReadonlyMap<string, ManagedAsset>;
  state?: unknown;
  onStateCommand?: (commandId: string, value: string) => void;
  label?: string;
};

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

  const width = prepared.widthMm ?? 63;
  const height = prepared.heightMm ?? 88;
  const fixedRatio = props.resource.presentation.fixedRatio;
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
      style={{ display: "block", width: `${width}mm`, height: fixedRatio ? `${height}mm` : "auto" }}
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
