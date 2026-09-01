import { RESOURCE_PACKAGE_VERSION } from "@pbdh/contract-runtime";
import { resolveTemplateFrontend, TemplateAuthoringSurface } from "@pbdh/templates/frontend";
import { templateRegistry } from "@pbdh/templates/core";

import { Icon } from "./creator-controls.tsx";
import { CreatorColumnResizeHandle, creatorColumnPreferences } from "./creator-layout.tsx";
import { ReplacementEditor } from "./resource-authoring.tsx";
import { ResourceIcon, TemplateRuntimePreview, resourceTitle } from "./resource-preview.tsx";
import type { CreatorWorkspace, WorkspaceResource } from "./workspace-model.ts";

export type CreatorWorkbenchSnapshot = {
  workspaces: readonly CreatorWorkspace[];
  activeWorkspace?: CreatorWorkspace;
  activeResource?: WorkspaceResource;
  activeResourceId: string;
  editorColumnShare: number;
  assetUrls: ReadonlyMap<string, string>;
};

export type CreatorWorkbenchCommand =
  | { type: "activate-resource" | "pin-resource" | "close-resource"; workspaceKey: string; resourceId: string }
  | { type: "request-cloud-edit" | "choose-portrait" }
  | { type: "set-editor-share"; value: number }
  | { type: "authoring-value"; path: string; value: unknown }
  | { type: "replacement"; resourceId: string; replacementId: string; targetResourceId: string | null }
  | { type: "presentation-mode"; mode: "text" | "split" | "image" }
  | { type: "toggle-fixed-ratio" };

export function CreatorWorkbench({ snapshot, execute }: {
  snapshot: CreatorWorkbenchSnapshot;
  execute(command: CreatorWorkbenchCommand): void;
}) {
  const active = snapshot.activeWorkspace;
  const resource = snapshot.activeResource;
  const templateFrontend = resource
    ? resolveTemplateFrontend(resource.template.id, resource.template.version)
    : undefined;
  const template = resource
    ? templateRegistry.resolve(resource.template.id, resource.template.version)
    : undefined;
  const previewAssets = new Map(resource ? Object.values(resource.media).flatMap((id) => {
    const url = snapshot.assetUrls.get(id);
    return url ? [[id, { status: "ready" as const, url }] as const] : [];
  }) : []);

  return <section className="creator-workbench">
    <nav className="resource-tabs" aria-label="打开的资源">
      {snapshot.workspaces.flatMap((workspace) => workspace.openResourceIds.flatMap((resourceId) => {
        const candidate = workspace.document.resources.find((item) => item.id === resourceId);
        if (!candidate) return [];
        const current = workspace.key === active?.key && candidate.id === snapshot.activeResourceId;
        return <div className={`resource-tab${current ? " is-current" : ""}${candidate.id === workspace.previewResourceId ? " is-preview" : ""}`} key={`${workspace.key}:${candidate.id}`}>
          <button type="button" className="resource-tab-main" onClick={() => execute({ type: "activate-resource", workspaceKey: workspace.key, resourceId: candidate.id })} onDoubleClick={() => execute({ type: "pin-resource", workspaceKey: workspace.key, resourceId: candidate.id })}><ResourceIcon resource={candidate} /><span>{resourceTitle(candidate)}</span></button>
          <button type="button" className="resource-tab-close" aria-label={`关闭 ${resourceTitle(candidate)}`} onClick={() => execute({ type: "close-resource", workspaceKey: workspace.key, resourceId: candidate.id })}><Icon name="x" /></button>
        </div>;
      }))}
    </nav>
    {active && resource ? <div className="workbench-body" onPointerDown={() => execute({ type: "pin-resource", workspaceKey: active.key, resourceId: resource.id })}>
      <div className="authoring-column" onFocusCapture={() => execute({ type: "request-cloud-edit" })} onBlurCapture={() => execute({ type: "request-cloud-edit" })}>
        {templateFrontend && <TemplateAuthoringSurface
          authoring={templateFrontend.authoring}
          data={resource.data as Record<string, unknown>}
          onValue={(path, value) => execute({ type: "authoring-value", path, value })}
        />}
        {templateFrontend?.authoring.layout.replacements === "after" && active.document.contractVersion === RESOURCE_PACKAGE_VERSION && template?.tabletop.replacements.map((replacement) => <ReplacementEditor
          key={replacement.id}
          label={replacement.label}
          value={resource.replacements?.find((candidate) => candidate.replacementId === replacement.id)?.targetResourceId ?? ""}
          options={active.document.resources.filter((candidate) => candidate.id !== resource.id).map((candidate) => ({ id: candidate.id, name: resourceTitle(candidate) }))}
          onChange={(targetResourceId) => execute({ type: "replacement", resourceId: resource.id, replacementId: replacement.id, targetResourceId })}
        />)}
      </div>

      <CreatorColumnResizeHandle label="调整编辑区与预览区宽度" value={snapshot.editorColumnShare} preference={creatorColumnPreferences.editor} cssVariable="--creator-editor-share" onChange={(value) => execute({ type: "set-editor-share", value })} />

      <aside className="preview-panel">
        <header><h1>实时预览</h1><div>
          <div className="card-mode" role="group" aria-label="卡面模式">{(["text", "split", "image"] as const).map((mode) => <button type="button" key={mode} aria-pressed={resource.presentation.mode === mode} onClick={() => execute({ type: "presentation-mode", mode })}>{{ text: "纯文字", split: "半图半文字", image: "纯图片" }[mode]}</button>)}</div>
          <button type="button" className="fixed-ratio" role="switch" aria-checked={resource.presentation.fixedRatio} onClick={() => execute({ type: "toggle-fixed-ratio" })}><span>固定比例</span><i /></button>
        </div></header>
        {templateFrontend && template ? <TemplateRuntimePreview resource={resource} assets={previewAssets} frontend={templateFrontend} template={template} /> : null}
        <footer className="preview-media"><span className="media-icon"><Icon name="image" /></span><strong>{resource.media.portrait ? "已设置卡图" : "未设置卡图"}</strong><button type="button" onClick={() => execute({ type: "choose-portrait" })}><Icon name="image" />{resource.media.portrait ? "替换" : "添加"}</button></footer>
      </aside>
    </div> : <div className="closed-tabs-empty"><strong>没有打开的资源</strong></div>}
  </section>;
}
