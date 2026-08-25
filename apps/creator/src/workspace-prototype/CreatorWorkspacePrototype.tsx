import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  loadPbtab,
  loadPbres,
  writePbtab,
  writePbres,
  type ContractDiagnostic,
  type ResourcePackageCandidate,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore } from "@pbdh/local-storage";
import {
  createBrowserImageAdmission,
  publicationCoverPolicy,
  resourceImagePolicy,
  type ImageAdmissionPolicy,
} from "@pbdh/media-admission";
import { useAuth } from "@pbdh/platform-auth/provider";
import { PlatformAppBar } from "@pbdh/platform-ui";
import { CanonicalCardSurface } from "@pbdh/resource-renderer/react";
import {
  createTabletopDocument,
  executeTabletopCommand,
  type TabletopCapability,
  type TabletopCommand,
  type TabletopDocumentModel,
  type TabletopInstance,
  type TabletopInstanceResourceCopy,
} from "@pbdh/tabletop/core";
import { TabletopSurface } from "@pbdh/tabletop/react";
import {
  adversaryRendererFor,
  weaponAuthoringLayout,
  weaponRendererFor,
} from "@pbdh/templates/frontend";
import {
  adversaryTemplate,
  templateRegistry,
  weaponTemplate,
  type AdversaryData,
  type AdversaryFeature,
  type WeaponData,
} from "@pbdh/templates/core";

import { creatorWorkspaceDesign } from "./design.generated.ts";
import { CreatorWorkspaceRepository } from "./creator-workspace-repository.ts";
import {
  creatorMarketHandoffMismatch,
  parseCreatorMarketHandoff,
  withoutCreatorMarketHandoff,
  type CreatorMarketHandoff,
} from "./market-handoff.ts";
import { preparePublicationCandidate } from "./publication-candidate.ts";
import { PublicationApiError, publishCandidate } from "./publication-api.ts";
import { publicationErrorMessage, publicationSuccessMessage } from "./publication-feedback.ts";
import { validateResourcePackageCandidate } from "./resource-package-validator.ts";
import { TabletopDocumentRepository } from "./tabletop-document-repository.ts";
import { validateTabletopDocumentCandidate } from "./tabletop-document-validator.ts";
import { snapshotWorkspaceResourceForTabletop } from "./tabletop-placement.ts";
import { WorkspaceTree } from "./WorkspaceTree.tsx";
import {
  adversaryData,
  addTemplateResource,
  clearAdversaryFeature,
  closeWorkspaceResourceTab,
  createBlankWorkspace,
  createWorkspace,
  createWorkspaceFolder,
  deleteWorkspaceNode,
  deleteAdversaryFeature,
  duplicateWorkspaceResource,
  forkCurrentWorkspace,
  moveWorkspaceNode,
  pinWorkspaceResource,
  planImport,
  prepareWorkspaceExport,
  previewWorkspaceResource,
  renameWorkspaceFolder,
  replacePortrait,
  selectWorkspaceFolder,
  toggleWorkspaceFolder,
  updateAdversaryData,
  updateResourcePresentation,
  updateWeaponData,
  weaponData,
  type CreatorWorkspace,
  type WorkspaceNodeRef,
  type WorkspaceResource,
} from "./workspace-model.ts";

type Dialog =
  | { kind: "new" }
  | { kind: "new-resource" }
  | { kind: "publish" }
  | { kind: "diagnostics"; title: string; diagnostics: ContractDiagnostic[] }
  | { kind: "no-op"; name: string }
  | { kind: "update"; incoming: ResourcePackageCandidate; handoff?: CreatorMarketHandoff }
  | { kind: "conflict"; incoming: ResourcePackageCandidate; handoff?: CreatorMarketHandoff }
  | { kind: "delete-feature"; index: number; name: string; target: "workspace" | "instance" }
  | { kind: "delete-workspace-node"; node: WorkspaceNodeRef; name: string }
  | { kind: "close-workspace"; workspaceKey: string; name: string }
  | { kind: "new-tabletop" }
  | { kind: "rename-tabletop"; tabletopId: string }
  | { kind: "delete-tabletop"; tabletopId: string; name: string }
  | null;

type TabletopContextMenu =
  | { kind: "resource"; resourceId: string; x: number; y: number }
  | { kind: "instance"; instanceId: string; x: number; y: number }
  | { kind: "canvas"; x: number; y: number }
  | { kind: "workspace"; workspaceKey: string; x: number; y: number }
  | null;

type PublicationCoverDraft = {
  assetId: string;
  url: string;
  asset?: ResourcePackageLogicalDocument["assets"][number];
  bytes?: Uint8Array;
};

const gmCapabilities = new Set<TabletopCapability>([
  "place",
  "move",
  "uniform-scale",
  "duplicate",
  "delete",
  "edit-instance-resource",
  "template-state-command",
]);

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

function TagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft("");
  };
  return <div className="compact-field publication-tag-field">
    <span>发现标签</span>
    <div className="publication-tag-editor">
      {tags.map((tag) => <span className="publication-tag" key={tag}>{tag}<button type="button" aria-label={`删除标签${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag))}>×</button></span>)}
      <input
        value={draft}
        aria-label="新增标签"
        placeholder="输入后按回车"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          } else if (event.key === "Backspace" && !draft && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
      />
    </div>
  </div>;
}

const publicationLicenses = {
  "public-domain": {
    label: "公有领域",
    declaration: "作者声明该资源属于公有领域。",
  },
  "cc0-1.0": {
    label: "CC0 1.0",
    declaration: "Creative Commons CC0 1.0 Universal",
  },
  "cc-by-4.0": {
    label: "CC BY 4.0",
    declaration: "Creative Commons Attribution 4.0 International",
  },
  "cc-by-sa-4.0": {
    label: "CC BY-SA 4.0",
    declaration: "Creative Commons Attribution-ShareAlike 4.0 International",
  },
  "all-rights-reserved": {
    label: "保留所有权利",
    declaration: "All rights reserved.",
  },
} as const;

type PublicationLicenseId = keyof typeof publicationLicenses;

function publicationLicenseId(label: string): PublicationLicenseId {
  return (Object.entries(publicationLicenses).find(([, license]) => license.label === label)?.[0]
    ?? "public-domain") as PublicationLicenseId;
}

const iconPaths = {
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  check: ["m5 12 4 4L19 6"],
  chevronDown: ["m6 9 6 6 6-6"],
  chevronRight: ["m9 18 6-6-6-6"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  ellipsis: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  filePlus: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z", "M14 2v6h6", "M12 18v-6", "M9 15h6"],
  folder: ["M3 6h6l2 2h10v11H3Z"],
  folderPlus: ["M3 6h6l2 2h10v11H3Z", "M12 11v6", "M9 14h6"],
  grip: ["M9 5h.01", "M15 5h.01", "M9 12h.01", "M15 12h.01", "M9 19h.01", "M15 19h.01"],
  image: ["M3 5h18v14H3Z", "m3 16 5-5 4 4 3-3 3 4", "M14.5 9.5h.01"],
  package: ["m12 3 9 5-9 5-9-5Z", "m3 8 9 5 9-5", "M3 8v9l9 5 9-5V8", "M12 13v9"],
  packagePlus: ["m12 3 9 5-9 5-9-5Z", "M3 8v9l9 5 9-5V8", "M12 13v9", "M17 4v6", "M14 7h6"],
  search: ["m21 21-4.3-4.3", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20h-3v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 14.7a1.7 1.7 0 0 0-1.55-1H5v-3h.09A1.7 1.7 0 0 0 6.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.3 3.8V3h3v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19 8.3a1.7 1.7 0 0 0 1.55 1H21v3h-.09A1.7 1.7 0 0 0 19.4 15Z"],
  skull: ["M8 19v2", "M12 19v2", "M16 19v2", "M5 12a7 7 0 1 1 14 0v4l-3 3H8l-3-3Z", "M9 13h.01", "M15 13h.01"],
  sword: ["m14.5 17.5-8-8", "m11 6 6-3-3 6", "m5 14-2 2 5 5 2-2", "m14 9 7-7", "m15 4 5 5"],
  upload: ["M12 21V9", "m7 14 5-5 5 5", "M5 3h14"],
  user: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"],
  x: ["M18 6 6 18", "m6 6 12 12"],
} satisfies Record<string, string[]>;

function Icon({ name }: { name: keyof typeof iconPaths }) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    {iconPaths[name].map((path) => <path key={path} d={path} />)}
  </svg>;
}

function AdversaryEditor({
  data,
  openFeatureMenu,
  onField,
  onFeature,
  onAddFeature,
  onToggleFeatureMenu,
  onClearFeature,
  onDeleteFeature,
}: {
  data: AdversaryData;
  openFeatureMenu: number | null;
  onField: (field: Exclude<keyof AdversaryData, "特性">, value: string) => void;
  onFeature: (index: number, field: keyof AdversaryFeature, value: string) => void;
  onAddFeature: () => void;
  onToggleFeatureMenu: (index: number) => void;
  onClearFeature: (index: number) => void;
  onDeleteFeature: (index: number, name: string) => void;
}) {
  return <section className="authoring-editor">
    <div className="field-group identity-fields">
      <div className="field-row"><Field className="name-field" label="名称" value={data.名称} onChange={(value) => onField("名称", value)} /><Field className="tier-field" label="位阶" value={data.位阶} onChange={(value) => onField("位阶", value)} /></div>
      <div className="field-row"><Field className="name-field" label="英文" value={data.原文} onChange={(value) => onField("原文", value)} /><Field className="tier-field" label="种类" value={data.种类} onChange={(value) => onField("种类", value)} /></div>
      <Field className="full-field" label="简介" value={data.简介} onChange={(value) => onField("简介", value)} />
    </div>
    <div className="field-group combat-fields">
      <div className="field-row"><Field className="motive-field" label="动机与战术" value={data.动机与战术} onChange={(value) => onField("动机与战术", value)} /><Field className="experience-field" label="经历" value={data.经历} onChange={(value) => onField("经历", value)} /></div>
      <div className="field-row dense-row">
        <Field className="value-field" label="生命" value={data.生命点} onChange={(value) => onField("生命点", value)} />
        <Field className="value-field" label="压力" value={data.压力点} onChange={(value) => onField("压力点", value)} />
        <Field className="difficulty-field" label="难度" value={data.难度} onChange={(value) => onField("难度", value)} />
        <Field className="threshold-field" label="重度阈值" value={data.重度伤害阈值} onChange={(value) => onField("重度伤害阈值", value)} />
        <Field className="threshold-field" label="严重阈值" value={data.严重伤害阈值} onChange={(value) => onField("严重伤害阈值", value)} />
      </div>
      <div className="field-row dense-row attack-row">
        <Field className="attack-field" label="攻击" value={data.攻击命中} onChange={(value) => onField("攻击命中", value)} />
        <Field className="weapon-field" label="武器" value={data.攻击武器} onChange={(value) => onField("攻击武器", value)} />
        <Field className="weapon-field" label="范围" value={data.攻击范围} onChange={(value) => onField("攻击范围", value)} />
        <Field className="damage-field" label="伤害" value={data.攻击伤害} onChange={(value) => onField("攻击伤害", value)} />
        <Field className="damage-field" label="类型" value={data.攻击属性} onChange={(value) => onField("攻击属性", value)} />
      </div>
    </div>
    <section className="features-editor">
      <header><h2>特性</h2><button type="button" onClick={onAddFeature}>＋ 新增特性</button></header>
      {data.特性.map((feature, index) => <article className="feature-editor" key={`${feature.名称}:${index}`}>
        <div className="feature-line"><Icon name="grip" /><Field className="feature-name" label="特性名" value={feature.名称} onChange={(value) => onFeature(index, "名称", value)} /><Field className="feature-type" label="类型" value={feature.类型} onChange={(value) => onFeature(index, "类型", value)} /><div className="feature-actions">
          <button type="button" aria-label={`${feature.名称 || "未命名特性"}菜单`} aria-haspopup="menu" aria-expanded={openFeatureMenu === index} onClick={() => onToggleFeatureMenu(index)}><Icon name="ellipsis" /></button>
          {openFeatureMenu === index && <div className="feature-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => onClearFeature(index)}>清空内容</button>
            <button type="button" role="menuitem" className="delete" onClick={() => onDeleteFeature(index, feature.名称)}>删除特性</button>
          </div>}
        </div></div>
        <div className="feature-line description-line"><span /><TextareaField label="描述" value={feature.特性描述} onChange={(value) => onFeature(index, "特性描述", value)} /></div>
      </article>)}
    </section>
  </section>;
}

function WeaponEditor({ data, onField }: { data: WeaponData; onField: (field: keyof WeaponData, value: string) => void }) {
  return <section className="authoring-editor weapon-authoring-editor">
    {weaponAuthoringLayout.sections.map((section) => <div className={`field-group weapon-field-grid ${section.id}`} key={section.id}>
      {section.fields.map((field) => {
        const key = field.path as keyof WeaponData;
        return field.control === "textarea"
          ? <TextareaField key={field.path} label={field.label} value={data[key]} onChange={(value) => onField(key, value)} />
          : <Field key={field.path} label={field.label} value={data[key]} onChange={(value) => onField(key, value)} />;
      })}
    </div>)}
  </section>;
}

type TemplateBoundResource = { template: { id: string; version: string } };

function isTemplate(resource: TemplateBoundResource, template: { id: string; version: string }): boolean {
  return resource.template.id === template.id && resource.template.version === template.version;
}

function resourceTitle(resource: WorkspaceResource): string {
  const template = templateRegistry.resolve(resource.template.id, resource.template.version);
  return template?.project(resource.data).title ?? resource.id;
}

function ResourceIcon({ resource }: { resource: TemplateBoundResource }) {
  return <Icon name={isTemplate(resource, weaponTemplate) ? "sword" : "skull"} />;
}

function AutoFitPreview({ children }: { children: ReactNode }) {
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
      setScale(Math.min(1, Math.max(0.1, (stage.clientWidth - 40) / width), Math.max(0.1, (stage.clientHeight - 44) / height)));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    observer.observe(card);
    fit();
    return () => observer.disconnect();
  }, [children]);

  return <div ref={stageRef} className="preview-stage"><div ref={cardRef} className="card-scale" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>{children}</div></div>;
}

function bytesToUrlMap(candidate: ResourcePackageCandidate): Map<string, string> {
  return new Map([...candidate.media].map(([id, bytes]) => [
    id,
    URL.createObjectURL(new Blob([
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    ], { type: "image/webp" })),
  ]));
}

const imageAdmission = createBrowserImageAdmission();

async function imageAsset(file: File, policy: ImageAdmissionPolicy) {
  const admitted = await imageAdmission.admit(file, policy);
  const asset = {
    id: admitted.id,
    mediaType: "image/webp" as const,
    byteLength: String(admitted.byteLength),
    width: String(admitted.width),
    height: String(admitted.height),
  };
  return { asset, bytes: admitted.bytes, blob: admitted.blob };
}

export function CreatorWorkspacePrototype() {
  const auth = useAuth();
  const [workspaces, setWorkspaces] = useState<CreatorWorkspace[]>([]);
  const [activeKey, setActiveKey] = useState("");
  const [activeResourceId, setActiveResourceId] = useState("");
  const [assetUrls, setAssetUrls] = useState<Map<string, string>>(() => new Map());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [newName, setNewName] = useState("牛头人敌人资源包");
  const [publicationTitle, setPublicationTitle] = useState("");
  const [publicationSummary, setPublicationSummary] = useState("");
  const [publicationLanguage, setPublicationLanguage] = useState("中文");
  const [publicationTags, setPublicationTags] = useState<string[]>(["敌人", "Daggerheart"]);
  const [publicationLicense, setPublicationLicense] = useState<PublicationLicenseId>("public-domain");
  const [publicationCover, setPublicationCover] = useState<PublicationCoverDraft>({ assetId: "", url: "" });
  const [openFeatureMenu, setOpenFeatureMenu] = useState<number | null>(null);
  const [appMode, setAppMode] = useState<"creator" | "gm">("creator");
  const [tabletops, setTabletops] = useState<TabletopDocumentModel[]>([]);
  const [activeTabletopId, setActiveTabletopId] = useState("");
  const [tabletopNameDraft, setTabletopNameDraft] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [tabletopView, setTabletopView] = useState<"canvas" | "instance-editor">("canvas");
  const [canvasZoom, setCanvasZoom] = useState(0.8);
  const [tabletopContextMenu, setTabletopContextMenu] = useState<TabletopContextMenu>(null);
  const [workspaceStorageReady, setWorkspaceStorageReady] = useState(false);
  const [tabletopStorageReady, setTabletopStorageReady] = useState(false);
  const [tabletopMedia, setTabletopMedia] = useState<Map<string, Uint8Array>>(() => new Map());
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const canvasPanRef = useRef<null | {
    pointerId: number;
    button: number;
    startPointer: { x: number; y: number };
    startPan: { x: number; y: number };
    moved: boolean;
  }>(null);
  const suppressCanvasContextMenuRef = useRef(false);
  const tabletopViewportRef = useRef<HTMLDivElement>(null);
  const marketHandoffStartedRef = useRef(false);
  const workspaceWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const tabletopWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [notice, setNotice] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const tabletopImportRef = useRef<HTMLInputElement>(null);
  const portraitRef = useRef<HTMLInputElement>(null);
  const publicationCoverRef = useRef<HTMLInputElement>(null);
  const localDocumentStore = useMemo(() => new DexieLocalDocumentStore(), []);
  const creatorWorkspaceRepository = useMemo(() => new CreatorWorkspaceRepository(localDocumentStore), [localDocumentStore]);
  const tabletopRepository = useMemo(() => new TabletopDocumentRepository(localDocumentStore), [localDocumentStore]);
  const active = workspaces.find((workspace) => workspace.key === activeKey) ?? workspaces[0];
  const activeTabletop = tabletops.find((tabletop) => tabletop.id === activeTabletopId);
  const selectedInstance = activeTabletop?.instances.find((instance) => instance.id === selectedInstanceId);

  useEffect(() => {
    let cancelled = false;
    creatorWorkspaceRepository.list()
      .then((stored) => {
        if (cancelled || stored.length === 0) return;
        setWorkspaces(stored);
        const restoredActive = stored[0];
        setActiveKey(restoredActive?.key ?? "");
        setActiveResourceId(restoredActive?.openResourceIds[0] ?? "");
        setAssetUrls((current) => new Map([
          ...current,
          ...stored.flatMap((workspace) => [...bytesToUrlMap(workspace)]),
        ]));
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "工作区恢复失败"))
      .finally(() => {
        if (!cancelled) setWorkspaceStorageReady(true);
      });
    return () => { cancelled = true; };
  }, [creatorWorkspaceRepository]);

  useEffect(() => {
    if (!workspaceStorageReady || !tabletopStorageReady || marketHandoffStartedRef.current) return;
    const handoff = parseCreatorMarketHandoff(window.location.href);
    if (!handoff) return;
    marketHandoffStartedRef.current = true;
    const cleanedUrl = withoutCreatorMarketHandoff(window.location.href);
    window.history.replaceState(null, "", `${cleanedUrl.pathname}${cleanedUrl.search}${cleanedUrl.hash}`);
    fetch(`/api/publications/${encodeURIComponent(handoff.publicationId)}/download`)
      .then(async (response) => {
        if (!response.ok) throw new Error("无法取得市场资源包");
        return new Uint8Array(await response.arrayBuffer());
      })
      .then((bytes) => loadPbres(bytes, validateResourcePackageCandidate))
      .then((result) => {
        if (!result.candidate) {
          setDialog({ kind: "diagnostics", title: "市场导入失败 · 零写入", diagnostics: result.diagnostics });
          return;
        }
        const mismatch = creatorMarketHandoffMismatch(handoff, result.candidate);
        if (mismatch) {
          setDialog({
            kind: "diagnostics",
            title: "市场导入失败 · 零写入",
            diagnostics: [{
              code: mismatch,
              severity: "error",
              family: "creator-prototype",
              version: "1",
              location: "/snapshotDigest",
              params: {},
            }],
          });
          return;
        }
        acceptIncoming(result.candidate, handoff);
      })
      .catch((error) => setDialog({
        kind: "diagnostics",
        title: "市场导入失败 · 零写入",
        diagnostics: [{
          code: "creator.market-handoff.request-failed",
          severity: "error",
          family: "creator-prototype",
          version: "1",
          location: "/publication",
          params: { message: error instanceof Error ? error.message : "unknown" },
        }],
      }));
  }, [tabletopStorageReady, workspaceStorageReady]);

  useEffect(() => {
    if (!workspaceStorageReady) return;
    const timeout = window.setTimeout(() => {
      const selected = workspaces.find((workspace) => workspace.key === activeKey);
      const write = workspaceWriteQueueRef.current.then(async () => {
        await Promise.all(workspaces.map((workspace) => creatorWorkspaceRepository.save(workspace)));
        if (selected) await creatorWorkspaceRepository.save(selected);
      });
      workspaceWriteQueueRef.current = write.catch(() => undefined);
      write.catch((error) => setNotice(error instanceof Error ? error.message : "工作区保存失败"));
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [activeKey, creatorWorkspaceRepository, workspaceStorageReady, workspaces]);

  useEffect(() => {
    let cancelled = false;
    tabletopRepository.list()
      .then((stored) => {
        if (cancelled || stored.length === 0) return;
        const models = stored.map((item) => item.model);
        const media = new Map(stored.flatMap((item) => [...item.media]));
        setTabletops(models);
        setActiveTabletopId(models[0]!.id);
        setSelectedInstanceId("");
        setTabletopMedia(media);
        setAssetUrls((current) => new Map([...current, ...[...media].map(([id, bytes]) => [
          id,
          URL.createObjectURL(new Blob([
            bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
          ], { type: "image/webp" })),
        ] as const)]));
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "桌面恢复失败"))
      .finally(() => {
        if (!cancelled) setTabletopStorageReady(true);
      });
    return () => { cancelled = true; };
  }, [tabletopRepository]);

  const resource = active?.document.resources.find((candidate) => candidate.id === activeResourceId);
  const isAdversary = Boolean(resource && isTemplate(resource, adversaryTemplate));
  const isWeapon = Boolean(resource && isTemplate(resource, weaponTemplate));
  const adversary = active && resource && isAdversary ? adversaryData(active, resource.id) : undefined;
  const weapon = active && resource && isWeapon ? weaponData(active, resource.id) : undefined;
  const adversaryPreviewResource = resource && adversary ? { ...resource, data: adversary } : undefined;
  const weaponPreviewResource = resource && weapon ? { ...resource, data: weapon } : undefined;
  const previewAssets = useMemo(() => new Map(
    resource
      ? Object.values(resource.media).flatMap((id) => {
          const url = assetUrls.get(id);
          return url ? [[id, { status: "ready" as const, url }] as const] : [];
        })
      : [],
  ), [assetUrls, resource]);
  const allTabletopMedia = useMemo(() => new Map([
    ...tabletopMedia,
    ...workspaces.flatMap((workspace) => [...workspace.media]),
  ]), [tabletopMedia, workspaces]);

  useEffect(() => {
    if (!tabletopStorageReady) return;
    const timeout = window.setTimeout(() => {
      const write = tabletopWriteQueueRef.current.then(async () => {
        await Promise.all(tabletops.map((tabletop) =>
          tabletopRepository.save(tabletop, allTabletopMedia)));
      });
      tabletopWriteQueueRef.current = write.catch(() => undefined);
      write.catch((error) => setNotice(error instanceof Error ? error.message : "桌面保存失败"));
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [allTabletopMedia, tabletopRepository, tabletopStorageReady, tabletops]);

  useEffect(() => {
    if (!tabletopContextMenu) return;
    const close = () => setTabletopContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [tabletopContextMenu]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const viewport = tabletopViewportRef.current;
    if (!viewport || appMode !== "gm" || tabletopView !== "canvas") return;
    const zoomAtPointer = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const nextZoom = Math.min(1.6, Math.max(0.4, canvasZoom * Math.exp(-event.deltaY * 0.002)));
      const world = {
        x: (pointer.x - canvasPan.x) / canvasZoom,
        y: (pointer.y - canvasPan.y) / canvasZoom,
      };
      setCanvasZoom(nextZoom);
      setCanvasPan({ x: pointer.x - world.x * nextZoom, y: pointer.y - world.y * nextZoom });
    };
    viewport.addEventListener("wheel", zoomAtPointer, { passive: false });
    return () => viewport.removeEventListener("wheel", zoomAtPointer);
  }, [appMode, canvasPan, canvasZoom, tabletopView]);

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
  } as CSSProperties;

  function replaceActive(next: CreatorWorkspace) {
    if (!active) return;
    setWorkspaces((current) => current.map((workspace) => workspace.key === active.key ? next : workspace));
    setActiveKey(next.key);
  }

  function switchWorkspace(workspaceKey: string) {
    const next = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!next) return;
    setActiveKey(next.key);
    setActiveResourceId(next.openResourceIds[0] ?? "");
    setTabletopContextMenu(null);
  }

  function requestWorkspacePackageClose(workspaceKey: string) {
    const workspace = workspaces.find((candidate) => candidate.key === workspaceKey);
    if (!workspace) return;
    setTabletopContextMenu(null);
    setDialog({ kind: "close-workspace", workspaceKey, name: workspace.document.package.name });
  }

  async function closeWorkspacePackage(workspaceKey: string) {
    const closing = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!closing) return;
    const remaining = workspaces.filter((workspace) => workspace.key !== workspaceKey);
    setWorkspaces(remaining);
    if (active?.key === workspaceKey) {
      const next = remaining[0];
      setActiveKey(next?.key ?? "");
      setActiveResourceId(next?.openResourceIds[0] ?? "");
    }
    setTabletopContextMenu(null);
    setDialog(null);

    const removal = workspaceWriteQueueRef.current.then(() => creatorWorkspaceRepository.remove(workspaceKey));
    workspaceWriteQueueRef.current = removal.catch(() => undefined);
    try {
      await removal;
    } catch (error) {
      setWorkspaces((current) => current.some((workspace) => workspace.key === workspaceKey)
        ? current
        : [...current, closing]);
      setActiveKey(workspaceKey);
      setActiveResourceId(closing.openResourceIds[0] ?? "");
      setNotice(error instanceof Error ? error.message : "资源包关闭失败");
      return;
    }
    setNotice("资源包已关闭并删除");
  }

  function activateWorkspaceResource(resourceId: string) {
    if (!active) return;
    const next = previewWorkspaceResource(active, resourceId);
    const createdPreview = next.previewResourceId === resourceId && active.previewResourceId !== resourceId;
    setWorkspaces((current) => current.map((workspace) => {
      if (workspace.key === active.key) return next;
      if (createdPreview && workspace.previewResourceId) {
        return closeWorkspaceResourceTab(workspace, workspace.previewResourceId).workspace;
      }
      return workspace;
    }));
    setActiveKey(active.key);
    setActiveResourceId(resourceId);
  }

  function pinWorkspaceTab(resourceId: string) {
    if (!active) return;
    replaceActive(pinWorkspaceResource(active, resourceId));
    setActiveResourceId(resourceId);
  }

  function closeWorkspaceTab(workspaceKey: string, resourceId: string) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    const result = closeWorkspaceResourceTab(owner, resourceId);
    setWorkspaces((current) => current.map((workspace) => workspace.key === workspaceKey ? result.workspace : workspace));
    if (workspaceKey === active?.key && resourceId === activeResourceId) {
      if (result.nextResourceId) setActiveResourceId(result.nextResourceId);
      else {
        const fallback = workspaces
          .filter((workspace) => workspace.key !== workspaceKey)
          .flatMap((workspace) => workspace.openResourceIds.map((id) => ({ workspace, id })))[0];
        setActiveKey(fallback?.workspace.key ?? workspaceKey);
        setActiveResourceId(fallback?.id ?? "");
      }
    }
  }

  function moveWorkspaceTreeNode(node: WorkspaceNodeRef, parentId: string | null, index?: number): string | null {
    if (!active) return "没有打开的工作区";
    try {
      replaceActive(moveWorkspaceNode(active, node, parentId, index));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "无法移动节点";
    }
  }

  function renameWorkspaceTreeFolder(folderId: string, name: string): string | null {
    if (!active) return "没有打开的工作区";
    try {
      replaceActive(renameWorkspaceFolder(active, folderId, name));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "无法重命名文件夹";
    }
  }

  function requestWorkspaceNodeDeletion(node: WorkspaceNodeRef) {
    if (!active) return;
    const name = node.kind === "folder"
      ? active.folders.find((folder) => folder.id === node.id)?.name ?? "文件夹"
      : resourceTitle(active.document.resources.find((candidate) => candidate.id === node.id)!);
    setDialog({ kind: "delete-workspace-node", node, name });
  }

  function duplicateResource(resourceId: string) {
    if (!active) return;
    const result = duplicateWorkspaceResource(active, resourceId);
    replaceActive(result.workspace);
    setActiveResourceId(result.resourceId);
    setTabletopContextMenu(null);
  }

  function confirmWorkspaceNodeDeletion(node: WorkspaceNodeRef) {
    if (!active) return;
    const next = deleteWorkspaceNode(active, node);
    replaceActive(next);
    if (!next.document.resources.some((candidate) => candidate.id === activeResourceId)) {
      setActiveResourceId(next.openResourceIds[0] ?? "");
    }
    setTabletopContextMenu(null);
    setDialog(null);
  }

  function updateData(update: (draft: AdversaryData) => void) {
    if (active && resource) replaceActive(updateAdversaryData(active, update, resource.id));
  }

  function updateField(field: Exclude<keyof AdversaryData, "特性">, value: string) {
    updateData((draft) => { draft[field] = value; });
  }

  function updateWeaponField(field: keyof WeaponData, value: string) {
    if (active && resource) replaceActive(updateWeaponData(active, (draft) => {
      draft[field] = value;
    }, resource.id));
  }

  function updatePresentation(
    update: (presentation: CreatorWorkspace["document"]["resources"][number]["presentation"]) => void,
  ) {
    if (active && resource) replaceActive(updateResourcePresentation(active, update, resource.id));
  }

  function updateFeature(index: number, field: keyof AdversaryFeature, value: string) {
    updateData((draft) => { draft.特性[index]![field] = value; });
  }

  function applyTabletopCommand(command: TabletopCommand) {
    if (!activeTabletop) return;
    const result = executeTabletopCommand(activeTabletop, command, {
      capabilities: gmCapabilities,
      templateCommands: (instance) => templateRegistry.resolve(
        instance.resource.template.id,
        instance.resource.template.version,
      )?.tabletop.commands ?? [],
    });
    if (result.diagnostics.length > 0) {
      setNotice(result.diagnostics[0]!.code);
      return;
    }
    setTabletops((current) => current.map((tabletop) =>
      tabletop.id === activeTabletop.id ? result.document : tabletop));
  }

  function replaceInstanceResource(
    instance: TabletopInstance,
    update: (resourceCopy: Omit<TabletopInstanceResourceCopy, "source" | "template">) => void,
  ) {
    const next = structuredClone({
      presentation: instance.resource.presentation,
      data: instance.resource.data,
      labels: instance.resource.labels,
      media: instance.resource.media,
    });
    update(next);
    applyTabletopCommand({
      type: "replace-instance-resource",
      instanceId: instance.id,
      resource: next,
    });
  }

  function updateInstanceAdversary(update: (data: AdversaryData) => void) {
    if (!selectedInstance) return;
    replaceInstanceResource(selectedInstance, (resourceCopy) => update(resourceCopy.data as AdversaryData));
  }

  function updateInstanceWeapon(update: (data: WeaponData) => void) {
    if (!selectedInstance) return;
    replaceInstanceResource(selectedInstance, (resourceCopy) => update(resourceCopy.data as WeaponData));
  }

  function placeResource(resourceId: string, position?: { x: number; y: number }) {
    if (!active || !activeTabletop) return;
    const source = active.document.resources.find((candidate) => candidate.id === resourceId);
    if (!source) return;
    const template = templateRegistry.resolve(source.template.id, source.template.version);
    if (!template) return;
    let snapshot;
    try {
      snapshot = snapshotWorkspaceResourceForTabletop(active, resourceId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法复制桌面资源");
      return;
    }
    const instanceId = crypto.randomUUID();
    const sequence = activeTabletop.instances.length;
    setTabletopMedia((current) => new Map([...current, ...snapshot.media]));
    applyTabletopCommand({
      type: "place",
      instanceId,
      resource: snapshot.resource,
      state: template.tabletop.defaultState(source.data as never),
      position: position ?? { x: 56 + (sequence % 3) * 380, y: 88 + Math.floor(sequence / 3) * 180 },
      assets: snapshot.assets,
    });
    setSelectedInstanceId(instanceId);
    setTabletopView("canvas");
    setTabletopContextMenu(null);
  }

  function requestTabletopCreation() {
    setTabletopNameDraft(`新桌面 ${tabletops.length + 1}`);
    setDialog({ kind: "new-tabletop" });
  }

  function createTabletopFromDialog() {
    const name = tabletopNameDraft.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    setTabletops((current) => [...current, createTabletopDocument(id, name)]);
    setActiveTabletopId(id);
    setSelectedInstanceId("");
    setTabletopView("canvas");
    setTabletopContextMenu(null);
    setDialog(null);
  }

  function requestTabletopRename() {
    if (!activeTabletop) return;
    setTabletopNameDraft(activeTabletop.name);
    setTabletopContextMenu(null);
    setDialog({ kind: "rename-tabletop", tabletopId: activeTabletop.id });
  }

  function renameTabletopFromDialog(tabletopId: string) {
    const name = tabletopNameDraft.trim();
    if (!name) return;
    setTabletops((current) => current.map((tabletop) =>
      tabletop.id === tabletopId ? { ...tabletop, name } : tabletop));
    setDialog(null);
    setNotice(`桌面已重命名为“${name}”`);
  }

  async function deleteTabletop(tabletopId: string) {
    const remaining = tabletops.filter((tabletop) => tabletop.id !== tabletopId);
    const nextActiveId = activeTabletopId === tabletopId
      ? remaining[0]?.id ?? ""
      : activeTabletopId;
    setTabletops(remaining);
    setActiveTabletopId(nextActiveId);
    setSelectedInstanceId("");
    setTabletopView("canvas");
    setTabletopContextMenu(null);
    setDialog(null);

    const removal = tabletopWriteQueueRef.current.then(() => tabletopRepository.remove(tabletopId));
    tabletopWriteQueueRef.current = removal.catch(() => undefined);
    try {
      await removal;
      setNotice("桌面已删除");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "桌面删除失败");
    }
  }

  function duplicateSelectedInstance() {
    if (!selectedInstance) return;
    const id = crypto.randomUUID();
    applyTabletopCommand({ type: "duplicate", instanceId: selectedInstance.id, newInstanceId: id });
    setSelectedInstanceId(id);
    setTabletopContextMenu(null);
  }

  function deleteSelectedInstance() {
    if (!selectedInstance) return;
    applyTabletopCommand({ type: "delete", instanceId: selectedInstance.id });
    setSelectedInstanceId("");
    setTabletopContextMenu(null);
  }

  async function exportTabletop() {
    if (!activeTabletop) return;
    const candidate = await tabletopRepository.save(activeTabletop, allTabletopMedia);
    const bytes = writePbtab(candidate.document, candidate.media);
    const blob = new Blob([
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    ], { type: "application/vnd.pbdh.tabletop+zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeTabletop.name.replace(/[\\/:*?"<>|]/g, "-")}.pbtab`;
    anchor.click();
    URL.revokeObjectURL(url);
    setTabletopContextMenu(null);
  }

  async function importTabletop(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await loadPbtab(
      new Uint8Array(await file.arrayBuffer()),
      validateTabletopDocumentCandidate,
    );
    if (!result.candidate) {
      setDialog({ kind: "diagnostics", title: "导入失败 · 零写入", diagnostics: result.diagnostics });
      return;
    }
    const model = await tabletopRepository.import(result.candidate);
    setTabletopMedia((current) => new Map([...current, ...result.candidate!.media]));
    setAssetUrls((current) => new Map([
      ...current,
      ...[...result.candidate!.media].map(([id, bytes]) => [
        id,
        URL.createObjectURL(new Blob([
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        ], { type: "image/webp" })),
      ] as const),
    ]));
    setTabletops((current) => current.some((item) => item.id === model.id)
      ? current.map((item) => item.id === model.id ? model : item)
      : [...current, model]);
    setActiveTabletopId(model.id);
    setSelectedInstanceId("");
    setTabletopView("canvas");
    setTabletopContextMenu(null);
  }

  function clearFeature(index: number) {
    if (active && resource) replaceActive(clearAdversaryFeature(active, index, resource.id));
    setOpenFeatureMenu(null);
  }

  function deleteFeature(index: number, target: "workspace" | "instance" = "workspace") {
    if (target === "instance") {
      updateInstanceAdversary((draft) => { draft.特性.splice(index, 1); });
    } else if (active && resource) {
      replaceActive(deleteAdversaryFeature(active, index, resource.id));
    }
    setOpenFeatureMenu(null);
    setDialog(null);
  }

  function requestFeatureDeletion(index: number, name: string, target: "workspace" | "instance" = "workspace") {
    setOpenFeatureMenu(null);
    setDialog({ kind: "delete-feature", index, name, target });
  }

  function finishMarketHandoff(workspace: CreatorWorkspace, handoff: CreatorMarketHandoff) {
    const focusedResourceId = workspace.document.resources.some((item) => item.id === handoff.focusResourceId)
      ? handoff.focusResourceId
      : workspace.document.resources[0]?.id;
    setActiveKey(workspace.key);
    setActiveResourceId(focusedResourceId ?? "");
    if (handoff.target === "gm") {
      setAppMode("gm");
      setDialog(null);
      setNotice(`已从资源市场导入 ${workspace.document.package.name}`);
    } else {
      setAppMode("creator");
      setDialog(null);
      setNotice(`已从资源市场导入 ${workspace.document.package.name}`);
    }
  }

  function commitIncoming(candidate: ResourcePackageCandidate, handoff?: CreatorMarketHandoff) {
    const next = createWorkspace(candidate);
    setAssetUrls((current) => new Map([...current, ...bytesToUrlMap(candidate)]));
    setWorkspaces((current) => {
      const existing = current.findIndex((workspace) => workspace.document.package.id === next.document.package.id);
      if (existing < 0) return [...current, next];
      return current.map((workspace, index) => index === existing ? next : workspace);
    });
    setActiveKey(next.key);
    setActiveResourceId(next.document.resources[0]?.id ?? "");
    setDialog(null);
    const write = workspaceWriteQueueRef.current.then(() => creatorWorkspaceRepository.save(next));
    workspaceWriteQueueRef.current = write.catch(() => undefined);
    write.then(() => {
      if (handoff) finishMarketHandoff(next, handoff);
      else setNotice(`已载入 ${next.document.package.name}`);
    }).catch((error) => setNotice(error instanceof Error ? error.message : "工作区保存失败"));
  }

  function acceptIncoming(candidate: ResourcePackageCandidate, handoff?: CreatorMarketHandoff) {
    const existing = workspaces.find((workspace) =>
      workspace.document.package.id === candidate.document.package.id);
    const plan = planImport(existing, candidate);
    if (plan === "insert") commitIncoming(candidate, handoff);
    if (plan === "no-op") {
      setActiveKey(existing!.key);
      if (handoff) finishMarketHandoff(existing!, handoff);
      else setDialog({ kind: "no-op", name: candidate.document.package.name });
    }
    if (plan === "update") setDialog({ kind: "update", incoming: candidate, ...(handoff ? { handoff } : {}) });
    if (plan === "conflict") setDialog({ kind: "conflict", incoming: candidate, ...(handoff ? { handoff } : {}) });
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
    acceptIncoming(result.candidate);
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

  function openPublicationDialog() {
    if (!active) return;
    const coverAssetId = Object.values(resource?.media ?? {})[0] ?? active.document.assets[0]?.id ?? "";
    setPublicationTitle(active.document.package.name);
    setPublicationSummary(active.document.package.description);
    setPublicationLanguage("中文");
    setPublicationTags(resource?.template.id === weaponTemplate.id ? ["武器", "Daggerheart"] : ["敌人", "Daggerheart"]);
    setPublicationLicense(publicationLicenseId(active.document.license.label));
    setPublicationCover({ assetId: coverAssetId, url: assetUrls.get(coverAssetId) ?? "" });
    setDialog({ kind: "publish" });
  }

  async function replacePublicationCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { asset, bytes, blob } = await imageAsset(file, publicationCoverPolicy);
      setPublicationCover({ assetId: asset.id, asset, bytes, url: URL.createObjectURL(blob) });
    } catch {
      setDialog({
        kind: "diagnostics",
        title: "封面未接受 · 零写入",
        diagnostics: [{
          code: "creator.publication-cover.unsupported",
          severity: "error",
          family: "creator-prototype",
          version: "1",
          location: "/publication/cover",
          params: { expected: "JPEG, PNG or WebP" },
        }],
      });
    }
  }

  async function publishWorkspace() {
    if (!active) return;
    const result = await preparePublicationCandidate(active, {
      title: publicationTitle,
      summary: publicationSummary,
      language: publicationLanguage,
      tags: publicationTags,
      coverAssetId: publicationCover.assetId,
    }, publicationCover.asset && publicationCover.bytes
      ? { asset: publicationCover.asset, bytes: publicationCover.bytes }
      : undefined, publicationLicenses[publicationLicense]);
    if (!result.ok) {
      setDialog({ kind: "diagnostics", title: "发布门禁未通过", diagnostics: result.diagnostics });
      return;
    }
    if (!auth.credentials) {
      setDialog({
        kind: "diagnostics",
        title: "需要登录",
        diagnostics: [{
          code: "AUTH_REQUIRED",
          severity: "error",
          family: "creator-prototype",
          version: "1",
          location: "/publication",
          params: {},
        }],
      });
      return;
    }
    try {
      const published = await publishCandidate(result.candidate, auth.credentials);
      setNotice(publicationSuccessMessage(result.candidate.document.package.name, published.publication));
    } catch (error) {
      setDialog({
        kind: "diagnostics",
        title: "发布失败",
        diagnostics: [{
          code: error instanceof PublicationApiError ? error.code : "PUBLICATION_REQUEST_FAILED",
          severity: "error",
          family: "creator-prototype",
          version: "1",
          location: "/publication",
          params: { message: error instanceof Error ? error.message : "unknown" },
        }],
      });
      return;
    }
    replaceActive({
      ...active,
      document: result.candidate.document,
      media: result.candidate.media,
      dirty: false,
      dirtyResourceIds: [],
    });
    setDialog(null);
  }

  async function createWorkspaceFromDialog() {
    const next = await createBlankWorkspace(newName);
    setWorkspaces((current) => [...current, next]);
    setActiveKey(next.key);
    setActiveResourceId(next.document.resources[0]?.id ?? "");
    setDialog(null);
    setNotice("已显式创建空白 Workspace");
  }

  async function replacePortraitFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !active) return;
    try {
      const { asset, bytes, blob } = await imageAsset(file, resourceImagePolicy);
      const next = replacePortrait(active, asset, bytes, resource?.id);
      setAssetUrls((current) => new Map(current).set(asset.id, URL.createObjectURL(blob)));
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

  function createResource(template: typeof adversaryTemplate | typeof weaponTemplate) {
    if (!active) return;
    const result = addTemplateResource(active, template.id, template.version);
    replaceActive(result.workspace);
    setActiveResourceId(result.resourceId);
    setDialog(null);
  }

  async function saveAsideThenImport(incoming: ResourcePackageCandidate, handoff?: CreatorMarketHandoff) {
    const existing = workspaces.find((workspace) =>
      workspace.document.package.id === incoming.document.package.id);
    if (!existing) return commitIncoming(incoming, handoff);
    const fork = await forkCurrentWorkspace(existing);
    setWorkspaces((current) => [...current.filter((workspace) => workspace.key !== existing.key), fork]);
    commitIncoming(incoming, handoff);
    setNotice("本地修改已另存为新 Package ID；导入版本已载入");
  }

  const instanceAdversary = selectedInstance && selectedInstance.resource.template.id === adversaryTemplate.id
    ? selectedInstance.resource.data as AdversaryData
    : undefined;
  const instanceWeapon = selectedInstance && selectedInstance.resource.template.id === weaponTemplate.id
    ? selectedInstance.resource.data as WeaponData
    : undefined;

  function assetsFor(media: Record<string, string>) {
    return new Map(Object.values(media).flatMap((id) => {
      const url = assetUrls.get(id);
      return url ? [[id, { status: "ready" as const, url }] as const] : [];
    }));
  }

  function renderTabletopInstance(instance: TabletopInstance) {
    const instanceAssets = assetsFor(instance.resource.media);
    if (instance.resource.template.id === adversaryTemplate.id) {
      return <CanonicalCardSurface
        resource={instance.resource as TabletopInstance["resource"] & { data: AdversaryData }}
        expectedRendererRevision={adversaryTemplate.rendererRevision}
        renderer={adversaryRendererFor(instance.resource.template.version)}
        assets={instanceAssets}
        state={instance.state}
        onStateCommand={(commandId, value) => applyTabletopCommand({
          type: "template-state",
          instanceId: instance.id,
          commandId,
          value,
        })}
        label={`${(instance.resource.data as AdversaryData).名称}桌面实例`}
      />;
    }
    if (instance.resource.template.id === weaponTemplate.id) {
      return <CanonicalCardSurface
        resource={instance.resource as TabletopInstance["resource"] & { data: WeaponData }}
        expectedRendererRevision={weaponTemplate.rendererRevision}
        renderer={weaponRendererFor(instance.resource.template.version)}
        assets={instanceAssets}
        state={instance.state}
        label={`${(instance.resource.data as WeaponData).名称}桌面实例`}
      />;
    }
    return <div className="tabletop-renderer-error">无法呈现卡面</div>;
  }

  return (
    <main className="creator-prototype" style={designStyle} data-design-source={creatorWorkspaceDesign.document}>
      <PlatformAppBar
        activePage={appMode}
        onNavigate={{ creator: () => setAppMode("creator"), gm: () => setAppMode("gm") }}
      />
      <div className="creator-workspace">
        <aside className="resource-explorer">
          <header className="explorer-toolbar"><strong>资源管理器</strong><div>
            <button type="button" title="新建资源包" aria-label="新建资源包" onClick={() => setDialog({ kind: "new" })}><Icon name="packagePlus" /></button>
            <button type="button" title="导入资源包" aria-label="导入资源包" onClick={() => importRef.current?.click()}><Icon name="upload" /></button>
            <button type="button" title="导出资源包" aria-label="导出资源包" disabled={!active} onClick={exportPackage}><Icon name="download" /></button>
            <button type="button" title="发布到资源市场" aria-label="发布到资源市场" disabled={!active} onClick={openPublicationDialog}><Icon name="package" /></button>
            <button type="button" title="新建资源" aria-label="新建资源" disabled={!active} onClick={() => setDialog({ kind: "new-resource" })}><Icon name="filePlus" /></button>
            <button type="button" title="新建文件夹" aria-label="新建文件夹" disabled={!active} onClick={() => active && replaceActive(createWorkspaceFolder(active))}><Icon name="folderPlus" /></button>
          </div></header>
          <label className="explorer-search"><Icon name="search" /><input aria-label="筛选资源" placeholder="筛选资源" /></label>
          <div className="workspace-package-list">
            {workspaces.map((workspace) => <section className={`workspace-package${workspace.key === active?.key ? " is-current" : ""}`} key={workspace.key}>
              <div className={`package-root${workspace.key === active?.key ? " is-current" : ""}`} onContextMenu={(event) => {
                event.preventDefault();
                switchWorkspace(workspace.key);
                setTabletopContextMenu({ kind: "workspace", workspaceKey: workspace.key, x: event.clientX, y: event.clientY });
              }}>
                <button type="button" className="package-root-main" onClick={() => switchWorkspace(workspace.key)}>
                  <Icon name={workspace.key === active?.key ? "chevronDown" : "chevronRight"} /><Icon name="package" /><strong>{workspace.document.package.name}</strong>
                </button>
                <button type="button" aria-label={`${workspace.document.package.name}菜单`} onClick={(event) => {
                  switchWorkspace(workspace.key);
                  const bounds = event.currentTarget.getBoundingClientRect();
                  setTabletopContextMenu({ kind: "workspace", workspaceKey: workspace.key, x: bounds.left, y: bounds.bottom });
                }}><Icon name="ellipsis" /></button>
              </div>
              {active && workspace.key === active.key && <div className="resource-tree">
                <WorkspaceTree
                  workspace={active}
                  activeResourceId={activeResourceId}
                  onActivateResource={activateWorkspaceResource}
                  onPinResource={pinWorkspaceTab}
                  onSelectFolder={(folderId) => replaceActive(selectWorkspaceFolder(active, folderId))}
                  onToggleFolder={(folderId) => replaceActive(toggleWorkspaceFolder(active, folderId))}
                  onRenameFolder={renameWorkspaceTreeFolder}
                  onMoveNode={moveWorkspaceTreeNode}
                  onDeleteNode={requestWorkspaceNodeDeletion}
                  onResourceContextMenu={(resourceId, x, y) => {
                    activateWorkspaceResource(resourceId);
                    setTabletopContextMenu({ kind: "resource", resourceId, x, y });
                  }}
                  onRootContextMenu={(x, y) => setTabletopContextMenu({ kind: "workspace", workspaceKey: active.key, x, y })}
                  resourceTitle={resourceTitle}
                  renderResourceIcon={(candidate) => <ResourceIcon resource={candidate} />}
                />
              </div>}
            </section>)}
          </div>
          <footer><span>{active?.document.resources.length ?? 0} 个资源</span><span>名称 ↑</span></footer>
        </aside>

        {appMode === "creator" && <section className="creator-workbench">
          <nav className="resource-tabs" aria-label="打开的资源">
            {workspaces.flatMap((workspace) => workspace.openResourceIds.flatMap((resourceId) => {
              const candidate = workspace.document.resources.find((item) => item.id === resourceId);
              if (!candidate) return [];
              const current = workspace.key === active?.key && candidate.id === activeResourceId;
              return <div className={`resource-tab${current ? " is-current" : ""}${candidate.id === workspace.previewResourceId ? " is-preview" : ""}`} key={`${workspace.key}:${candidate.id}`}>
                <button type="button" className="resource-tab-main" onClick={() => { switchWorkspace(workspace.key); setActiveResourceId(candidate.id); }} onDoubleClick={() => {
                  switchWorkspace(workspace.key);
                  setWorkspaces((currentWorkspaces) => currentWorkspaces.map((item) => item.key === workspace.key ? pinWorkspaceResource(item, candidate.id) : item));
                }}>
                  <ResourceIcon resource={candidate} /><span>{resourceTitle(candidate)}</span>{workspace.dirtyResourceIds.includes(candidate.id) && <i aria-label="已修改">●</i>}
                </button>
                <button type="button" className="resource-tab-close" aria-label={`关闭 ${resourceTitle(candidate)}`} onClick={() => closeWorkspaceTab(workspace.key, candidate.id)}><Icon name="x" /></button>
              </div>;
            }))}
          </nav>
          {resource ? <div className="workbench-body" onPointerDown={() => pinWorkspaceTab(resource.id)}>
            {adversary && <AdversaryEditor
              data={adversary}
              openFeatureMenu={openFeatureMenu}
              onField={updateField}
              onFeature={updateFeature}
              onAddFeature={() => updateData((draft) => { draft.特性.push({ 名称: "新特性", 原名: "", 类型: "动作", 特性描述: "" }); })}
              onToggleFeatureMenu={(index) => setOpenFeatureMenu((current) => current === index ? null : index)}
              onClearFeature={clearFeature}
              onDeleteFeature={(index, name) => requestFeatureDeletion(index, name)}
            />}

            {weapon && <WeaponEditor data={weapon} onField={updateWeaponField} />}

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
              </div></header>
              <AutoFitPreview>
                {adversaryPreviewResource && <CanonicalCardSurface resource={adversaryPreviewResource} expectedRendererRevision="enemy-card-r1" renderer={adversaryRendererFor(adversaryPreviewResource.template.version)} assets={previewAssets} label={`${adversaryPreviewResource.data.名称 || "未命名敌人"}规范卡面`} />}
                {weaponPreviewResource && <CanonicalCardSurface resource={weaponPreviewResource} expectedRendererRevision="weapon-card-r1" renderer={weaponRendererFor(weaponPreviewResource.template.version)} assets={previewAssets} label={`${weaponPreviewResource.data.名称 || "未命名武器"}规范卡面`} />}
              </AutoFitPreview>
              <footer className="preview-media"><span className="media-icon"><Icon name="image" /></span><strong>{resource.media.portrait ? "已设置卡图" : "未设置卡图"}</strong><button type="button" onClick={() => portraitRef.current?.click()}><Icon name="image" />{resource.media.portrait ? "替换" : "添加"}</button></footer>
            </aside>
          </div> : <div className="closed-tabs-empty"><strong>没有打开的资源</strong></div>}
        </section>}

        {appMode === "gm" && <section className="gm-workbench" data-design-frame={creatorWorkspaceDesign.gmTabletop.frame}>
          <nav className="tabletop-tabs" aria-label="打开的桌面">
            {tabletops.map((tabletop) => <div
              className={`tabletop-tab ${tabletop.id === activeTabletop?.id ? "is-current" : ""}`}
              key={tabletop.id}
            ><button type="button" className="tabletop-tab-main" onClick={() => { setActiveTabletopId(tabletop.id); setSelectedInstanceId(""); setTabletopView("canvas"); }}><span>▦</span><b>{tabletop.name}</b></button><button
              type="button"
              className="tabletop-tab-close"
              aria-label={`删除 ${tabletop.name}`}
              title="删除桌面"
              onClick={() => {
                setDialog({ kind: "delete-tabletop", tabletopId: tabletop.id, name: tabletop.name });
              }}
            ><Icon name="x" /></button></div>)}
            <button type="button" className="new-tabletop" aria-label="新建桌面" onClick={requestTabletopCreation}>＋</button>
          </nav>

          {!activeTabletop && <div className="gm-tabletop-empty"><strong>还没有桌面</strong><button type="button" onClick={requestTabletopCreation}>＋ 新建桌面</button></div>}

          {activeTabletop && tabletopView === "canvas" && <div
            ref={tabletopViewportRef}
            className="tabletop-viewport"
            onPointerDown={(event) => {
              if ((event.target as Element).closest("[data-tabletop-instance-id]")) return;
              setTabletopContextMenu(null);
              if (event.button === 0) {
                setSelectedInstanceId("");
                return;
              }
              if (event.button !== 1 && event.button !== 2) return;
              if (event.button === 1) event.preventDefault();
              if (event.button === 2) suppressCanvasContextMenuRef.current = false;
              event.currentTarget.style.cursor = "grabbing";
              event.currentTarget.setPointerCapture(event.pointerId);
              canvasPanRef.current = {
                pointerId: event.pointerId,
                button: event.button,
                startPointer: { x: event.clientX, y: event.clientY },
                startPan: canvasPan,
                moved: false,
              };
            }}
            onPointerMove={(event) => {
              const drag = canvasPanRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              const dx = event.clientX - drag.startPointer.x;
              const dy = event.clientY - drag.startPointer.y;
              if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
              setCanvasPan({ x: drag.startPan.x + dx, y: drag.startPan.y + dy });
            }}
            onPointerUp={(event) => {
              const drag = canvasPanRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              suppressCanvasContextMenuRef.current = drag.button === 2 && drag.moved;
              canvasPanRef.current = null;
              event.currentTarget.style.cursor = "";
            }}
            onPointerCancel={(event) => { canvasPanRef.current = null; event.currentTarget.style.cursor = ""; }}
            onContextMenu={(event) => {
              if ((event.target as Element).closest("[data-tabletop-instance-id]")) return;
              event.preventDefault();
              if (suppressCanvasContextMenuRef.current) {
                suppressCanvasContextMenuRef.current = false;
                return;
              }
              setTabletopContextMenu({ kind: "canvas", x: event.clientX, y: event.clientY });
            }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes("application/x-pbdh-resource")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              const resourceId = event.dataTransfer.getData("application/x-pbdh-resource");
              if (!resourceId) return;
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              placeResource(resourceId, {
                x: (event.clientX - rect.left - canvasPan.x) / canvasZoom,
                y: (event.clientY - rect.top - canvasPan.y) / canvasZoom,
              });
            }}
          >
            <TabletopSurface
              document={activeTabletop}
              capabilities={gmCapabilities}
              selectedInstanceId={selectedInstanceId}
              renderInstance={renderTabletopInstance}
              onSelect={(instanceId) => { setSelectedInstanceId(instanceId); setTabletopContextMenu(null); }}
              onCommand={applyTabletopCommand}
              onInstanceContextMenu={(instanceId, position) => {
                setSelectedInstanceId(instanceId);
                setTabletopContextMenu({ kind: "instance", instanceId, x: position.x, y: position.y });
              }}
              coordinateScale={canvasZoom}
              style={{ transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})` }}
            />
            <div className="tabletop-zoom-status">{Math.round(canvasZoom * 100)}%</div>
          </div>}

          {tabletopView === "instance-editor" && selectedInstance && <>
            <div className="instance-editor-toolbar">
              <button type="button" onClick={() => setTabletopView("canvas")}>← 返回桌面</button>
              <strong><ResourceIcon resource={selectedInstance.resource} />{instanceAdversary?.名称 ?? instanceWeapon?.名称 ?? selectedInstance.id} · 实例</strong>
            </div>
            <div className="workbench-body instance-editor-body">
              {instanceAdversary && <AdversaryEditor
                data={instanceAdversary}
                openFeatureMenu={openFeatureMenu}
                onField={(field, value) => updateInstanceAdversary((draft) => { draft[field] = value; })}
                onFeature={(index, field, value) => updateInstanceAdversary((draft) => { draft.特性[index]![field] = value; })}
                onAddFeature={() => updateInstanceAdversary((draft) => { draft.特性.push({ 名称: "新特性", 原名: "", 类型: "动作", 特性描述: "" }); })}
                onToggleFeatureMenu={(index) => setOpenFeatureMenu((current) => current === index ? null : index)}
                onClearFeature={(index) => updateInstanceAdversary((draft) => { draft.特性[index] = { 名称: "", 原名: "", 类型: "", 特性描述: "" }; setOpenFeatureMenu(null); })}
                onDeleteFeature={(index, name) => requestFeatureDeletion(index, name, "instance")}
              />}
              {instanceWeapon && <WeaponEditor data={instanceWeapon} onField={(field, value) => updateInstanceWeapon((draft) => { draft[field] = value; })} />}
              <aside className="preview-panel">
                <header><h1>实时预览</h1><div>
                  <div className="card-mode" role="group" aria-label="卡面模式">
                    {(["text", "split", "image"] as const).map((mode) => <button type="button" key={mode} aria-pressed={selectedInstance.resource.presentation.mode === mode} onClick={() => replaceInstanceResource(selectedInstance, (copy) => { copy.presentation.mode = mode; })}>{{ text: "纯文字", split: "半图半文字", image: "纯图片" }[mode]}</button>)}
                  </div>
                  <button type="button" className="fixed-ratio" role="switch" aria-checked={selectedInstance.resource.presentation.fixedRatio} onClick={() => replaceInstanceResource(selectedInstance, (copy) => { copy.presentation.fixedRatio = !copy.presentation.fixedRatio; })}><span>固定比例</span><i /></button>
                </div></header>
                <AutoFitPreview>{renderTabletopInstance(selectedInstance)}</AutoFitPreview>
                <footer className="preview-media"><span className="media-icon"><Icon name="image" /></span><strong>{selectedInstance.resource.media.portrait ? "已设置卡图" : "未设置卡图"}</strong><button type="button" disabled><Icon name="image" />替换</button></footer>
              </aside>
            </div>
          </>}
        </section>}
      </div>

      {tabletopContextMenu?.kind === "workspace" && <div
        className="context-menu workspace-context-menu"
        role="menu"
        style={{ left: Math.max(8, Math.min(tabletopContextMenu.x, window.innerWidth - 210)), top: Math.max(8, Math.min(tabletopContextMenu.y, window.innerHeight - 260)) }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); setDialog({ kind: "new" }); }}>新建资源包</button>
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); importRef.current?.click(); }}>导入 .pbres</button>
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); void exportPackage(); }}>导出 .pbres</button>
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); openPublicationDialog(); }}>发布到资源市场</button>
        <i />
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); setDialog({ kind: "new-resource" }); }}>新建资源</button>
        <button type="button" role="menuitem" onClick={() => { if (active) replaceActive(createWorkspaceFolder(active)); setTabletopContextMenu(null); }}>新建文件夹</button>
        <i />
        <button type="button" role="menuitem" onClick={() => requestWorkspacePackageClose(tabletopContextMenu.workspaceKey)}>关闭资源包</button>
      </div>}

      {tabletopContextMenu?.kind === "resource" && <div
        className="context-menu resource-context-menu"
        role="menu"
        style={{ left: Math.max(8, Math.min(tabletopContextMenu.x, window.innerWidth - 230)), top: Math.max(8, Math.min(tabletopContextMenu.y, window.innerHeight - 190)) }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" role="menuitem" onClick={() => {
          activateWorkspaceResource(tabletopContextMenu.resourceId);
          setAppMode("creator");
          setTabletopContextMenu(null);
        }}>打开</button>
        <button type="button" role="menuitem" onClick={() => {
          pinWorkspaceTab(tabletopContextMenu.resourceId);
          setAppMode("creator");
          setTabletopContextMenu(null);
        }}>在新标签页打开</button>
        <i />
        <button type="button" role="menuitem" onClick={() => duplicateResource(tabletopContextMenu.resourceId)}>复制</button>
        <button type="button" role="menuitem" className="delete" onClick={() => requestWorkspaceNodeDeletion({ kind: "resource", id: tabletopContextMenu.resourceId })}>删除</button>
      </div>}

      {tabletopContextMenu?.kind === "instance" && <div
        className="context-menu instance-context-menu"
        role="menu"
        style={{ left: Math.max(8, Math.min(tabletopContextMenu.x, window.innerWidth - 190)), top: Math.max(8, Math.min(tabletopContextMenu.y, window.innerHeight - 130)) }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" role="menuitem" onClick={() => { setTabletopView("instance-editor"); setTabletopContextMenu(null); }}>编辑</button>
        <button type="button" role="menuitem" onClick={duplicateSelectedInstance}>复制</button>
        <button type="button" role="menuitem" className="delete" onClick={deleteSelectedInstance}>删除</button>
      </div>}

      {tabletopContextMenu?.kind === "canvas" && <div
        className="context-menu canvas-context-menu"
        role="menu"
        style={{ left: Math.max(8, Math.min(tabletopContextMenu.x, window.innerWidth - 240)), top: Math.max(8, Math.min(tabletopContextMenu.y, window.innerHeight - 150)) }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" role="menuitem" onClick={requestTabletopRename}>重命名</button>
        <i />
        <button type="button" role="menuitem" onClick={() => tabletopImportRef.current?.click()}>导入 .pbtab</button>
        <button type="button" role="menuitem" onClick={exportTabletop}>导出 .pbtab</button>
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); window.print(); }}>打印</button>
        <i />
        <button type="button" role="menuitem" className="delete" onClick={() => {
          if (activeTabletop) setDialog({ kind: "delete-tabletop", tabletopId: activeTabletop.id, name: activeTabletop.name });
          setTabletopContextMenu(null);
        }}>删除桌面</button>
      </div>}

      <input ref={tabletopImportRef} hidden type="file" accept=".pbtab" onChange={importTabletop} />

      <input ref={importRef} hidden type="file" accept=".pbres" onChange={importPackage} />
      <input ref={portraitRef} hidden type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={replacePortraitFromFile} />
      <input ref={publicationCoverRef} hidden type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={replacePublicationCover} />

      {dialog && <div className="dialog-backdrop" role="presentation"><section className={`dialog${dialog.kind === "publish" ? " publish-dialog" : ""}`} role="dialog" aria-modal="true">
        {dialog.kind === "new" && <><h2>新建资源包</h2><Field className="dialog-field" label="名称" value={newName} onChange={setNewName} />
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" onClick={createWorkspaceFromDialog}>创建</button></div></>}
        {dialog.kind === "new-resource" && <><h2>新建资源</h2>
          <div className="resource-type-choices"><button type="button" onClick={() => createResource(adversaryTemplate)}><Icon name="skull" />敌人</button><button type="button" onClick={() => createResource(weaponTemplate)}><Icon name="sword" />主武器</button></div>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button></div></>}
        {dialog.kind === "publish" && <>
          <h2>发布到资源市场</h2>
          <div className="publication-package-summary"><Icon name="package" /><span><strong>{active?.document.package.name}</strong><small>版本 {active?.document.package.version} · {active?.document.resources.length} 项资源</small></span><b>完整资源包</b></div>
          <div className="publication-fields">
            <div className="publication-cover-field"><strong>封面</strong><div className="publication-cover-preview">{publicationCover.url ? <img src={publicationCover.url} alt="资源包封面" /> : <Icon name="image" />}</div><button type="button" onClick={() => publicationCoverRef.current?.click()}><Icon name="upload" />上传</button></div>
            <div className="publication-copy-fields"><Field label="标题" value={publicationTitle} onChange={setPublicationTitle} /><TextareaField label="简介" value={publicationSummary} onChange={setPublicationSummary} /><div className="publication-meta-fields"><Field label="内容语言" value={publicationLanguage} onChange={setPublicationLanguage} /><label className="compact-field"><span>许可类型</span><select value={publicationLicense} onChange={(event) => setPublicationLicense(event.target.value as PublicationLicenseId)}>{Object.entries(publicationLicenses).map(([id, license]) => <option key={id} value={id}>{license.label}</option>)}</select></label></div><TagEditor tags={publicationTags} onChange={setPublicationTags} /></div>
          </div>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" onClick={publishWorkspace}>发布当前版本</button></div>
        </>}
        {dialog.kind === "diagnostics" && <><h2>{dialog.title}</h2><ul className="diagnostics">{dialog.diagnostics.map((item) =>
          <li key={`${item.code}:${item.location}`}><b>{publicationErrorMessage(item.code, typeof item.params.message === "string" ? item.params.message : undefined)}</b></li>)}</ul>
          <div className="dialog-actions"><button type="button" className="primary" onClick={() => setDialog(null)}>保留现状</button></div></>}
        {dialog.kind === "no-op" && <><h2>NO-OP · 同版本 / 同 Digest</h2><p>{dialog.name} 已是当前完整 Snapshot，不创建副本、不覆盖。</p>
          <div className="dialog-actions"><button type="button" className="primary" onClick={() => setDialog(null)}>打开现有 Workspace</button></div></>}
        {dialog.kind === "update" && <><h2>更新现有 Workspace</h2><p>当前 Workspace 未修改；导入内容 Digest 不同。确认后才替换。</p>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" onClick={() => commitIncoming(dialog.incoming, dialog.handoff)}>更新现有</button></div></>}
        {dialog.kind === "conflict" && <><h2>dirty 同 ID 冲突</h2><p>当前 Workspace 有本地修改，禁止自动合并。</p>
          <div className="conflict-choices"><button type="button" onClick={() => setDialog(null)}>取消（零写入）</button>
            <button type="button" onClick={() => saveAsideThenImport(dialog.incoming, dialog.handoff)}>另存 · 新 Package ID / 1.0.0</button>
            <button type="button" className="danger" onClick={() => commitIncoming(dialog.incoming, dialog.handoff)}>覆盖 · 丢弃本地修改</button></div></>}
        {dialog.kind === "delete-feature" && <><h2>删除特性</h2><p>删除“{dialog.name || "未命名特性"}”？此操作会立即从当前资源中移除该特性。</p>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="danger" onClick={() => deleteFeature(dialog.index, dialog.target)}>删除</button></div></>}
        {dialog.kind === "delete-workspace-node" && <><h2>删除{dialog.node.kind === "folder" ? "文件夹" : "资源"}</h2><p>删除“{dialog.name}”？{dialog.node.kind === "folder" ? "文件夹内的资源也会一并删除。" : ""}</p>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="danger" onClick={() => confirmWorkspaceNodeDeletion(dialog.node)}>删除</button></div></>}
        {dialog.kind === "close-workspace" && <><h2>关闭资源包</h2><p>关闭“{dialog.name}”？对应的本地工作区数据将被删除。</p>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="danger" onClick={() => void closeWorkspacePackage(dialog.workspaceKey)}>关闭并删除</button></div></>}
        {dialog.kind === "new-tabletop" && <><h2>新建桌面</h2><Field className="dialog-field" label="名称" value={tabletopNameDraft} onChange={setTabletopNameDraft} />
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" disabled={!tabletopNameDraft.trim()} onClick={createTabletopFromDialog}>创建</button></div></>}
        {dialog.kind === "rename-tabletop" && <><h2>重命名桌面</h2><Field className="dialog-field" label="名称" value={tabletopNameDraft} onChange={setTabletopNameDraft} />
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" disabled={!tabletopNameDraft.trim()} onClick={() => renameTabletopFromDialog(dialog.tabletopId)}>保存</button></div></>}
        {dialog.kind === "delete-tabletop" && <><h2>删除桌面</h2><p>删除“{dialog.name}”？对应的本地桌面数据将被删除。</p>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="danger" onClick={() => void deleteTabletop(dialog.tabletopId)}>删除</button></div></>}
      </section></div>}
      {notice && <div className="creator-toast" role="status"><Icon name="check" />{notice}</div>}
    </main>
  );
}
