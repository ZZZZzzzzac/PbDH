import { useEffect, useRef, useState, type ReactNode } from "react";

import { CanonicalCardSurface } from "@pbdh/resource-renderer/react";
import type { ManagedAsset, SurfaceResource } from "@pbdh/resource-renderer/core";
import { executeTemplateStateCommand } from "@pbdh/tabletop/core";
import type { TemplateFrontendCapability } from "@pbdh/templates/frontend";
import { templateRegistry, type TemplateCoreCapability } from "@pbdh/templates/core";

import { TemplateIcon } from "./TemplateIcon.tsx";
import type { WorkspaceResource } from "./workspace-model.ts";

type TemplateBoundResource = { template: { id: string; version: string } };

export function resourceTitle(resource: WorkspaceResource): string {
  const template = templateRegistry.resolve(resource.template.id, resource.template.version);
  return template?.project(resource.data).title ?? resource.id;
}

export function ResourceIcon({ resource }: { resource: TemplateBoundResource }) {
  return <TemplateIcon templateId={resource.template.id} />;
}

export function AutoFitPreview({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return;
    const fit = () => {
      const width = Math.max(card.scrollWidth, card.offsetWidth, 1);
      const height = Math.max(card.scrollHeight, card.offsetHeight, 1);
      const widthScale = (stage.clientWidth * 0.7) / width;
      const heightScale = (stage.clientHeight * 0.7) / height;
      setScale(Math.max(0, Math.min(widthScale, heightScale)));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    observer.observe(card);
    fit();
    return () => observer.disconnect();
  }, [children]);

  return <div ref={stageRef} className="preview-stage"><div ref={cardRef} className="card-scale" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>{children}</div></div>;
}

export function TemplateRuntimePreview({
  resource,
  assets,
  frontend,
  template,
}: {
  resource: WorkspaceResource;
  assets: ReadonlyMap<string, ManagedAsset>;
  frontend: TemplateFrontendCapability;
  template: TemplateCoreCapability<Record<string, unknown>>;
}) {
  const renderer = frontend.rendererRevision;
  const defaultState = () => template.tabletop.defaultState(resource.data as Record<string, unknown>);
  const [state, setState] = useState<Record<string, string>>(defaultState);

  useEffect(() => setState(defaultState()), [resource.id, resource.template.version]);

  function runCommand(commandId: string, value: string) {
    const definition = template.tabletop.commands.find((command) => command.id === commandId);
    setState((current) => executeTemplateStateCommand(
      current,
      definition,
      commandId,
      value,
    ).state);
  }

  return <div className="preview-runtime-surface">
    <AutoFitPreview>
      <CanonicalCardSurface
        resource={resource as unknown as SurfaceResource<Record<string, unknown>>}
        expectedRendererRevision={renderer.revision}
        renderer={renderer}
        assets={assets}
        state={state}
        onStateCommand={runCommand}
        label={`${String((resource.data as Record<string, unknown>).名称 ?? "未命名资源")}规范卡面`}
      />
    </AutoFitPreview>
  </div>;
}
