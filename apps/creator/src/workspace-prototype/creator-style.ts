import type { CSSProperties } from "react";

import type { CreatorAppMode } from "./creator-layout.tsx";
import { creatorWorkspaceDesign } from "./design.generated.ts";

export function creatorWorkspaceStyle(
  appMode: CreatorAppMode,
  workspaceColumnShare: number,
  editorColumnShare: number,
): CSSProperties {
  return {
    "--creator-appbar-height": `${creatorWorkspaceDesign.appBar.height}px`,
    "--creator-tabs-height": `${creatorWorkspaceDesign.tabs.height}px`,
    "--creator-nav-width": `${appMode === "creator"
      ? creatorWorkspaceDesign.columns.resourceNavigationWidth
      : creatorWorkspaceDesign.gmTabletop.resourceNavigationWidth}px`,
    "--creator-workspace-share": `${workspaceColumnShare}%`,
    "--creator-editor-share": `${editorColumnShare}%`,
    "--creator-body-gap": `${creatorWorkspaceDesign.columns.bodyGap}px`,
    "--creator-body-padding": `${creatorWorkspaceDesign.columns.bodyPadding}px`,
    "--creator-bg": creatorWorkspaceDesign.canvas.background,
    "--creator-appbar": creatorWorkspaceDesign.appBar.background,
    "--creator-appbar-border": creatorWorkspaceDesign.appBar.border,
    "--creator-panel": creatorWorkspaceDesign.panel.background,
    "--creator-border": creatorWorkspaceDesign.panel.border,
    "--creator-editor": creatorWorkspaceDesign.editor.background,
    "--creator-preview": creatorWorkspaceDesign.preview.background,
    "--creator-preview-border": creatorWorkspaceDesign.preview.border,
    "--creator-field-height": `${creatorWorkspaceDesign.field.height}px`,
    "--creator-field-bg": creatorWorkspaceDesign.field.background,
    "--creator-field-border": creatorWorkspaceDesign.field.border,
    "--creator-field-radius": `${creatorWorkspaceDesign.field.radius}px`,
    "--creator-group-bg": creatorWorkspaceDesign.field.groupBackground,
    "--creator-group-border": creatorWorkspaceDesign.field.groupBorder,
    "--creator-group-radius": `${creatorWorkspaceDesign.field.groupRadius}px`,
    "--creator-feature-bg": creatorWorkspaceDesign.feature.background,
    "--creator-feature-border": creatorWorkspaceDesign.feature.border,
    "--creator-preview-control": creatorWorkspaceDesign.previewControls.background,
    "--creator-preview-control-border": creatorWorkspaceDesign.previewControls.border,
    "--creator-preview-control-active": creatorWorkspaceDesign.previewControls.activeBackground,
    "--creator-preview-switch": creatorWorkspaceDesign.previewControls.switchBackground,
    "--creator-accent": creatorWorkspaceDesign.accent,
    "--creator-weapon-description-height": `${creatorWorkspaceDesign.weapon.descriptionInputHeight}px`,
    "--gm-tabs-height": `${creatorWorkspaceDesign.gmTabletop.tabs.height}px`,
    "--gm-tabs-bg": creatorWorkspaceDesign.gmTabletop.tabs.background,
    "--gm-tabs-border": creatorWorkspaceDesign.gmTabletop.tabs.border,
    "--gm-zoom-width": `${creatorWorkspaceDesign.gmTabletop.zoomStatus.width}px`,
    "--gm-zoom-height": `${creatorWorkspaceDesign.gmTabletop.zoomStatus.height}px`,
    "--gm-zoom-bg": creatorWorkspaceDesign.gmTabletop.zoomStatus.background,
    "--gm-zoom-border": creatorWorkspaceDesign.gmTabletop.zoomStatus.border,
    "--gm-instance-toolbar-height": `${creatorWorkspaceDesign.gmTabletop.instanceEditor.toolbarHeight}px`,
    "--gm-canvas-bg": creatorWorkspaceDesign.gmTabletop.canvas.background,
    "--gm-selected-border": creatorWorkspaceDesign.gmTabletop.canvas.selectedBorder,
    "--gm-canvas-menu-width": `${creatorWorkspaceDesign.gmTabletop.menus.canvasWidth}px`,
    "--gm-instance-menu-width": `${creatorWorkspaceDesign.gmTabletop.menus.instanceWidth}px`,
    "--cloud-local": creatorWorkspaceDesign.cloudDocuments.status.localForeground,
    "--cloud-pending": creatorWorkspaceDesign.cloudDocuments.status.pendingForeground,
    "--cloud-clean": creatorWorkspaceDesign.cloudDocuments.status.cleanForeground,
    "--cloud-conflict": creatorWorkspaceDesign.cloudDocuments.status.conflictForeground,
    "--cloud-sync-dialog-width": `${creatorWorkspaceDesign.cloudDocuments.dialogs.syncWidth}px`,
    "--cloud-conflict-dialog-width": `${creatorWorkspaceDesign.cloudDocuments.dialogs.conflictWidth}px`,
  } as CSSProperties;
}
