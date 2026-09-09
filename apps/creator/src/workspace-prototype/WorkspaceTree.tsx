import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  workspaceResourceCountByFolder,
  workspaceTreeItemsByParent,
  type CreatorWorkspace,
  type WorkspaceNodeRef,
  type WorkspaceResource,
} from "./workspace-model.ts";
import { templateMarkClassName } from "./TemplateIcon.tsx";

import { readWorkspaceNodeDrag, workspaceNodeDataType } from "./workspace-node-drag.ts";

export function WorkspaceTree({
  workspace,
  activeResourceId,
  selectionMode,
  selectedResourceIds,
  onActivateResource,
  onToggleResourceSelection,
  onPinResource,
  onSelectFolder,
  onToggleFolder,
  onRenameFolder,
  onMoveNode,
  onDeleteNode,
  onResourceContextMenu,
  onRootContextMenu,
  onCopyFolder,
  resourceTitle,
  renderResourceIcon,
}: {
  workspace: CreatorWorkspace;
  activeResourceId: string;
  selectionMode?: boolean;
  selectedResourceIds?: ReadonlySet<string>;
  onActivateResource: (resourceId: string) => void;
  onToggleResourceSelection?: (resourceId: string) => void;
  onPinResource: (resourceId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
  onToggleFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => string | null;
  onMoveNode: (node: WorkspaceNodeRef, parentId: string | null) => string | null;
  onDeleteNode: (node: WorkspaceNodeRef) => void;
  onResourceContextMenu: (resourceId: string, x: number, y: number) => void;
  onRootContextMenu: (x: number, y: number) => void;
  onCopyFolder?: (folderId: string) => void;
  resourceTitle: (resource: WorkspaceResource) => string;
  renderResourceIcon: (resource: WorkspaceResource) => ReactNode;
}) {
  const [menu, setMenu] = useState<{ node: WorkspaceNodeRef; x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const folderById = useMemo(() => new Map(workspace.folders.map((folder) => [folder.id, folder])), [workspace.folders]);
  const resourceById = useMemo(() => new Map(workspace.document.resources.map((resource) => [resource.id, resource])), [workspace.document.resources]);
  const resourceCountByFolder = useMemo(
    () => workspaceResourceCountByFolder(workspace),
    [workspace.folders, workspace.resourceLocations],
  );
  const treeItemsByParent = useMemo(
    () => workspaceTreeItemsByParent(workspace),
    [workspace.document.resources, workspace.folders, workspace.resourceLocations],
  );

  useEffect(() => {
    if (!menu) return;
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setMenu(null);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);

  const openMenu = (event: MouseEvent, node: WorkspaceNodeRef) => {
    event.preventDefault();
    if (node.kind === "resource") {
      onResourceContextMenu(node.id, event.clientX, event.clientY);
      return;
    }
    setMenu({
      node,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 180)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 140)),
    });
  };

  const move = (node: WorkspaceNodeRef, parentId: string | null) => {
    setError(onMoveNode(node, parentId));
  };

  const beginRename = (folderId: string) => {
    const folder = folderById.get(folderId);
    if (!folder) return;
    setMenu(null);
    setError(null);
    setRenamingFolderId(folderId);
    setRenameValue(folder.name);
  };

  const commitRename = () => {
    if (!renamingFolderId) return;
    const nextError = onRenameFolder(renamingFolderId, renameValue);
    if (nextError) setError(nextError);
    else {
      setRenamingFolderId(null);
      setError(null);
    }
  };

  const handleRenameKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commitRename();
    if (event.key === "Escape") {
      setRenamingFolderId(null);
      setError(null);
    }
  };

  const renderLevel = (parentId: string | null, depth: number): ReactNode => (
    <div className={parentId === null ? "workspace-tree-level workspace-tree-root" : "workspace-tree-level"} role={parentId === null ? "tree" : "group"} onContextMenu={parentId === null ? (event) => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      onRootContextMenu(event.clientX, event.clientY);
    } : undefined} onDragOver={parentId === null ? (event) => event.preventDefault() : undefined} onDrop={parentId === null ? (event) => {
      if (event.target !== event.currentTarget) return;
      const node = readDraggedNode(event, workspace.key);
      if (!node) return;
      event.preventDefault();
      event.stopPropagation();
      move(node, null);
    } : undefined}>
      {(treeItemsByParent.get(parentId) ?? []).map((item) => {
        if (item.kind === "folder") {
          const folder = folderById.get(item.id)!;
          const node = { kind: "folder" as const, id: folder.id };
          const count = resourceCountByFolder.get(folder.id) ?? 0;
          return <div className="workspace-tree-node" key={folder.id}>
            <div
              className={`folder-row${workspace.currentFolderId === folder.id ? " is-current" : ""}`}
              style={{ paddingLeft: 6 + depth * 14 }}
              role="treeitem"
              aria-expanded={!folder.collapsed}
              draggable
              onDragStart={(event) => writeDraggedNode(event, node, workspace.key)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.stopPropagation();
                const dragged = readDraggedNode(event, workspace.key);
                if (!dragged) return;
                event.preventDefault();
                move(dragged, folder.id);
              }}
              onContextMenu={(event) => openMenu(event, node)}
            >
              <button type="button" className="tree-chevron" aria-label={`${folder.collapsed ? "展开" : "折叠"}${folder.name}`} onClick={() => onToggleFolder(folder.id)}><TreeIcon name={folder.collapsed ? "chevronRight" : "chevronDown"} /></button>
              <TreeIcon name="folder" />
              {renamingFolderId === folder.id
                ? <input className="tree-rename" aria-label="文件夹名称" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={handleRenameKey} onBlur={commitRename} autoFocus />
                : <button type="button" className="tree-node-label" onClick={() => onSelectFolder(folder.id)}>{folder.name}</button>}
              <small aria-label={`${count} 个资源`}>{count}</small>
            </div>
            <div className={`workspace-tree-children${folder.collapsed ? "" : " is-open"}`} aria-hidden={folder.collapsed} inert={folder.collapsed}>
              <div>{folder.collapsed ? null : renderLevel(folder.id, depth + 1)}</div>
            </div>
          </div>;
        }

        const resource = resourceById.get(item.id)!;
        const node = { kind: "resource" as const, id: resource.id };
        const selected = selectedResourceIds?.has(resource.id) ?? false;
        return <div className="workspace-tree-node" key={resource.id}>
          <div
            className={`file-row${resource.id === activeResourceId && !selectionMode ? " is-current" : ""}${selectionMode && selected ? " is-multi-selected" : ""}`}
            style={{ paddingLeft: 24 + depth * 14 }}
            role="treeitem"
            aria-selected={selectionMode ? selected : resource.id === activeResourceId}
            draggable
            onDragStart={(event) => writeDraggedNode(event, node, workspace.key)}
            onContextMenu={(event) => openMenu(event, node)}
          >
            <i />
            <span className={templateMarkClassName(resource.template.id)}>{renderResourceIcon(resource)}</span>
            <button type="button" className="tree-node-label" onClick={() => selectionMode ? onToggleResourceSelection?.(resource.id) : onActivateResource(resource.id)} onDoubleClick={() => { if (!selectionMode) onPinResource(resource.id); }}>{resourceTitle(resource)}</button>
            {selectionMode && <label className="filtered-resource-select" title="选择资源"><input type="checkbox" checked={selected} onChange={() => onToggleResourceSelection?.(resource.id)} aria-label={`选择 ${resourceTitle(resource)}`} /></label>}
          </div>
        </div>;
      })}
      {error && parentId === null && <div className="tree-error" role="alert">{error}</div>}
    </div>
  );

  return <>
    {renderLevel(null, 0)}
    {menu && <div ref={menuRef} className="context-menu workspace-node-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
      {menu.node.kind === "folder" && <button type="button" role="menuitem" onClick={() => beginRename(menu.node.id)}>重命名</button>}
      {menu.node.kind === "folder" && onCopyFolder && <button type="button" role="menuitem" onClick={() => { onCopyFolder(menu.node.id); setMenu(null); }}>复制到资源包…</button>}
      <button type="button" role="menuitem" className="delete" onClick={() => { onDeleteNode(menu.node); setMenu(null); }}>删除</button>
    </div>}
  </>;
}

const treeIconPaths = {
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 18 6-6-6-6",
  folder: "M3 6h6l2 2h10v11H3Z",
};

function TreeIcon({ name }: { name: keyof typeof treeIconPaths }) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={treeIconPaths[name]} /></svg>;
}

function writeDraggedNode(event: DragEvent, node: WorkspaceNodeRef, workspaceKey: string): void {
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData(workspaceNodeDataType, JSON.stringify({ ...node, workspaceKey }));
  if (node.kind === "resource") event.dataTransfer.setData("application/x-pbdh-resource", node.id);
}

function readDraggedNode(event: DragEvent, workspaceKey: string): WorkspaceNodeRef | null {
  const dragged = readWorkspaceNodeDrag(event.dataTransfer);
  return dragged?.workspaceKey === workspaceKey ? { kind: dragged.kind, id: dragged.id } : null;
}
