import type { LocalDocumentSync } from "@pbdh/local-storage";
import { OperationStatus } from "@pbdh/platform-ui";
import type { ResourceFormatId } from "@pbdh/resource-conversion";

import {
  CloudSyncIndicator,
  Icon,
  TemplateMultiSelect,
} from "./creator-controls.tsx";
import { ResourceIcon, resourceTitle } from "./resource-preview.tsx";
import { TemplateIcon, templateMarkClassName } from "./TemplateIcon.tsx";
import { WorkspaceTree } from "./WorkspaceTree.tsx";
import type {
  CreatorWorkspace,
  WorkspaceNodeRef,
  WorkspaceResource,
} from "./workspace-model.ts";
import type { WorkspaceResourceSelection } from "./gm-tabletop-session.ts";

export type CreatorResourceExplorerSnapshot = {
  workspaces: readonly CreatorWorkspace[];
  activeWorkspaceKey: string;
  activeResourceId: string;
  activeResourceCount: number;
  operation: string | null;
  operationLabel?: string;
  search: string;
  templateOptions: readonly string[];
  templateFilters: readonly string[];
  filteredResources: ReadonlyArray<{ workspace: CreatorWorkspace; resource: WorkspaceResource }>;
  multiSelect: boolean;
  selectedResources: readonly WorkspaceResourceSelection[];
  sortDirection: "ascending" | "descending";
  expandedWorkspaceKeys: ReadonlySet<string>;
  sync: ReadonlyMap<string, LocalDocumentSync>;
  savingWorkspaceKey: string | null;
};

export type CreatorResourceExplorerCommand =
  | { type: "new-package" | "import-pbres" | "export-package" | "publish-package" | "new-resource" | "new-folder" | "toggle-multi-select" }
  | { type: "import-third-party"; formatId: Exclude<ResourceFormatId, "pbres"> }
  | { type: "set-search"; value: string }
  | { type: "set-template-filters"; value: string[] }
  | { type: "set-sort-direction"; value: "ascending" | "descending" }
  | { type: "activate-resource" | "pin-resource" | "toggle-resource-selection"; workspaceKey: string; resourceId: string }
  | { type: "open-resource-context"; workspaceKey: string; resourceId: string; x: number; y: number }
  | { type: "toggle-package"; workspaceKey: string }
  | { type: "open-workspace-context"; workspaceKey: string; x: number; y: number }
  | { type: "select-folder"; workspaceKey: string; folderId: string | null }
  | { type: "toggle-folder"; workspaceKey: string; folderId: string }
  | { type: "rename-folder"; workspaceKey: string; folderId: string; name: string }
  | { type: "move-node"; workspaceKey: string; node: WorkspaceNodeRef; parentId: string | null }
  | { type: "delete-node"; workspaceKey: string; node: WorkspaceNodeRef };

const thirdPartyFormats: Array<{ id: Exclude<ResourceFormatId, "pbres">; label: string }> = [
  { id: "zzz", label: "导入 ZZZ 格式" },
  { id: "rinkcx", label: "导入 Rink 格式" },
  { id: "dhsheet", label: "导入 dhsheet 格式" },
  { id: "kid", label: "导入不咕鸟格式" },
];

export function CreatorResourceExplorer({
  snapshot,
  execute,
}: {
  snapshot: CreatorResourceExplorerSnapshot;
  execute(command: CreatorResourceExplorerCommand): string | null | void;
}) {
  const filtering = Boolean(snapshot.search.trim() || snapshot.templateFilters.length > 0);
  const active = snapshot.workspaces.find((workspace) => workspace.key === snapshot.activeWorkspaceKey);
  const isSelected = (workspaceKey: string, resourceId: string) => snapshot.selectedResources.some(
    (selection) => selection.workspaceKey === workspaceKey && selection.resourceId === resourceId,
  );

  return <aside className="resource-explorer">
    <header className="explorer-toolbar"><strong>资源管理器</strong><div>
      <button type="button" title="新建资源包" aria-label="新建资源包" disabled={Boolean(snapshot.operation)} onClick={() => execute({ type: "new-package" })}><Icon name="packagePlus" /></button>
      <div className="explorer-import-menu">
        <button type="button" title="导入资源包" aria-label="导入资源包" aria-haspopup="menu" disabled={Boolean(snapshot.operation)}><Icon name="upload" /></button>
        <div className="explorer-import-menu-panel" role="menu">
          <button type="button" role="menuitem" disabled={Boolean(snapshot.operation)} onClick={() => execute({ type: "import-pbres" })}>导入 pbres 格式</button>
          {thirdPartyFormats.map((format) => <button key={format.id} type="button" role="menuitem" disabled={Boolean(snapshot.operation)} onClick={() => execute({ type: "import-third-party", formatId: format.id })}>{format.label}</button>)}
        </div>
      </div>
      <button type="button" title="导出资源包" aria-label="导出资源包" disabled={!active || Boolean(snapshot.operation)} onClick={() => execute({ type: "export-package" })}><Icon name="download" /></button>
      <button type="button" title="发布到资源市场" aria-label="发布到资源市场" disabled={!active || Boolean(snapshot.operation)} onClick={() => execute({ type: "publish-package" })}><Icon name="package" /></button>
      <button type="button" title="新建资源" aria-label="新建资源" disabled={!active || Boolean(snapshot.operation)} onClick={() => execute({ type: "new-resource" })}><Icon name="filePlus" /></button>
      <button type="button" title="新建文件夹" aria-label="新建文件夹" disabled={!active || Boolean(snapshot.operation)} onClick={() => execute({ type: "new-folder" })}><Icon name="folderPlus" /></button>
    </div></header>
    {snapshot.operation && snapshot.operationLabel && <div className="creator-operation-strip"><OperationStatus label={snapshot.operationLabel} size="regular" /></div>}
    <label className="explorer-search"><Icon name="search" /><input aria-label="筛选资源" placeholder="名称、目录、标签或资源包" value={snapshot.search} onChange={(event) => execute({ type: "set-search", value: event.currentTarget.value })} /></label>
    <div className="workspace-resource-filters">
      <TemplateMultiSelect options={snapshot.templateOptions} value={snapshot.templateFilters} onChange={(value) => execute({ type: "set-template-filters", value })} />
      <button type="button" className={snapshot.multiSelect ? "is-active" : ""} aria-pressed={snapshot.multiSelect} onClick={() => execute({ type: "toggle-multi-select" })}>
        多选{snapshot.multiSelect && snapshot.selectedResources.length > 0 ? `（${snapshot.selectedResources.length}）` : ""}
      </button>
      <button type="button" className="workspace-sort-button" aria-label={snapshot.sortDirection === "ascending" ? "按名称降序排列" : "按名称升序排列"} onClick={() => execute({ type: "set-sort-direction", value: snapshot.sortDirection === "ascending" ? "descending" : "ascending" })}>
        名称 {snapshot.sortDirection === "ascending" ? "↑" : "↓"}
      </button>
    </div>
    {filtering && <div className="workspace-resource-results resource-tree" aria-label="跨资源包筛选结果" role="tree">
      {snapshot.filteredResources.map(({ workspace, resource }) => {
        const selected = isSelected(workspace.key, resource.id);
        return <div className="workspace-tree-node" key={`${workspace.key}:${resource.id}`}>
          <div
            className={`file-row filtered-resource-row${workspace.key === active?.key && resource.id === snapshot.activeResourceId ? " is-current" : ""}${snapshot.multiSelect && selected ? " is-multi-selected" : ""}`}
            role="treeitem"
            aria-selected={snapshot.multiSelect ? selected : workspace.key === active?.key && resource.id === snapshot.activeResourceId}
            onContextMenu={(event) => {
              event.preventDefault();
              execute({ type: "open-resource-context", workspaceKey: workspace.key, resourceId: resource.id, x: event.clientX, y: event.clientY });
            }}
          >
            <i />
            <span className={templateMarkClassName(resource.template.id)}><ResourceIcon resource={resource} /></span>
            <button type="button" className="tree-node-label" onClick={() => execute({ type: snapshot.multiSelect ? "toggle-resource-selection" : "activate-resource", workspaceKey: workspace.key, resourceId: resource.id })} onDoubleClick={() => { if (!snapshot.multiSelect) execute({ type: "pin-resource", workspaceKey: workspace.key, resourceId: resource.id }); }}>{resourceTitle(resource)}</button>
            <small className="filtered-resource-package" title={`${workspace.document.package.name} · ${resource.path}`}>{workspace.document.package.name}</small>
            {snapshot.multiSelect && <label className="filtered-resource-select" title="选择资源"><input type="checkbox" checked={selected} onChange={() => execute({ type: "toggle-resource-selection", workspaceKey: workspace.key, resourceId: resource.id })} aria-label={`选择 ${resourceTitle(resource)}`} /></label>}
          </div>
        </div>;
      })}
      {snapshot.filteredResources.length === 0 && <p>没有符合条件的资源</p>}
    </div>}
    <div className={`workspace-package-list${filtering ? " is-filtering" : ""}`}>
      {snapshot.workspaces.map((workspace) => {
        const expanded = snapshot.expandedWorkspaceKeys.has(workspace.key);
        return <section className={`workspace-package${workspace.key === active?.key ? " is-current" : ""}${expanded ? " is-expanded" : ""}`} key={workspace.key}>
          <div className={`package-root${workspace.key === active?.key ? " is-current" : ""}`} onContextMenu={(event) => {
            event.preventDefault();
            execute({ type: "open-workspace-context", workspaceKey: workspace.key, x: event.clientX, y: event.clientY });
          }}>
            <button type="button" className="package-root-main" aria-expanded={expanded} onClick={() => execute({ type: "toggle-package", workspaceKey: workspace.key })}>
              <Icon name={expanded ? "chevronDown" : "chevronRight"} /><Icon name="package" /><strong>{workspace.document.package.name}</strong>
              <CloudSyncIndicator sync={snapshot.sync.get(workspace.key)} saving={snapshot.savingWorkspaceKey === workspace.key} />
            </button>
            <button type="button" aria-label={`${workspace.document.package.name}菜单`} onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              execute({ type: "open-workspace-context", workspaceKey: workspace.key, x: bounds.left, y: bounds.bottom });
            }}><Icon name="ellipsis" /></button>
          </div>
          <div className={`workspace-package-contents${expanded ? " is-open" : ""}`} aria-hidden={!expanded} inert={!expanded}><div>
            <div className="resource-tree"><WorkspaceTree
              workspace={workspace}
              activeResourceId={workspace.key === active?.key ? snapshot.activeResourceId : ""}
              selectionMode={snapshot.multiSelect}
              selectedResourceIds={new Set(snapshot.selectedResources.filter((selection) => selection.workspaceKey === workspace.key).map((selection) => selection.resourceId))}
              sortDirection={snapshot.sortDirection}
              onActivateResource={(resourceId) => execute({ type: "activate-resource", workspaceKey: workspace.key, resourceId })}
              onToggleResourceSelection={(resourceId) => execute({ type: "toggle-resource-selection", workspaceKey: workspace.key, resourceId })}
              onPinResource={(resourceId) => execute({ type: "pin-resource", workspaceKey: workspace.key, resourceId })}
              onSelectFolder={(folderId) => execute({ type: "select-folder", workspaceKey: workspace.key, folderId })}
              onToggleFolder={(folderId) => execute({ type: "toggle-folder", workspaceKey: workspace.key, folderId })}
              onRenameFolder={(folderId, name) => execute({ type: "rename-folder", workspaceKey: workspace.key, folderId, name }) ?? null}
              onMoveNode={(node, parentId) => execute({ type: "move-node", workspaceKey: workspace.key, node, parentId }) ?? null}
              onDeleteNode={(node) => execute({ type: "delete-node", workspaceKey: workspace.key, node })}
              onResourceContextMenu={(resourceId, x, y) => execute({ type: "open-resource-context", workspaceKey: workspace.key, resourceId, x, y })}
              onRootContextMenu={(x, y) => execute({ type: "open-workspace-context", workspaceKey: workspace.key, x, y })}
              resourceTitle={resourceTitle}
              renderResourceIcon={(resource) => <ResourceIcon resource={resource} />}
            /></div>
          </div></div>
        </section>;
      })}
    </div>
    <footer><span>{snapshot.activeResourceCount} 个资源</span></footer>
  </aside>;
}
