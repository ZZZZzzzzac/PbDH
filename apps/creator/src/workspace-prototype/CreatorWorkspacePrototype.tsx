import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";

import {
  loadPbres,
  writePbres,
  type ContractDiagnostic,
  type ResourcePackageCandidate,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import { CanonicalCardSurface } from "@pbdh/resource-renderer/react";
import { adversaryRendererRevision } from "@pbdh/templates/frontend";
import type { AdversaryData, AdversaryFeature } from "@pbdh/templates/core";

import minotaurImageUrl from "../../../../contracts/conformance/resource-package/1.0.0-alpha.1/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp?url";
import minotaurPackage from "../../../../contracts/conformance/resource-package/1.0.0-alpha.1/valid/minotaur-wrecker.json";

import { creatorWorkspaceDesign } from "./design.generated.ts";
import { validateResourcePackageCandidate } from "./resource-package-validator.ts";
import {
  adversaryData,
  clearAdversaryFeature,
  createBlankWorkspace,
  createWorkspace,
  deleteAdversaryFeature,
  forkCurrentWorkspace,
  planImport,
  prepareWorkspaceExport,
  replacePortrait,
  updateAdversaryData,
  updateResourcePresentation,
  type CreatorWorkspace,
} from "./workspace-model.ts";

type Dialog =
  | { kind: "new" }
  | { kind: "diagnostics"; title: string; diagnostics: ContractDiagnostic[] }
  | { kind: "no-op"; name: string }
  | { kind: "update"; incoming: ResourcePackageCandidate }
  | { kind: "conflict"; incoming: ResourcePackageCandidate }
  | { kind: "delete-feature"; index: number; name: string }
  | null;

const initialDocument = minotaurPackage as ResourcePackageLogicalDocument;
const initialWorkspace = createWorkspace({ document: initialDocument, media: new Map() });
const initialAssetId = initialDocument.assets[0]!.id;

function Field({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`compact-field ${className}`}>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`compact-field textarea-field ${className}`}>
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

const iconPaths: Record<string, string[]> = {
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  chevronDown: ["m6 9 6 6 6-6"],
  chevronRight: ["m9 18 6-6-6-6"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  ellipsis: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  filePlus: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z", "M14 2v6h6", "M12 18v-6", "M9 15h6"],
  folder: ["M3 6h6l2 2h10v11H3Z"],
  folderPlus: ["M3 6h6l2 2h10v11H3Z", "M12 11v6", "M9 14h6"],
  grip: ["M9 5h.01", "M15 5h.01", "M9 12h.01", "M15 12h.01", "M9 19h.01", "M15 19h.01"],
  image: ["M3 5h18v14H3Z", "m3 16 5-5 4 4 3-3 3 4", "M14.5 9.5h.01"],
  maximize: ["M8 3H3v5", "M16 3h5v5", "M8 21H3v-5", "M16 21h5v-5"],
  package: ["m12 3 9 5-9 5-9-5Z", "m3 8 9 5 9-5", "M3 8v9l9 5 9-5V8", "M12 13v9"],
  packagePlus: ["m12 3 9 5-9 5-9-5Z", "M3 8v9l9 5 9-5V8", "M12 13v9", "M17 4v6", "M14 7h6"],
  search: ["m21 21-4.3-4.3", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20h-3v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 14.7a1.7 1.7 0 0 0-1.55-1H5v-3h.09A1.7 1.7 0 0 0 6.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.3 3.8V3h3v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19 8.3a1.7 1.7 0 0 0 1.55 1H21v3h-.09A1.7 1.7 0 0 0 19.4 15Z"],
  skull: ["M8 19v2", "M12 19v2", "M16 19v2", "M5 12a7 7 0 1 1 14 0v4l-3 3H8l-3-3Z", "M9 13h.01", "M15 13h.01"],
  upload: ["M12 21V9", "m7 14 5-5 5 5", "M5 3h14"],
  user: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"],
  x: ["M18 6 6 18", "m6 6 12 12"],
};

function Icon({ name }: { name: keyof typeof iconPaths }) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    {iconPaths[name].map((path) => <path key={path} d={path} />)}
  </svg>;
}

function bytesToUrlMap(candidate: ResourcePackageCandidate): Map<string, string> {
  return new Map([...candidate.media].map(([id, bytes]) => [
    id,
    URL.createObjectURL(new Blob([
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    ], { type: "image/webp" })),
  ]));
}

async function imageAsset(file: File) {
  if (file.type !== "image/webp") throw new Error("只接受 WebP portrait");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  const id = `sha256:${Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")}`;
  const bitmap = await createImageBitmap(file);
  const asset = {
    id,
    mediaType: "image/webp" as const,
    byteLength: String(bytes.byteLength),
    width: String(bitmap.width),
    height: String(bitmap.height),
  };
  bitmap.close();
  return { asset, bytes };
}

export function CreatorWorkspacePrototype() {
  const startEmpty = new URLSearchParams(window.location.search).get("state") === "empty";
  const [workspaces, setWorkspaces] = useState<CreatorWorkspace[]>(startEmpty ? [] : [initialWorkspace]);
  const [activeKey, setActiveKey] = useState(startEmpty ? "" : initialWorkspace.key);
  const [assetUrls, setAssetUrls] = useState(() => new Map([[initialAssetId, minotaurImageUrl]]));
  const [dialog, setDialog] = useState<Dialog>(null);
  const [newName, setNewName] = useState("牛头人敌人资源包");
  const [openFeatureMenu, setOpenFeatureMenu] = useState<number | null>(null);
  const [, setNotice] = useState("仅本机 · 原型状态保存在当前页面内存");
  const importRef = useRef<HTMLInputElement>(null);
  const portraitRef = useRef<HTMLInputElement>(null);
  const active = workspaces.find((workspace) => workspace.key === activeKey) ?? workspaces[0];

  useEffect(() => {
    fetch(minotaurImageUrl)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        setWorkspaces((current) => current.map((workspace) => workspace.key === initialWorkspace.key
          ? { ...workspace, media: new Map([[initialAssetId, new Uint8Array(buffer)]]) }
          : workspace));
      })
      .catch(() => setNotice("portrait 字节未就绪；预览可用，导出暂不可用"));
  }, []);

  const data = active ? adversaryData(active) : undefined;
  const resource = active?.document.resources[0];
  const previewResource = resource && data ? { ...resource, data } : undefined;
  const previewAssets = useMemo(() => new Map(
    resource
      ? Object.values(resource.media).flatMap((id) => {
          const url = assetUrls.get(id);
          return url ? [[id, { status: "ready" as const, url }] as const] : [];
        })
      : [],
  ), [assetUrls, resource]);

  const designStyle = {
    "--creator-appbar-height": `${creatorWorkspaceDesign.appBar.height}px`,
    "--creator-tabs-height": `${creatorWorkspaceDesign.tabs.height}px`,
    "--creator-nav-width": `${creatorWorkspaceDesign.columns.resourceNavigationWidth}px`,
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
  } as CSSProperties;

  function replaceActive(next: CreatorWorkspace) {
    setWorkspaces((current) => current.map((workspace) => workspace.key === active!.key ? next : workspace));
    setActiveKey(next.key);
  }

  function updateData(update: (draft: AdversaryData) => void) {
    if (active) replaceActive(updateAdversaryData(active, update));
  }

  function updateField(field: Exclude<keyof AdversaryData, "特性">, value: string) {
    updateData((draft) => { draft[field] = value; });
  }

  function updatePresentation(
    update: (presentation: CreatorWorkspace["document"]["resources"][number]["presentation"]) => void,
  ) {
    if (active) replaceActive(updateResourcePresentation(active, update));
  }

  function updateFeature(index: number, field: keyof AdversaryFeature, value: string) {
    updateData((draft) => { draft.特性[index]![field] = value; });
  }

  function clearFeature(index: number) {
    if (active) replaceActive(clearAdversaryFeature(active, index));
    setOpenFeatureMenu(null);
  }

  function deleteFeature(index: number) {
    if (active) replaceActive(deleteAdversaryFeature(active, index));
    setOpenFeatureMenu(null);
    setDialog(null);
  }

  function requestFeatureDeletion(index: number, name: string) {
    setOpenFeatureMenu(null);
    setDialog({ kind: "delete-feature", index, name });
  }

  function commitIncoming(candidate: ResourcePackageCandidate) {
    const next = createWorkspace(candidate);
    setAssetUrls((current) => new Map([...current, ...bytesToUrlMap(candidate)]));
    setWorkspaces((current) => {
      const existing = current.findIndex((workspace) => workspace.document.package.id === next.document.package.id);
      if (existing < 0) return [...current, next];
      return current.map((workspace, index) => index === existing ? next : workspace);
    });
    setActiveKey(next.key);
    setDialog(null);
    setNotice(`已载入 ${next.document.package.name}`);
  }

  async function importPackage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await loadPbres(new Uint8Array(await file.arrayBuffer()), validateResourcePackageCandidate);
    if (!result.candidate) {
      setDialog({ kind: "diagnostics", title: "导入失败 · 零写入", diagnostics: result.diagnostics });
      return;
    }
    const existing = workspaces.find((workspace) =>
      workspace.document.package.id === result.candidate!.document.package.id);
    const plan = planImport(existing, result.candidate);
    if (plan === "insert") commitIncoming(result.candidate);
    if (plan === "no-op") {
      setActiveKey(existing!.key);
      setDialog({ kind: "no-op", name: result.candidate.document.package.name });
    }
    if (plan === "update") setDialog({ kind: "update", incoming: result.candidate });
    if (plan === "conflict") setDialog({ kind: "conflict", incoming: result.candidate });
  }

  async function exportPackage() {
    if (!active) return;
    const next = await prepareWorkspaceExport(active);
    const diagnostics = await validateResourcePackageCandidate(next.document, next.media);
    if (diagnostics.some((item) => item.severity === "error")) {
      setDialog({ kind: "diagnostics", title: "导出门禁未通过", diagnostics });
      return;
    }
    const bytes = writePbres(next.document, next.media);
    const blob = new Blob([
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    ], { type: "application/vnd.pbdh.resource+zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${next.document.package.name.replace(/[\\/:*?"<>|]/g, "-")}.pbres`;
    anchor.click();
    URL.revokeObjectURL(url);
    replaceActive(next);
    setNotice(`已导出完整 .pbres · ${next.document.snapshotDigest.slice(0, 18)}…`);
  }

  async function createWorkspaceFromDialog() {
    const next = await createBlankWorkspace(newName);
    setWorkspaces((current) => [...current, next]);
    setActiveKey(next.key);
    setDialog(null);
    setNotice("已显式创建空白 Workspace");
  }

  async function replacePortraitFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !active) return;
    try {
      const { asset, bytes } = await imageAsset(file);
      const next = replacePortrait(active, asset, bytes);
      setAssetUrls((current) => new Map(current).set(asset.id, URL.createObjectURL(file)));
      replaceActive(next);
      setNotice("portrait 已替换；规范卡面同步更新");
    } catch (error) {
      setDialog({
        kind: "diagnostics",
        title: "媒体未接受 · 零写入",
        diagnostics: [{
          code: "creator.media.unsupported",
          severity: "error",
          family: "creator-prototype",
          version: "0",
          location: "/portrait",
          params: { reason: error instanceof Error ? error.message : "unknown" },
        }],
      });
    }
  }

  async function saveAsideThenImport(incoming: ResourcePackageCandidate) {
    const existing = workspaces.find((workspace) =>
      workspace.document.package.id === incoming.document.package.id);
    if (!existing) return commitIncoming(incoming);
    const fork = await forkCurrentWorkspace(existing);
    setWorkspaces((current) => [...current.filter((workspace) => workspace.key !== existing.key), fork]);
    commitIncoming(incoming);
    setNotice("本地修改已另存为新 Package ID；导入版本已载入");
  }

  if (!active || !data || !resource || !previewResource) {
    return (
      <main className="creator-prototype" style={designStyle}>
        <header className="platform-appbar">
          <div className="platform-brand"><b>PB</b><strong>PBDH</strong></div>
          <nav className="platform-nav" aria-label="主页面">
            <button type="button">玩家车卡器</button><button type="button" className="is-current">卡片工坊</button>
            <button type="button">GM 桌面</button><button type="button">资源市场</button>
          </nav>
          <div className="platform-actions"><button aria-label="通知"><Icon name="bell" /></button><button aria-label="设置"><Icon name="settings" /></button><button className="account"><Icon name="user" />账号</button></div>
        </header>
        <section className="empty-workspace">
          <h1>没有打开的资源包</h1>
          <div><button type="button" className="primary" onClick={() => setDialog({ kind: "new" })}>新建资源包</button>
            <button type="button" onClick={() => importRef.current?.click()}>导入 .pbres</button></div>
        </section>
        <input ref={importRef} hidden type="file" accept=".pbres" onChange={importPackage} />
        {dialog?.kind === "new" && <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true">
          <h2>新建资源包</h2><Field className="dialog-field" label="名称" value={newName} onChange={setNewName} />
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" onClick={createWorkspaceFromDialog}>创建</button></div>
        </section></div>}
        {dialog?.kind === "diagnostics" && <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true">
          <h2>{dialog.title}</h2><ul className="diagnostics">{dialog.diagnostics.map((item) =>
            <li key={`${item.code}:${item.location}`}><b>{item.code}</b><code>{item.location || "/"}</code></li>)}</ul>
          <div className="dialog-actions"><button type="button" className="primary" onClick={() => setDialog(null)}>关闭</button></div>
        </section></div>}
      </main>
    );
  }

  const resourceNames = ["洞穴守卫", "灰烬先知", "荆棘猎手", "深井祭司", "铁牙队长", "腐沼巫师"];

  return (
    <main className="creator-prototype" style={designStyle} data-design-source={creatorWorkspaceDesign.document}>
      <header className="platform-appbar">
        <div className="platform-brand"><b>PB</b><strong>PBDH</strong></div>
        <nav className="platform-nav" aria-label="主页面">
          <button type="button">玩家车卡器</button>
          <button type="button" className="is-current">卡片工坊</button>
          <button type="button">GM 桌面</button>
          <button type="button">资源市场</button>
        </nav>
        <div className="platform-actions">
          <button type="button" aria-label="通知"><Icon name="bell" /></button>
          <button type="button" aria-label="设置"><Icon name="settings" /></button>
          <button type="button" className="account"><Icon name="user" />账号</button>
        </div>
      </header>
      <div className="creator-workspace">
        <aside className="resource-explorer">
          <header className="explorer-toolbar"><strong>资源管理器</strong><div>
            <button type="button" title="新建资源包" aria-label="新建资源包" onClick={() => setDialog({ kind: "new" })}><Icon name="packagePlus" /></button>
            <button type="button" title="导入资源包" aria-label="导入资源包" onClick={() => importRef.current?.click()}><Icon name="upload" /></button>
            <button type="button" title="导出资源包" aria-label="导出资源包" onClick={exportPackage}><Icon name="download" /></button>
            <button type="button" title="新建资源" aria-label="新建资源"><Icon name="filePlus" /></button>
            <button type="button" title="新建文件夹" aria-label="新建文件夹"><Icon name="folderPlus" /></button>
          </div></header>
          <label className="explorer-search"><Icon name="search" /><input aria-label="筛选资源" placeholder="筛选资源" /></label>
          <div className="package-root"><Icon name="chevronDown" /><Icon name="package" /><strong>{active.document.package.name}</strong><button aria-label="资源包菜单"><Icon name="ellipsis" /></button></div>
          <div className="resource-tree">
            <div className="folder-row"><span /><Icon name="chevronDown" /><Icon name="folder" /><b>敌人</b><small>86</small></div>
            <button type="button" className="file-row is-current"><i /><span className="template-mark adversary"><Icon name="skull" /></span><b>{data.名称 || "未命名敌人"}</b></button>
            {resourceNames.map((name) => <button type="button" className="file-row" key={name}><i /><span className="template-mark"><Icon name="skull" /></span><span>{name}</span></button>)}
            <div className="folder-row"><span /><Icon name="chevronDown" /><Icon name="folder" /><b>场景</b><small>24</small></div>
            {(["荒废林地", "熔岩裂谷"]).map((name) => <button type="button" className="file-row" key={name}><i /><span className="template-mark environment">⌁</span><span>{name}</span></button>)}
            <div className="folder-row"><span /><Icon name="chevronRight" /><Icon name="folder" /><b>装备</b><small>18</small></div>
            <div className="folder-row"><span /><Icon name="chevronRight" /><Icon name="folder" /><b>自定义</b><small>0</small></div>
          </div>
          <footer><span>128 个资源</span><span>名称 ↑</span></footer>
        </aside>

        <section className="creator-workbench">
          <nav className="resource-tabs" aria-label="打开的资源">
            <button type="button" className="is-current"><Icon name="skull" /><span>{data.名称}</span>{active.dirty && <i aria-label="已修改">●</i>}<Icon name="x" /></button>
            <button type="button" className="is-preview"><Icon name="skull" /><em>洞穴守卫</em><Icon name="x" /></button>
            <button type="button"><Icon name="skull" /><span>灰烬先知</span><Icon name="x" /></button>
          </nav>
          <div className="workbench-body">
            <section className="authoring-editor">
              <div className="field-group identity-fields">
                <div className="field-row"><Field className="name-field" label="名称" value={data.名称} onChange={(value) => updateField("名称", value)} /><Field className="tier-field" label="位阶" value={data.位阶} onChange={(value) => updateField("位阶", value)} /></div>
                <div className="field-row"><Field className="name-field" label="英文" value={data.原文} onChange={(value) => updateField("原文", value)} /><Field className="tier-field" label="种类" value={data.种类} onChange={(value) => updateField("种类", value)} /></div>
                <Field className="full-field" label="简介" value={data.简介} onChange={(value) => updateField("简介", value)} />
              </div>

              <div className="field-group combat-fields">
                <div className="field-row"><Field className="motive-field" label="动机与战术" value={data.动机与战术} onChange={(value) => updateField("动机与战术", value)} /><Field className="experience-field" label="经历" value={data.经历} onChange={(value) => updateField("经历", value)} /></div>
                <div className="field-row dense-row">
                  <Field className="value-field" label="生命" value={data.生命点} onChange={(value) => updateField("生命点", value)} />
                  <Field className="value-field" label="压力" value={data.压力点} onChange={(value) => updateField("压力点", value)} />
                  <Field className="difficulty-field" label="难度" value={data.难度} onChange={(value) => updateField("难度", value)} />
                  <Field className="threshold-field" label="重度阈值" value={data.重度伤害阈值} onChange={(value) => updateField("重度伤害阈值", value)} />
                  <Field className="threshold-field" label="严重阈值" value={data.严重伤害阈值} onChange={(value) => updateField("严重伤害阈值", value)} />
                </div>
                <div className="field-row dense-row attack-row">
                  <Field className="attack-field" label="攻击" value={data.攻击命中} onChange={(value) => updateField("攻击命中", value)} />
                  <Field className="weapon-field" label="武器" value={data.攻击武器} onChange={(value) => updateField("攻击武器", value)} />
                  <Field className="weapon-field" label="范围" value={data.攻击范围} onChange={(value) => updateField("攻击范围", value)} />
                  <Field className="damage-field" label="伤害" value={data.攻击伤害} onChange={(value) => updateField("攻击伤害", value)} />
                  <Field className="damage-field" label="类型" value={data.攻击属性} onChange={(value) => updateField("攻击属性", value)} />
                </div>
              </div>

              <section className="features-editor">
                <header><h2>特性</h2><button type="button" onClick={() => updateData((draft) => { draft.特性.push({ 名称: "新特性", 原名: "", 类型: "动作", 特性描述: "" }); })}>＋ 新增特性</button></header>
                {data.特性.map((feature, index) => <article className="feature-editor" key={`${feature.名称}:${index}`}>
                  <div className="feature-line"><Icon name="grip" /><Field className="feature-name" label="特性名" value={feature.名称} onChange={(value) => updateFeature(index, "名称", value)} /><Field className="feature-type" label="类型" value={feature.类型} onChange={(value) => updateFeature(index, "类型", value)} /><div className="feature-actions">
                    <button type="button" aria-label={`${feature.名称 || "未命名特性"}菜单`} aria-haspopup="menu" aria-expanded={openFeatureMenu === index} onClick={() => setOpenFeatureMenu((current) => current === index ? null : index)}><Icon name="ellipsis" /></button>
                    {openFeatureMenu === index && <div className="feature-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => clearFeature(index)}>清空内容</button>
                      <button type="button" role="menuitem" className="delete" onClick={() => requestFeatureDeletion(index, feature.名称)}>删除特性</button>
                    </div>}
                  </div></div>
                  <div className="feature-line description-line"><span /><TextareaField label="描述" value={feature.特性描述} onChange={(value) => updateFeature(index, "特性描述", value)} /></div>
                </article>)}
              </section>
            </section>

            <aside className="preview-panel">
              <header><h1>实时预览</h1><div>
                <div className="card-mode" role="group" aria-label="卡面模式">
                  {(["text", "split", "image"] as const).map((mode) => <button
                    type="button"
                    key={mode}
                    aria-pressed={resource.presentation.mode === mode}
                    onClick={() => updatePresentation((presentation) => { presentation.mode = mode; })}
                  >{{ text: "纯文字", split: "半图半文字", image: "纯图片" }[mode]}</button>)}
                </div>
                <button
                  type="button"
                  className="fixed-ratio"
                  role="switch"
                  aria-checked={resource.presentation.fixedRatio}
                  onClick={() => updatePresentation((presentation) => { presentation.fixedRatio = !presentation.fixedRatio; })}
                ><span>固定比例</span><i /></button>
                <button type="button"><Icon name="maximize" />适配</button><strong>70%</strong>
              </div></header>
              <div className="preview-stage"><div className="card-scale"><CanonicalCardSurface
                resource={previewResource}
                expectedRendererRevision="enemy-card-r1"
                renderer={adversaryRendererRevision}
                assets={previewAssets}
                label={`${data.名称 || "未命名敌人"}规范卡面`}
              /></div></div>
              <footer className="preview-media"><span className="media-icon"><Icon name="image" /></span><strong>{resource.media.portrait ? "portrait 已声明" : "纯文字模式"}</strong><button type="button" onClick={() => portraitRef.current?.click()}><Icon name="image" />替换</button></footer>
            </aside>
          </div>
        </section>
      </div>

      <input ref={importRef} hidden type="file" accept=".pbres" onChange={importPackage} />
      <input ref={portraitRef} hidden type="file" accept="image/webp" onChange={replacePortraitFromFile} />

      {dialog && <div className="dialog-backdrop" role="presentation"><section className="dialog" role="dialog" aria-modal="true">
        {dialog.kind === "new" && <><h2>新建资源包</h2><Field className="dialog-field" label="名称" value={newName} onChange={setNewName} />
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" onClick={createWorkspaceFromDialog}>创建</button></div></>}
        {dialog.kind === "diagnostics" && <><h2>{dialog.title}</h2><ul className="diagnostics">{dialog.diagnostics.map((item) =>
          <li key={`${item.code}:${item.location}`}><b>{item.code}</b><code>{item.location || "/"}</code></li>)}</ul>
          <div className="dialog-actions"><button type="button" className="primary" onClick={() => setDialog(null)}>保留现状</button></div></>}
        {dialog.kind === "no-op" && <><h2>NO-OP · 同版本 / 同 Digest</h2><p>{dialog.name} 已是当前完整 Snapshot，不创建副本、不覆盖。</p>
          <div className="dialog-actions"><button type="button" className="primary" onClick={() => setDialog(null)}>打开现有 Workspace</button></div></>}
        {dialog.kind === "update" && <><h2>更新现有 Workspace</h2><p>当前 Workspace 未修改；导入内容 Digest 不同。确认后才替换。</p>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" onClick={() => commitIncoming(dialog.incoming)}>更新现有</button></div></>}
        {dialog.kind === "conflict" && <><h2>dirty 同 ID 冲突</h2><p>当前 Workspace 有本地修改，禁止自动合并。</p>
          <div className="conflict-choices"><button type="button" onClick={() => setDialog(null)}>取消（零写入）</button>
            <button type="button" onClick={() => saveAsideThenImport(dialog.incoming)}>另存 · 新 Package ID / 1.0.0</button>
            <button type="button" className="danger" onClick={() => commitIncoming(dialog.incoming)}>覆盖 · 丢弃本地修改</button></div></>}
        {dialog.kind === "delete-feature" && <><h2>删除特性</h2><p>删除“{dialog.name || "未命名特性"}”？此操作会立即从当前资源中移除该特性。</p>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="danger" onClick={() => deleteFeature(dialog.index)}>删除</button></div></>}
      </section></div>}
    </main>
  );
}
