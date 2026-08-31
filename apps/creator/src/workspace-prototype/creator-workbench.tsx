import type { SurfaceResource } from "@pbdh/resource-renderer/core";
import { CanonicalCardSurface } from "@pbdh/resource-renderer/react";
import { RESOURCE_PACKAGE_VERSION } from "@pbdh/contract-runtime";
import {
  adversaryRendererFor,
  armorRendererFor,
  environmentAuthoringLayout,
  environmentRendererFor,
  trustedAuthoringLayoutFor,
  trustedRendererFor,
  weaponRendererFor,
} from "@pbdh/templates/frontend";
import {
  adversaryTemplate,
  armorTemplate,
  environmentTemplate,
  weaponTemplate,
  type AdversaryData,
  type AdversaryFeature,
  type ArmorData,
  type EnvironmentData,
  type WeaponData,
} from "@pbdh/templates/core";

import { Icon } from "./creator-controls.tsx";
import { CreatorColumnResizeHandle, creatorColumnPreferences } from "./creator-layout.tsx";
import { AdversaryEditor, ArmorEditor, ReplacementEditor, StructuredEditor, WeaponEditor } from "./resource-authoring.tsx";
import { AdversaryRuntimePreview, AutoFitPreview, ResourceIcon, isTemplate, resourceTitle } from "./resource-preview.tsx";
import { adversaryData, armorData, weaponData, type CreatorWorkspace, type WorkspaceResource } from "./workspace-model.ts";

export type CreatorWorkbenchSnapshot = {
  workspaces: readonly CreatorWorkspace[];
  activeWorkspace?: CreatorWorkspace;
  activeResource?: WorkspaceResource;
  activeResourceId: string;
  openFeatureMenu: number | null;
  editorColumnShare: number;
  assetUrls: ReadonlyMap<string, string>;
};

export type CreatorWorkbenchCommand =
  | { type: "activate-resource" | "pin-resource" | "close-resource"; workspaceKey: string; resourceId: string }
  | { type: "request-cloud-edit" | "choose-portrait" }
  | { type: "set-editor-share"; value: number }
  | { type: "adversary-field"; field: Exclude<keyof AdversaryData, "特性">; value: string }
  | { type: "adversary-feature"; index: number; field: keyof AdversaryFeature; value: string }
  | { type: "add-feature" }
  | { type: "toggle-feature-menu"; index: number }
  | { type: "clear-feature" | "delete-feature"; index: number; name?: string }
  | { type: "weapon-field"; field: keyof WeaponData; value: string }
  | { type: "armor-field"; field: keyof ArmorData; value: string }
  | { type: "structured-value"; path: string; value: unknown }
  | { type: "replacement"; resourceId: string; replacementId: string; targetResourceId: string | null }
  | { type: "presentation-mode"; mode: "text" | "split" | "image" }
  | { type: "toggle-fixed-ratio" };

export function CreatorWorkbench({ snapshot, execute }: {
  snapshot: CreatorWorkbenchSnapshot;
  execute(command: CreatorWorkbenchCommand): void;
}) {
  const active = snapshot.activeWorkspace;
  const resource = snapshot.activeResource;
  const adversary = active && resource && isTemplate(resource, adversaryTemplate) ? adversaryData(active, resource.id) : undefined;
  const weapon = active && resource && isTemplate(resource, weaponTemplate) ? weaponData(active, resource.id) : undefined;
  const armor = active && resource && isTemplate(resource, armorTemplate) ? armorData(active, resource.id) : undefined;
  const environment = resource && isTemplate(resource, environmentTemplate)
    ? { ...resource, data: resource.data as EnvironmentData }
    : undefined;
  const referenceLayout = resource
    ? environment
      ? environmentAuthoringLayout
      : !adversary && !weapon && !armor
        ? trustedAuthoringLayoutFor(resource.template.id, resource.template.version)
        : undefined
    : undefined;
  const referenceRenderer = resource && !adversary && !weapon && !armor && !environment
    ? trustedRendererFor(resource.template.id, resource.template.version)
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
    {active && resource ? <div className={`workbench-body${armor ? " armor-workbench-body" : ""}`} onPointerDown={() => execute({ type: "pin-resource", workspaceKey: active.key, resourceId: resource.id })}>
      <div className="authoring-column" onFocusCapture={() => execute({ type: "request-cloud-edit" })} onBlurCapture={() => execute({ type: "request-cloud-edit" })}>
        {adversary && <AdversaryEditor
          data={adversary}
          openFeatureMenu={snapshot.openFeatureMenu}
          onField={(field, value) => execute({ type: "adversary-field", field, value })}
          onFeature={(index, field, value) => execute({ type: "adversary-feature", index, field, value })}
          onAddFeature={() => execute({ type: "add-feature" })}
          onToggleFeatureMenu={(index) => execute({ type: "toggle-feature-menu", index })}
          onClearFeature={(index) => execute({ type: "clear-feature", index })}
          onDeleteFeature={(index, name) => execute({ type: "delete-feature", index, name })}
        />}
        {adversary && active.document.contractVersion === RESOURCE_PACKAGE_VERSION && adversaryTemplate.tabletop.replacements.map((replacement) => <ReplacementEditor
          key={replacement.id}
          label={replacement.label}
          value={resource.replacements?.find((candidate) => candidate.replacementId === replacement.id)?.targetResourceId ?? ""}
          options={active.document.resources.filter((candidate) => candidate.id !== resource.id).map((candidate) => ({ id: candidate.id, name: resourceTitle(candidate) }))}
          onChange={(targetResourceId) => execute({ type: "replacement", resourceId: resource.id, replacementId: replacement.id, targetResourceId })}
        />)}
        {weapon && <WeaponEditor data={weapon} onField={(field, value) => execute({ type: "weapon-field", field, value })} />}
        {armor && <ArmorEditor data={armor} onField={(field, value) => execute({ type: "armor-field", field, value })} />}
        {referenceLayout && <StructuredEditor data={resource.data as Record<string, unknown>} layout={referenceLayout} onValue={(path, value) => execute({ type: "structured-value", path, value })} />}
      </div>

      <CreatorColumnResizeHandle label="调整编辑区与预览区宽度" value={snapshot.editorColumnShare} preference={creatorColumnPreferences.editor} cssVariable="--creator-editor-share" onChange={(value) => execute({ type: "set-editor-share", value })} />

      <aside className="preview-panel">
        <header><h1>实时预览</h1><div>
          <div className="card-mode" role="group" aria-label="卡面模式">{(["text", "split", "image"] as const).map((mode) => <button type="button" key={mode} aria-pressed={resource.presentation.mode === mode} onClick={() => execute({ type: "presentation-mode", mode })}>{{ text: "纯文字", split: "半图半文字", image: "纯图片" }[mode]}</button>)}</div>
          <button type="button" className="fixed-ratio" role="switch" aria-checked={resource.presentation.fixedRatio} onClick={() => execute({ type: "toggle-fixed-ratio" })}><span>固定比例</span><i /></button>
        </div></header>
        {adversary
          ? <AdversaryRuntimePreview resource={{ ...resource, data: adversary }} assets={previewAssets} />
          : <AutoFitPreview>
            {weapon && <CanonicalCardSurface resource={{ ...resource, data: weapon }} expectedRendererRevision={weaponTemplate.rendererRevision} renderer={weaponRendererFor(resource.template.version)} assets={previewAssets} label={`${weapon.名称 || "未命名武器"}规范卡面`} />}
            {armor && <CanonicalCardSurface resource={{ ...resource, data: armor }} expectedRendererRevision={armorTemplate.rendererRevision} renderer={armorRendererFor(resource.template.version)} assets={previewAssets} label={`${armor.名称 || "未命名护甲"}规范卡面`} />}
            {environment && <CanonicalCardSurface resource={environment} expectedRendererRevision={environmentTemplate.rendererRevision} renderer={environmentRendererFor(resource.template.version)} assets={previewAssets} label={`${environment.data.名称 || "未命名环境"}规范卡面`} />}
            {referenceRenderer && <CanonicalCardSurface resource={resource as unknown as SurfaceResource<Record<string, unknown>>} expectedRendererRevision={referenceRenderer.revision} renderer={referenceRenderer} assets={previewAssets} label={`${String((resource.data as Record<string, unknown>).名称 ?? "未命名资源")}规范卡面`} />}
          </AutoFitPreview>}
        <footer className="preview-media"><span className="media-icon"><Icon name="image" /></span><strong>{resource.media.portrait ? "已设置卡图" : "未设置卡图"}</strong><button type="button" onClick={() => execute({ type: "choose-portrait" })}><Icon name="image" />{resource.media.portrait ? "替换" : "添加"}</button></footer>
      </aside>
    </div> : <div className="closed-tabs-empty"><strong>没有打开的资源</strong></div>}
  </section>;
}
