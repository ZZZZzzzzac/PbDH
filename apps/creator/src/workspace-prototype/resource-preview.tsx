import { useEffect, useRef, useState, type ReactNode } from "react";

import { CanonicalCardSurface } from "@pbdh/resource-renderer/react";
import type { ManagedAsset, SurfaceResource } from "@pbdh/resource-renderer/core";
import { executeTemplateStateCommand } from "@pbdh/tabletop/core";
import { adversaryRendererFor } from "@pbdh/templates/frontend";
import { adversaryTemplate, templateRegistry, type AdversaryData } from "@pbdh/templates/core";

import { TemplateIcon } from "./TemplateIcon.tsx";
import type { WorkspaceResource } from "./workspace-model.ts";

type TemplateBoundResource = { template: { id: string; version: string } };

export function isTemplate(resource: TemplateBoundResource, template: { id: string; version: string }): boolean {
  return resource.template.id === template.id && resource.template.version === template.version;
}

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

export function AdversaryRuntimePreview({
  resource,
  assets,
}: {
  resource: SurfaceResource<AdversaryData> & { id: string };
  assets: ReadonlyMap<string, ManagedAsset>;
}) {
  const defaultState = () => adversaryTemplate.tabletop.defaultState(resource.data);
  const [state, setState] = useState<Record<string, string>>(defaultState);

  useEffect(() => setState(defaultState()), [resource.id, resource.template.version]);

  function runCommand(commandId: string, value: string) {
    const definition = adversaryTemplate.tabletop.commands.find((command) => command.id === commandId);
    setState((current) => executeTemplateStateCommand(
      current,
      definition,
      commandId,
      value,
    ).state);
  }

  return <div className="preview-runtime-surface">
    <div className="preview-runtime-controls" aria-label="桌面状态模拟">
      <span>生命 <b>{state.currentHp}</b></span>
      <button type="button" aria-label="模拟生命减少" onClick={() => runCommand("adjust-hp", "-1")}>−</button>
      <button type="button" aria-label="模拟生命增加" onClick={() => runCommand("adjust-hp", "1")}>＋</button>
      <span>压力 <b>{state.currentStress}</b></span>
      <button type="button" aria-label="模拟压力减少" onClick={() => runCommand("adjust-stress", "-1")}>−</button>
      <button type="button" aria-label="模拟压力增加" onClick={() => runCommand("adjust-stress", "1")}>＋</button>
      <button
        type="button"
        aria-pressed={state.focused === "true"}
        onClick={() => runCommand("set-focused", state.focused === "true" ? "false" : "true")}
      >聚焦</button>
      <input
        aria-label="模拟桌面备注"
        placeholder="桌面备注"
        value={state.notes}
        onChange={(event) => runCommand("set-notes", event.target.value)}
      />
      <button type="button" onClick={() => setState(defaultState())}>重置</button>
    </div>
    <AutoFitPreview>
      <CanonicalCardSurface
        resource={resource}
        expectedRendererRevision="enemy-card-r1"
        renderer={adversaryRendererFor(resource.template.version)}
        assets={assets}
        state={state}
        onStateCommand={runCommand}
        label={`${resource.data.名称 || "未命名敌人"}规范卡面`}
      />
    </AutoFitPreview>
  </div>;
}

