import { useCallback, useEffect, useSyncExternalStore } from "react";
import { CanonicalCardSurface, type CanonicalCardSurfaceProps } from "@pbdh/resource-renderer/react";
import { usesFixedSurfaceRatio } from "@pbdh/resource-renderer/core";
import { templateRegistry } from "../core/index.ts";
import { authoringLoader, rendererLoader, type TemplateLoadSnapshot } from "./template-loaders.ts";

type VersionLoader<T> = {
  read(id: string, version: string): TemplateLoadSnapshot<T>;
  subscribe(id: string, version: string, callback: () => void): () => void;
  load(id: string, version: string): Promise<T | undefined>;
};

function useTemplateVersion<T>(loader: VersionLoader<T>, id = "", version = "") {
  const subscribe = useCallback((callback: () => void) => loader.subscribe(id, version, callback), [loader, id, version]);
  const read = useCallback(() => loader.read(id, version), [loader, id, version]);
  const snapshot = useSyncExternalStore(subscribe, read, read);
  const retry = useCallback(() => {
    // 失败通过共享状态展示给所有使用该版本的组件。
    void loader.load(id, version).catch(() => undefined);
  }, [loader, id, version]);
  useEffect(() => { if (id && version) retry(); }, [id, version, retry]);
  return { status: snapshot.status, value: snapshot.status === "ready" ? snapshot.value : undefined, retry };
}

export function useTemplateAuthoring(id?: string, version?: string) {
  return useTemplateVersion(authoringLoader, id, version);
}

export function TemplateLoadStatus({ state }: { state: { status: string; retry(): void } }) {
  if (state.status === "error") return <div role="alert">模板加载失败 <button type="button" onClick={state.retry}>重试</button></div>;
  return <div role="status">{state.status === "ready" ? "模板版本不可用" : "模板加载中…"}</div>;
}

export function LazyCanonicalCardSurface<TData, TState>(props: Omit<CanonicalCardSurfaceProps<TData, TState>, "renderer" | "expectedRendererRevision">) {
  const { id, version } = props.resource.template;
  const state = useTemplateVersion(rendererLoader, id, version);
  if (!state.value) return <div aria-label={props.label} style={{ width: "100%", aspectRatio: usesFixedSurfaceRatio(props.resource.presentation) ? "63 / 88" : undefined }}>
    <TemplateLoadStatus state={state} />
  </div>;
  return <CanonicalCardSurface {...props} renderer={state.value}
    expectedRendererRevision={templateRegistry.resolve(id, version)?.rendererRevision ?? ""} />;
}
