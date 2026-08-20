import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  treeItemsInFolder,
  type CreatorWorkspace,
  type WorkspaceNodeRef,
  type WorkspaceResource,
} from "./workspace-model.ts";

const workspaceNodeDataType = "application/x-pbdh-workspace-node";

export function WorkspaceTree({
  workspace,
  activeResourceId,
  onActivateResource,
  onPinResource,
  onSelectFolder,
  onToggleFolder,
  onRenameFolder,
  onMoveNode,
  onDeleteNode,
  onResourceContextMenu,
  onRootContextMenu,
  resourceTitle,
  renderResourceIcon,
}: {
  workspace: CreatorWorkspace;
  activeResourceId: string;
  onActivateResource: (resourceId: string) => void;
  onPinResource: (resourceId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
  onToggleFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => string | null;
  onMoveNode: (node: WorkspaceNodeRef, parentId: string | null, index?: number) => string | null;
  onDeleteNode: (node: WorkspaceNodeRef) => void;
  onResourceContextMenu: (resourceId: string, x: number, y: number) => void;
  onRootContextMenu: (x: number, y: number) => void;
  resourceTitle: (resource: WorkspaceResource) => string;
  renderResourceIcon: (resource: WorkspaceResource) => ReactNode;
}) {
  const [menu, setMenu] = useState<{ node: WorkspaceNodeRef; x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

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
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 100)),
    });
  };

  const move = (node: WorkspaceNodeRef, parentId: string | null, index?: number) => {
    setError(onMoveNode(node, parentId, index));
  };

  const beginRename = (folderId: string) => {
    const folder = workspace.folders.find((candidate) => candidate.id === folderId);
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
      const node = readDraggedNode(event);
      if (!node) return;
      event.preventDefault();
      move(node, null);
    } : undefined}>
      {treeItemsInFolder(workspace, parentId).map((item) => {
        if (item.kind === "folder") {
          const folder = workspace.folders.find((candidate) => candidate.id === item.id)!;
          const node = { kind: "folder" as const, id: folder.id };
          const count = workspace.resourceLocations.filter((location) => location.parentId === folder.id).length;
          return <div className="workspace-tree-node" key={folder.id}>
            <div
              className={`folder-row${workspace.currentFolderId === folder.id ? " is-current" : ""}`}
              style={{ paddingLeft: 6 + depth * 14 }}
              role="treeitem"
              aria-expanded={!folder.collapsed}
              draggable
              onDragStart={(event) => writeDraggedNode(event, node)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.stopPropagation();
                const dragged = readDraggedNode(event);
                if (!dragged) return;
                event.preventDefault();
                const bounds = event.currentTarget.getBoundingClientRect();
                const relativeY = bounds.height ? (event.clientY - bounds.top) / bounds.height : 0.5;
                if (relativeY > 0.25 && relativeY < 0.75) move(dragged, folder.id);
                else move(dragged, folder.parentId, folder.order + (relativeY >= 0.75 ? 1 : 0));
              }}
              onContextMenu={(event) => openMenu(event, node)}
            >
              <button type="button" className="tree-chevron" aria-label={`${folder.collapsed ? "展开" : "折叠"}${folder.name}`} onClick={() => onToggleFolder(folder.id)}><TreeIcon name={folder.collapsed ? "chevronRight" : "chevronDown"} /></button>
              <TreeIcon name="folder" />
              {renamingFolderId === folder.id
                ? <input className="tree-rename" aria-label="文件夹名称" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={handleRenameKey} onBlur={commitRename} autoFocus />
                : <button type="button" className="tree-node-label" onClick={() => onSelectFolder(folder.id)}>{folder.name}</button>}
              <small>{count || ""}</small>
            </div>
            {!folder.collapsed && renderLevel(folder.id, depth + 1)}
          </div>;
        }

        const resource = workspace.document.resources.find((candidate) => candidate.id === item.id)!;
        const node = { kind: "resource" as const, id: resource.id };
        return <div className="workspace-tree-node" key={resource.id}>
          <div
            className={`file-row${resource.id === activeResourceId ? " is-current" : ""}`}
            style={{ paddingLeft: 24 + depth * 14 }}
            role="treeitem"
            aria-selected={resource.id === activeResourceId}
            draggable
            onDragStart={(event) => writeDraggedNode(event, node)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.stopPropagation();
              const dragged = readDraggedNode(event);
              if (!dragged) return;
              event.preventDefault();
              const bounds = event.currentTarget.getBoundingClientRect();
              move(dragged, item.parentId, item.order + (event.clientY - bounds.top > bounds.height / 2 ? 1 : 0));
            }}
            onContextMenu={(event) => openMenu(event, node)}
          >
            <i />
            <span className={`template-mark ${resource.template.id === "敌人" ? "adversary" : "weapon"}`}>{renderResourceIcon(resource)}</span>
            <button type="button" className="tree-node-label" onClick={() => onActivateResource(resource.id)} onDoubleClick={() => onPinResource(resource.id)}>{resourceTitle(resource)}</button>
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

function writeDraggedNode(event: DragEvent, node: WorkspaceNodeRef): void {
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData(workspaceNodeDataType, JSON.stringify(node));
  if (node.kind === "resource") event.dataTransfer.setData("application/x-pbdh-resource", node.id);
}

function readDraggedNode(event: DragEvent): WorkspaceNodeRef | null {
  try {
    const node = JSON.parse(event.dataTransfer.getData(workspaceNodeDataType)) as WorkspaceNodeRef;
    return node?.id && (node.kind === "folder" || node.kind === "resource") ? node : null;
  } catch {
    return null;
  }
}
