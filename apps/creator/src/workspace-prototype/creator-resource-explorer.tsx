import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { LocalDocumentSync } from "@pbdh/local-storage";
import { OperationStatus } from "@pbdh/platform-ui";
import type { ResourceFormatId } from "@pbdh/resource-conversion";

import {
  CloudSyncIndicator,
  Icon,
} from "./creator-controls.tsx";
import { ResourceIcon, resourceTitle } from "./resource-preview.tsx";
import { resourceSearchFieldValues } from "./resource-search-query.ts";
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
  filteredResources: ReadonlyArray<{ workspace: CreatorWorkspace; resource: WorkspaceResource }>;
  multiSelect: boolean;
  selectedResources: readonly WorkspaceResourceSelection[];
  expandedWorkspaceKeys: ReadonlySet<string>;
  sync: ReadonlyMap<string, LocalDocumentSync>;
  savingWorkspaceKey: string | null;
};

export type CreatorResourceExplorerCommand =
  | { type: "new-package" | "import-pbres" | "export-package" | "publish-package" | "new-resource" | "new-folder" | "toggle-multi-select" }
  | { type: "import-third-party"; formatId: Exclude<ResourceFormatId, "pbres"> }
  | { type: "export-third-party"; formatId: Exclude<ResourceFormatId, "pbres"> }
  | { type: "set-search"; value: string }
  | { type: "activate-resource" | "pin-resource" | "toggle-resource-selection"; workspaceKey: string; resourceId: string }
  | { type: "open-resource-context"; workspaceKey: string; resourceId: string; x: number; y: number }
  | { type: "toggle-package"; workspaceKey: string }
  | { type: "open-workspace-context"; workspaceKey: string; x: number; y: number }
  | { type: "select-folder"; workspaceKey: string; folderId: string | null }
  | { type: "copy-folder"; workspaceKey: string; folderId: string }
  | { type: "toggle-folder"; workspaceKey: string; folderId: string }
  | { type: "rename-folder"; workspaceKey: string; folderId: string; name: string }
  | { type: "move-node"; workspaceKey: string; node: WorkspaceNodeRef; parentId: string | null }
  | { type: "delete-node"; workspaceKey: string; node: WorkspaceNodeRef };

const thirdPartyFormats: Array<{ id: Exclude<ResourceFormatId, "pbres">; label: string }> = [
  { id: "dhsheet", label: " dhcb 格式" },
  { id: "zzz", label: " ZZZ 格式" },
  { id: "rinkcx", label: " Rink 格式" },
  { id: "kid", label: "不咕鸟格式" },
];

type ResourceSearchSuggestion = {
  key: string;
  token: string;
  cursorBeforeClosingBracket?: boolean;
};

function resourceSearchSuggestions(
  search: string,
  fields: ReadonlyMap<string, readonly string[]>,
): ResourceSearchSuggestion[] {
  const fragmentStart = search.lastIndexOf("[");
  const fragment = fragmentStart >= 0 && !search.slice(fragmentStart).includes("]")
    ? search.slice(fragmentStart + 1)
    : "";
  const separator = fragment.indexOf(":");
  if (separator >= 0) {
    const requestedKey = fragment.slice(0, separator).trim();
    const valueQuery = fragment.slice(separator + 1).trim().toLocaleLowerCase();
    const field = [...fields.keys()].find((key) => key.toLocaleLowerCase() === requestedKey.toLocaleLowerCase());
    if (!field) return [];
    return (fields.get(field) ?? [])
      .filter((value) => !valueQuery || value.toLocaleLowerCase().includes(valueQuery))
      .slice(0, 80)
      .map((value) => ({ key: `${field}:${value}`, token: `[${field}:${value}]` }));
  }
  const keyQuery = fragment.trim().toLocaleLowerCase();
  return [...fields.keys()]
    .filter((key) => !keyQuery || key.toLocaleLowerCase().includes(keyQuery))
    .sort((left, right) => left === "模板" ? -1 : right === "模板" ? 1 : left.localeCompare(right, "zh-CN"))
    .map((key) => ({
      key,
      token: `[${key}:]`,
      cursorBeforeClosingBracket: true,
    }));
}

export function CreatorResourceExplorer({
  snapshot,
  execute,
}: {
  snapshot: CreatorResourceExplorerSnapshot;
  execute(command: CreatorResourceExplorerCommand): string | null | void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchHelpOpen, setSearchHelpOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [inputSearchFields, setInputSearchFields] = useState<ReadonlySet<string>>(new Set());
  const filtering = Boolean(snapshot.search.trim());
  const active = snapshot.workspaces.find((workspace) => workspace.key === snapshot.activeWorkspaceKey);
  const isSelected = (workspaceKey: string, resourceId: string) => snapshot.selectedResources.some(
    (selection) => selection.workspaceKey === workspaceKey && selection.resourceId === resourceId,
  );
  const searchFields = useMemo(() => resourceSearchFieldValues(snapshot.workspaces.flatMap((workspace) =>
    workspace.document.resources.map((resource) => ({ template: resource.template, data: resource.data }))), inputSearchFields), [inputSearchFields, snapshot.workspaces]);
  const searchSuggestions = useMemo(() => resourceSearchSuggestions(snapshot.search, searchFields), [searchFields, snapshot.search]);
  const applySearchSuggestion = (suggestion: ResourceSearchSuggestion) => {
    const fragmentStart = snapshot.search.lastIndexOf("[");
    const replaceFragment = fragmentStart >= 0 && !snapshot.search.slice(fragmentStart).includes("]");
    const prefix = replaceFragment ? snapshot.search.slice(0, fragmentStart) : `${snapshot.search}${snapshot.search && !snapshot.search.endsWith(" ") ? " " : ""}`;
    const next = `${prefix}${suggestion.token}${suggestion.cursorBeforeClosingBracket ? "" : " "}`;
    execute({ type: "set-search", value: next });
    setActiveSuggestion(0);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      const cursor = suggestion.cursorBeforeClosingBracket ? next.length - 1 : next.length;
      searchInputRef.current?.setSelectionRange(cursor, cursor);
    });
  };
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setSearchHelpOpen(false);
      return;
    }
    if (!searchHelpOpen || searchSuggestions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveSuggestion((current) => (current + delta + searchSuggestions.length) % searchSuggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      applySearchSuggestion(searchSuggestions[Math.min(activeSuggestion, searchSuggestions.length - 1)]!);
    }
  };

  return <aside className="resource-explorer">
    <header className="explorer-toolbar"><strong>资源管理器</strong><div>
      <button className="explorer-new-package" type="button" title="新建资源包" aria-label="新建资源包" disabled={Boolean(snapshot.operation)} onClick={() => execute({ type: "new-package" })}><Icon name="packagePlus" /></button>
      <button type="button" title="新建资源" aria-label="新建资源" disabled={!active || Boolean(snapshot.operation)} onClick={() => execute({ type: "new-resource" })}><Icon name="filePlus" /></button>
      <button type="button" title="新建文件夹" aria-label="新建文件夹" disabled={!active || Boolean(snapshot.operation)} onClick={() => execute({ type: "new-folder" })}><Icon name="folderPlus" /></button>
      <span className="explorer-toolbar-divider" aria-hidden="true" />
      <div className="explorer-import-menu">
        <button type="button" title="导入资源包" aria-label="导入资源包" aria-haspopup="menu" disabled={Boolean(snapshot.operation)}><Icon name="upload" /></button>
        <div className="explorer-import-menu-panel" role="menu">
          <button className="is-native-format" type="button" role="menuitem" disabled={Boolean(snapshot.operation)} onClick={() => execute({ type: "import-pbres" })}>导入 PBRES 格式</button>
          {thirdPartyFormats.map((format) => <button key={format.id} type="button" role="menuitem" disabled={Boolean(snapshot.operation)} onClick={() => execute({ type: "import-third-party", formatId: format.id })}>{`导入${format.label}`}</button>)}
        </div>
      </div>
      <div className="explorer-import-menu">
        <button type="button" title="导出资源包" aria-label="导出资源包" aria-haspopup="menu" disabled={!active || Boolean(snapshot.operation)}><Icon name="download" /></button>
        <div className="explorer-import-menu-panel" role="menu">
          <button className="is-native-format" type="button" role="menuitem" disabled={!active || Boolean(snapshot.operation)} onClick={() => execute({ type: "export-package" })}>导出 PBRES 格式</button>
          {thirdPartyFormats.map((format) => <button key={format.id} type="button" role="menuitem" disabled={!active || Boolean(snapshot.operation)} onClick={() => execute({ type: "export-third-party", formatId: format.id })}>{`导出${format.label}`}</button>)}
        </div>
      </div>
      <span className="explorer-toolbar-divider" aria-hidden="true" />
      <button className="explorer-publish-package" type="button" title="发布到资源市场" aria-label="发布到资源市场" disabled={!active || Boolean(snapshot.operation)} onClick={() => execute({ type: "publish-package" })}><Icon name="store" /></button>
    </div></header>
    {snapshot.operation && snapshot.operationLabel && <div className="creator-operation-strip"><OperationStatus label={snapshot.operationLabel} size="regular" /></div>}
    <div className="explorer-search-row"><div className="explorer-search-composer" onFocus={() => {
      setInputSearchFields(new Set([...document.querySelectorAll<HTMLInputElement>("[data-template-authoring] .template-editor-field input")]
        .map((input) => input.closest("label")?.querySelector(":scope > span")?.textContent?.trim() ?? "")
        .filter(Boolean)));
      setSearchHelpOpen(true);
    }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setSearchHelpOpen(false);
    }}>
      <div className="explorer-search"><Icon name="search" /><input
        ref={searchInputRef}
        aria-label="筛选资源"
        aria-autocomplete="list"
        aria-controls="resource-search-help"
        aria-expanded={searchHelpOpen}
        aria-activedescendant={searchHelpOpen && searchSuggestions.length > 0 ? `resource-search-suggestion-${activeSuggestion}` : undefined}
        placeholder="搜索，或输入 [字段:值]"
        value={snapshot.search}
        onChange={(event) => { execute({ type: "set-search", value: event.currentTarget.value }); setActiveSuggestion(0); }}
        onKeyDown={handleSearchKeyDown}
      />{snapshot.search && <button
        type="button"
        className="explorer-search-clear"
        aria-label="清空搜索"
        title="清空搜索"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => { execute({ type: "set-search", value: "" }); setActiveSuggestion(0); searchInputRef.current?.focus(); }}
      ><Icon name="x" /></button>}</div>
      {searchHelpOpen && <div className="resource-search-help" id="resource-search-help" role="listbox" aria-label="标签搜索语法提示">
        <header><strong>标签筛选</strong></header>
        <div className="resource-search-suggestions">
          {searchSuggestions.map((suggestion, index) => <button
            type="button"
            role="option"
            aria-selected={index === activeSuggestion}
            className={index === activeSuggestion ? "is-active" : ""}
            id={`resource-search-suggestion-${index}`}
            key={suggestion.key}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveSuggestion(index)}
            onClick={() => applySearchSuggestion(suggestion)}
          ><code>{suggestion.token}</code></button>)}
          {searchSuggestions.length === 0 && <p>没有匹配的字段或值</p>}
        </div>
      </div>}
    </div><button type="button" className={`explorer-multi-select${snapshot.multiSelect ? " is-active" : ""}`} aria-pressed={snapshot.multiSelect} onClick={() => execute({ type: "toggle-multi-select" })}>
        多选{snapshot.multiSelect && snapshot.selectedResources.length > 0 ? `（${snapshot.selectedResources.length}）` : ""}
      </button></div>
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
              onActivateResource={(resourceId) => execute({ type: "activate-resource", workspaceKey: workspace.key, resourceId })}
              onToggleResourceSelection={(resourceId) => execute({ type: "toggle-resource-selection", workspaceKey: workspace.key, resourceId })}
              onPinResource={(resourceId) => execute({ type: "pin-resource", workspaceKey: workspace.key, resourceId })}
              onSelectFolder={(folderId) => execute({ type: "select-folder", workspaceKey: workspace.key, folderId })}
              onToggleFolder={(folderId) => execute({ type: "toggle-folder", workspaceKey: workspace.key, folderId })}
              onRenameFolder={(folderId, name) => execute({ type: "rename-folder", workspaceKey: workspace.key, folderId, name }) ?? null}
              onMoveNode={(node, parentId) => execute({ type: "move-node", workspaceKey: workspace.key, node, parentId }) ?? null}
              onCopyFolder={(folderId) => execute({ type: "copy-folder", workspaceKey: workspace.key, folderId })}
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
