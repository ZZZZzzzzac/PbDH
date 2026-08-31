import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import {
  loadPbtab,
  loadPbres,
  RESOURCE_PACKAGE_VERSION,
  writePbtab,
  writePbres,
  type ContractDiagnostic,
  type ResourcePackageCandidate,
  type ResourcePackageLogicalDocument,
  type TabletopDocumentCandidate,
} from "@pbdh/contract-runtime";
import type { RemoteCloudDocument } from "@pbdh/cloud-documents";
import {
  DexieLocalDocumentStore,
  type LocalDocumentKind,
  type LocalDocumentSync,
} from "@pbdh/local-storage";
import {
  createBrowserImageAdmission,
  publicationCoverPolicy,
  resourceImagePolicy,
  type ImageAdmissionPolicy,
  type ImageCropSelection,
} from "@pbdh/media-admission";
import { platformRequestHeaders, useAuth } from "@pbdh/platform-auth/provider";
import {
  ImageCropDialog,
  OperationStatus,
  usePlatformAppBarActions,
  usePlatformNotifications,
  usePlatformTrashSource,
  type PlatformTrashSource,
} from "@pbdh/platform-ui";
import {
  ResourcePackageInfoDialog,
  type ResourcePackageEditorValue,
  type SystemPackageOption,
} from "@pbdh/publication-ui";
import {
  resourceConversionRegistry,
  type ConversionDiagnostic,
  type ResourceContainer,
  type ResourceFormatId,
} from "@pbdh/resource-conversion";
import { CanonicalCardSurface, CardDisplay, CardPreviewDialog, renderCanonicalCardCoverToWebp } from "@pbdh/resource-renderer/react";
import type { ManagedAsset, RendererRevisionCapability, SurfaceResource } from "@pbdh/resource-renderer/core";
import {
  createTabletopDocument,
  clampTabletopPosition,
  executeTabletopCommand,
  executeTemplateStateCommand,
  type TabletopCapability,
  type TabletopCommand,
  type TabletopDocumentModel,
  type TabletopInstance,
} from "@pbdh/tabletop/core";
import { TabletopContextMenu, TabletopSurface } from "@pbdh/tabletop/react";
import {
  adversaryRendererFor,
  armorAuthoringLayout,
  armorRendererFor,
  environmentAuthoringLayout,
  environmentRendererFor,
  trustedAuthoringLayoutFor,
  trustedRendererFor,
  weaponAuthoringLayout,
  weaponRendererFor,
  type AuthoringLayout,
} from "@pbdh/templates/frontend";
import {
  adversaryTemplate,
  ancestryTemplate,
  armorTemplate,
  communityTemplate,
  domainTemplate,
  environmentTemplate,
  itemTemplate,
  professionTemplate,
  subclassTemplate,
  templateRegistry,
  weaponTemplate,
  type AdversaryData,
  type AdversaryFeature,
  type ArmorData,
  type EnvironmentData,
  type WeaponData,
} from "@pbdh/templates/core";

import { creatorWorkspaceDesign } from "./design.generated.ts";
import {
  CreatorCloudDocumentService,
  type CreatorCloudRecovery,
} from "./cloud-document-service.ts";
import { CreatorWorkspaceRepository } from "./creator-workspace-repository.ts";
import {
  creatorMarketHandoffMismatch,
  parseCreatorMarketHandoff,
  withoutCreatorMarketHandoff,
  type CreatorMarketHandoff,
} from "./market-handoff.ts";
import {
  preparePublicationCandidate,
} from "./publication-candidate.ts";
import { materializeCreatorResourceConversion } from "./materialize-resource-conversion.ts";
import { PublicationApiError, publishCandidate, suggestPublishVersion } from "./publication-api.ts";
import {
  collapsePublicationFieldErrors,
  publicationErrorMessage,
  publicationSuccessMessage,
} from "./publication-feedback.ts";
import { validateResourcePackageCandidate } from "./resource-package-validator.ts";
import {
  TabletopDocumentRepository,
} from "./tabletop-document-repository.ts";
import { validateTabletopDocumentCandidate } from "./tabletop-document-validator.ts";
import {
  containGmTabletopInstances,
  gmCardPixelsPerDesignUnit,
  prepareWorkspaceReplacement,
  restoreOfficialTabletopImageModes,
  snapshotWorkspaceResourceForTabletop,
} from "./tabletop-placement.ts";
import { WorkspaceTree } from "./WorkspaceTree.tsx";
import { TemplateIcon, templateMarkClassName } from "./TemplateIcon.tsx";
import {
  adversaryData,
  armorData,
  addTemplateResource,
  clearAdversaryFeature,
  closeWorkspaceResourceTab,
  copyWorkspaceResourceToPackage,
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
  updateArmorData,
  updateResourcePresentation,
  updateResourceReplacement,
  updateWorkspacePackageMetadata,
  updateWorkspaceResourceData,
  updateWeaponData,
  weaponData,
  type CreatorWorkspace,
  type WorkspaceNodeRef,
  type WorkspaceResource,
} from "./workspace-model.ts";

type WorkspaceResourceSelection = { workspaceKey: string; resourceId: string };

type Dialog =
  | { kind: "new" }
  | { kind: "package-metadata"; workspaceKey: string }
  | { kind: "new-resource" }
  | { kind: "publish" }
  | { kind: "diagnostics"; title: string; diagnostics: ContractDiagnostic[] }
  | { kind: "conversion"; review: CreatorConversionReview }
  | { kind: "no-op"; name: string }
  | { kind: "update"; incoming: ResourcePackageCandidate; handoff?: CreatorMarketHandoff }
  | { kind: "conflict"; incoming: ResourcePackageCandidate; handoff?: CreatorMarketHandoff }
  | { kind: "delete-feature"; index: number; name: string }
  | { kind: "delete-workspace-node"; workspaceKey: string; node: WorkspaceNodeRef; name: string }
  | { kind: "delete-selected-resources"; selections: WorkspaceResourceSelection[] }
  | { kind: "copy-resource-to-package"; sourceWorkspaceKey: string; resourceId: string; name: string }
  | { kind: "close-workspace"; workspaceKey: string; name: string }
  | { kind: "new-tabletop" }
  | { kind: "rename-tabletop"; tabletopId: string }
  | { kind: "delete-tabletop"; tabletopId: string; name: string }
  | { kind: "tabletop-import-conflict"; incoming: TabletopDocumentCandidate }
  | { kind: "sync-document"; documentKind: CloudDocumentKind; documentId: string; name: string }
  | { kind: "cloud-conflict"; documentKind: CloudDocumentKind; documentId: string; name: string }
  | null;

type CloudDocumentKind = Extract<LocalDocumentKind, "creator-workspace" | "gm-tabletop-document">;
type CreatorOperation = "cloud-sync" | "cloud-conflict" | "trash-workspace" | "trash-tabletop" | "duplicate-tabletop" | "read-tabletop" | "import-tabletop" | "export-tabletop" | "read-package" | "convert-package" | "export-package" | "publication-cover";

type CreatorConversionReview = {
  formatId: Exclude<ResourceFormatId, "pbres">;
  sourceFileName: string;
  candidate: ResourcePackageCandidate | null;
  converted: number;
  failed: number;
  diagnostics: ConversionDiagnostic[];
};

const creatorOperationLabels: Record<CreatorOperation, string> = {
  "cloud-sync": "正在同步云端…",
  "cloud-conflict": "正在处理云端版本…",
  "trash-workspace": "正在移动资源包…",
  "trash-tabletop": "正在移动桌面…",
  "duplicate-tabletop": "正在复制桌面…",
  "read-tabletop": "正在检查桌面文件…",
  "import-tabletop": "正在写入桌面…",
  "export-tabletop": "正在导出桌面…",
  "read-package": "正在检查资源包…",
  "convert-package": "正在转换第三方资源…",
  "export-package": "正在导出资源包…",
  "publication-cover": "正在生成发布封面…",
};

const CREATOR_LOCAL_SAVE_DELAY_MS = 400;
const CREATOR_CLOUD_SYNC_DELAY_MS = 1600;

const creatorThirdPartyFormats: Array<{ id: Exclude<ResourceFormatId, "pbres">; label: string }> = [
  { id: "zzz", label: "导入 ZZZ 格式" },
  { id: "rinkcx", label: "导入 Rink 格式" },
  { id: "dhsheet", label: "导入 dhsheet 格式" },
  { id: "kid", label: "导入不咕鸟格式" },
];

type TabletopContextMenu =
  | { kind: "resource"; workspaceKey: string; resourceId: string; x: number; y: number }
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

type PendingCreatorImage =
  | { purpose: "resource-image"; file: File; workspaceKey: string; resourceId: string }
  | { purpose: "publication-cover"; file: File };

const gmCapabilities = new Set<TabletopCapability>([
  "place",
  "move",
  "uniform-scale",
  "rotate",
  "flip",
  "layer",
  "arrange",
  "clear",
  "duplicate",
  "delete",
  "replace",
  "edit-instance-data",
  "template-state-command",
]);

const tabletopZoomSteps = [0.4, 0.5, 0.67, 0.8, 1, 1.25, 1.6] as const;

export function filterWorkspaceResources(
  workspaces: readonly CreatorWorkspace[],
  search: string,
  templateFilters: readonly string[],
  sortDirection: "ascending" | "descending" = "ascending",
) {
  const query = search.trim().toLocaleLowerCase();
  return workspaces.flatMap((workspace) => workspace.document.resources.flatMap((item) => {
    if (templateFilters.length > 0 && !templateFilters.includes(item.template.id)) return [];
    const searchable = [workspace.document.package.name, item.path, item.template.id,
      JSON.stringify(item.data)].join("\n").toLocaleLowerCase();
    return query && !searchable.includes(query) ? [] : [{ workspace, resource: item }];
  })).sort((left, right) => {
    const byTitle = resourceTitle(left.resource).localeCompare(resourceTitle(right.resource), "zh-CN", { numeric: true, sensitivity: "base" });
    const byPackage = left.workspace.document.package.name.localeCompare(right.workspace.document.package.name, "zh-CN", { numeric: true, sensitivity: "base" });
    const result = byTitle || byPackage || left.resource.id.localeCompare(right.resource.id);
    return sortDirection === "ascending" ? result : -result;
  });
}

function TemplateMultiSelect({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: readonly string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const label = value.length === 0
    ? "全部卡牌类型"
    : value.length === 1
      ? value[0]!
      : `已选 ${value.length} 类`;

  return <div ref={rootRef} className="workspace-template-filter" onMouseLeave={() => setOpen(false)}>
    <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span>{label}</span><Icon name="chevronDown" />
    </button>
    {open && <div className="workspace-template-filter-menu" role="menu" aria-label="按卡牌类型筛选">
      <label role="menuitemcheckbox" aria-checked={value.length === 0}>
        <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} />
        <span>全部卡牌类型</span>
      </label>
      {options.map((templateId) => <label key={templateId} role="menuitemcheckbox" aria-checked={value.includes(templateId)}>
        <input
          type="checkbox"
          checked={value.includes(templateId)}
          onChange={() => onChange(value.includes(templateId)
            ? value.filter((candidate) => candidate !== templateId)
            : [...value, templateId])}
        />
        <span>{templateId}</span>
      </label>)}
    </div>}
  </div>;
}

function replacementFailureMessage(code: string): string {
  switch (code) {
    case "tabletop.replacement.source-not-found":
    case "tabletop.replacement.workspace-not-found":
      return "找不到原卡所属的资源包，原卡没有变化。";
    case "tabletop.replacement.unsupported":
      return "这张卡没有这个切换选项，原卡没有变化。";
    case "tabletop.replacement.target-not-found":
      return "目标卡已不存在，原卡没有变化。";
    case "tabletop.replacement.template-unsupported":
      return "目标卡的类型暂不支持，原卡没有变化。";
    case "tabletop.replacement.source-media-missing":
      return "目标卡所需的图片不完整，原卡没有变化。";
    case "tabletop.replacement.target-mismatch":
      return "目标卡与切换设置不一致，原卡没有变化。";
    default:
      return "换卡失败，原卡没有变化。";
  }
}

function Field({
  label,
  value,
  onChange,
  className = "",
  enum: options = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  enum?: readonly string[];
}) {
  const inputId = useId();
  const [enumOpen, setEnumOpen] = useState(false);
  return (
    <div className={`compact-field ${className}`}>
      <label htmlFor={inputId}>{label}</label>
      <span
        className={`compact-field-control${options.length > 0 ? " has-enum" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEnumOpen(false);
        }}
      >
        <input id={inputId} value={value} onChange={(event) => onChange(event.target.value)} />
        {options.length > 0 ? <>
          <button
            type="button"
            className="compact-field-enum-toggle"
            aria-label={`展开${label}选项`}
            aria-expanded={enumOpen}
            onClick={() => setEnumOpen((current) => !current)}
          ><Icon name="chevronDown" /></button>
          {enumOpen ? <span className="compact-field-enum-menu" role="listbox" aria-label={`${label}预设选项`}>
            {options.map((option) => <button
              type="button"
              role="option"
              aria-selected={value === option}
              key={option}
              onClick={() => { onChange(option); setEnumOpen(false); }}
            >{option}</button>)}
          </span> : null}
        </> : null}
      </span>
    </div>
  );
}

function isCreatorAuthoringInputFocused(): boolean {
  const element = document.activeElement;
  return element instanceof HTMLElement
    && element.closest(".authoring-editor") !== null
    && (element.matches("input, textarea, select") || element.isContentEditable);
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
  cloudAlert: ["M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9Z", "M12 12v3", "M12 17h.01"],
  cloudCheck: ["M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9Z", "m10 15 2 2 4-4"],
  cloudOff: ["m2 2 20 20", "M5.8 5.8A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 2.7-.9", "M10.7 4.2A7 7 0 0 1 15.7 10h1.8a4.5 4.5 0 0 1 4.2 6"],
  cloudUpload: ["M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9Z", "M12 17v-6", "m9 14 3-3 3 3"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  ellipsis: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  filePlus: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z", "M14 2v6h6", "M12 18v-6", "M9 15h6"],
  folder: ["M3 6h6l2 2h10v11H3Z"],
  folderPlus: ["M3 6h6l2 2h10v11H3Z", "M12 11v6", "M9 14h6"],
  grid: ["M4 4h6v6H4Z", "M14 4h6v6h-6Z", "M4 14h6v6H4Z", "M14 14h6v6h-6Z"],
  grip: ["M9 5h.01", "M15 5h.01", "M9 12h.01", "M15 12h.01", "M9 19h.01", "M15 19h.01"],
  image: ["M3 5h18v14H3Z", "m3 16 5-5 4 4 3-3 3 4", "M14.5 9.5h.01"],
  package: ["m12 3 9 5-9 5-9-5Z", "m3 8 9 5 9-5", "M3 8v9l9 5 9-5V8", "M12 13v9"],
  packagePlus: ["m12 3 9 5-9 5-9-5Z", "M3 8v9l9 5 9-5V8", "M12 13v9", "M17 4v6", "M14 7h6"],
  search: ["m21 21-4.3-4.3", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20h-3v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 14.7a1.7 1.7 0 0 0-1.55-1H5v-3h.09A1.7 1.7 0 0 0 6.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.3 3.8V3h3v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19 8.3a1.7 1.7 0 0 0 1.55 1H21v3h-.09A1.7 1.7 0 0 0 19.4 15Z"],
  trash: ["M3 6h18", "M19 6l-1 14H6L5 6", "M8 6V4h8v2", "M10 11v6", "M14 11v6"],
  upload: ["M12 21V9", "m7 14 5-5 5 5", "M5 3h14"],
  user: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"],
  x: ["M18 6 6 18", "m6 6 12 12"],
} satisfies Record<string, string[]>;

function Icon({ name }: { name: keyof typeof iconPaths }) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    {iconPaths[name].map((path) => <path key={path} d={path} />)}
  </svg>;
}

function CloudSyncIndicator({ sync, saving = false }: { sync?: LocalDocumentSync; saving?: boolean }) {
  if (saving) return <OperationStatus label="保存中…" />;
  const state = sync?.scope === "cloud" ? sync.state : "local";
  const presentation = {
    local: { icon: "cloudOff" as const, label: "仅保存在此浏览器，不等于云备份" },
    pending: { icon: "cloudUpload" as const, label: "待同步" },
    clean: { icon: "cloudCheck" as const, label: "已同步" },
    conflict: { icon: "cloudAlert" as const, label: "冲突" },
  }[state];
  return <span className={`cloud-sync-state is-${state}`} title={presentation.label} aria-label={presentation.label}>
    <Icon name={presentation.icon} />
  </span>;
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
  onAddFeature?: () => void;
  onToggleFeatureMenu?: (index: number) => void;
  onClearFeature?: (index: number) => void;
  onDeleteFeature?: (index: number, name: string) => void;
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
      <header><h2>特性</h2>{onAddFeature && <button type="button" onClick={onAddFeature}>＋ 新增特性</button>}</header>
      {data.特性.map((feature, index) => <article className="feature-editor" key={`${feature.名称}:${index}`}>
        <div className="feature-line"><Icon name="grip" /><Field className="feature-name" label="特性名" value={feature.名称} onChange={(value) => onFeature(index, "名称", value)} /><Field className="feature-type" label="类型" value={feature.类型} onChange={(value) => onFeature(index, "类型", value)} />{onToggleFeatureMenu && onClearFeature && onDeleteFeature && <div className="feature-actions">
          <button type="button" aria-label={`${feature.名称 || "未命名特性"}菜单`} aria-haspopup="menu" aria-expanded={openFeatureMenu === index} onClick={() => onToggleFeatureMenu(index)}><Icon name="ellipsis" /></button>
          {openFeatureMenu === index && <div className="feature-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => onClearFeature(index)}>清空内容</button>
            <button type="button" role="menuitem" className="delete" onClick={() => onDeleteFeature(index, feature.名称)}>删除特性</button>
          </div>}
        </div>}</div>
        <div className="feature-line description-line"><span /><TextareaField label="描述" value={feature.特性描述} onChange={(value) => onFeature(index, "特性描述", value)} /></div>
      </article>)}
    </section>
  </section>;
}

function trashDocumentName(remote: RemoteCloudDocument): string {
  return remote.documentKind === "creator-workspace"
    ? ((remote.payload as { document?: { package?: { name?: string } } }).document?.package?.name ?? "资源工作区")
    : ((remote.payload as { name?: string }).name ?? "GM 桌面");
}

function parseCreatorTrashItemId(itemId: string): {
  location: "local" | "cloud";
  documentKind: "creator-workspace" | "gm-tabletop-document";
  documentId: string;
} {
  const [location, documentKind, ...documentIdParts] = itemId.split(":");
  if ((location !== "local" && location !== "cloud")
    || (documentKind !== "creator-workspace" && documentKind !== "gm-tabletop-document")
    || documentIdParts.length === 0) {
    throw new Error("回收站项目编号无效。");
  }
  return { location, documentKind, documentId: documentIdParts.join(":") };
}

function ReplacementEditor({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (targetResourceId: string | null) => void;
}) {
  return <section className="replacement-editor field-group">
    <h2>换卡</h2>
    <label className="compact-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">不设置</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
    <p>点击桌面上的“{label}”时，现场读取这张目标卡。</p>
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

function ArmorEditor({ data, onField }: { data: ArmorData; onField: (field: keyof ArmorData, value: string) => void }) {
  return <section className="authoring-editor armor-authoring-editor">
    {armorAuthoringLayout.sections.map((section) => <div className={`field-group armor-field-grid ${section.id}`} key={section.id}>
      {section.fields.map((field) => {
        const key = field.path as keyof ArmorData;
        return field.control === "textarea"
          ? <TextareaField key={field.path} label={field.label} value={data[key]} onChange={(value) => onField(key, value)} />
          : <Field key={field.path} label={field.label} value={data[key]} onChange={(value) => onField(key, value)} />;
      })}
    </div>)}
  </section>;
}

function valueAtPath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined, data);
}

function StructuredEditor({
  data,
  layout,
  onValue,
}: {
  data: Record<string, unknown>;
  layout: AuthoringLayout;
  onValue: (path: string, value: unknown) => void;
}) {
  return <section className="authoring-editor structured-authoring-editor">
    {layout.sections.map((section) => <div className="field-group structured-field-grid" key={section.id}>
      <h2>{section.label}</h2>
      {section.fields.map((field) => {
        const value = valueAtPath(data, field.path);
        if (field.control === "string-list") return <TextareaField key={field.path} label={field.label} value={Array.isArray(value) ? value.join("\n") : ""} onChange={(text) => onValue(field.path, text.split("\n").map((item) => item.trim()).filter(Boolean))} />;
        if (field.control === "string-map") return <TextareaField key={field.path} label={field.label} value={value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value).map(([key, item]) => `${key}: ${String(item)}`).join("\n") : ""} onChange={(text) => onValue(field.path, Object.fromEntries(text.split("\n").map((line) => line.split(/:(.*)/su)).filter(([key]) => key?.trim()).map(([key, item]) => [key!.trim(), (item ?? "").trim()]))) } />;
        return field.control === "textarea"
          ? <TextareaField key={field.path} label={field.label} value={typeof value === "string" ? value : ""} onChange={(text) => onValue(field.path, text)} />
          : <Field key={field.path} label={field.label} value={typeof value === "string" ? value : ""} enum={field.enum} onChange={(text) => onValue(field.path, text)} />;
      })}
      {section.repeats?.map((repeat) => {
        const items = valueAtPath(data, repeat.path);
        const rows = Array.isArray(items) ? items as Record<string, unknown>[] : [];
        return <section className="structured-repeat" key={repeat.path}><header><h3>{repeat.label}</h3><button type="button" onClick={() => onValue(repeat.path, [...rows, Object.fromEntries(repeat.itemFields.map((field) => [field.path, ""]))])}>＋ 新增</button></header>
          {rows.map((row, index) => <article key={index}>{repeat.itemFields.map((field) => field.control === "textarea"
            ? <TextareaField key={field.path} label={field.label} value={String(row[field.path] ?? "")} onChange={(text) => onValue(repeat.path, rows.map((item, itemIndex) => itemIndex === index ? { ...item, [field.path]: text } : item))} />
            : <Field key={field.path} label={field.label} value={String(row[field.path] ?? "")} enum={field.enum} onChange={(text) => onValue(repeat.path, rows.map((item, itemIndex) => itemIndex === index ? { ...item, [field.path]: text } : item))} />)}<button type="button" className="structured-remove" onClick={() => onValue(repeat.path, rows.filter((_, itemIndex) => itemIndex !== index))}>删除</button></article>)}
        </section>;
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
  return <TemplateIcon templateId={resource.template.id} />;
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

function AdversaryRuntimePreview({
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

function bytesToUrlMap(candidate: ResourcePackageCandidate): Map<string, string> {
  return new Map([...candidate.media].map(([id, bytes]) => [
    id,
    URL.createObjectURL(new Blob([
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    ], { type: "image/webp" })),
  ]));
}

const imageAdmission = createBrowserImageAdmission();

async function imageAsset(file: File, policy: ImageAdmissionPolicy, selection?: ImageCropSelection) {
  const admitted = await imageAdmission.admit(file, policy, selection ? { crop: selection } : undefined);
  const asset = {
    id: admitted.id,
    mediaType: "image/webp" as const,
    byteLength: String(admitted.byteLength),
    width: String(admitted.width),
    height: String(admitted.height),
  };
  return { asset, bytes: admitted.bytes, blob: admitted.blob };
}

export function publicationRenderer(resource: WorkspaceResource): {
  expectedRendererRevision: string;
  renderer?: RendererRevisionCapability<any, any, ReactNode>;
} {
  const renderer = trustedRendererFor(resource.template.id, resource.template.version);
  return { expectedRendererRevision: renderer?.revision ?? "", renderer };
}

async function generatedPublicationCoverForResource(
  workspace: CreatorWorkspace,
  resource: WorkspaceResource,
): Promise<PublicationCoverDraft> {
  const binding = publicationRenderer(resource);
  const assets = new Map<string, ManagedAsset>(await Promise.all(Object.values(resource.media).map(async (assetId) => {
    const bytes = workspace.media.get(assetId);
    if (!bytes) return [assetId, { status: "error" as const, reason: "missing workspace media" }] as const;
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("renderer.cover.media-read-failed")));
      reader.addEventListener("error", () => reject(new Error("renderer.cover.media-read-failed")));
      reader.readAsDataURL(new Blob([buffer], { type: "image/webp" }));
    });
    return [assetId, { status: "ready" as const, url }] as const;
  })));
  const rendered = await renderCanonicalCardCoverToWebp({
    resource: resource as unknown as SurfaceResource<Record<string, unknown>>,
    expectedRendererRevision: binding.expectedRendererRevision,
    renderer: binding.renderer,
    assets,
    label: `${String((resource.data as Record<string, unknown>).名称 ?? "未命名资源")}发布封面`,
  });
  const digestInput = rendered.bytes.buffer.slice(
    rendered.bytes.byteOffset,
    rendered.bytes.byteOffset + rendered.bytes.byteLength,
  ) as ArrayBuffer;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", digestInput));
  const assetId = `sha256:${[...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return {
    assetId,
    url: URL.createObjectURL(rendered.blob),
    asset: {
      id: assetId,
      mediaType: "image/webp",
      byteLength: String(rendered.bytes.byteLength),
      width: String(rendered.width),
      height: String(rendered.height),
    },
    bytes: rendered.bytes,
  };
}

async function generatedPublicationCover(
  workspace: CreatorWorkspace,
): Promise<PublicationCoverDraft> {
  if (workspace.document.resources.length === 0) {
    throw new Error("creator.publication-cover.resource-missing");
  }
  for (const resource of workspace.document.resources as WorkspaceResource[]) {
    try {
      return await generatedPublicationCoverForResource(workspace, resource);
    } catch {
      // 单张卡不可渲染时继续尝试包内其他资源，封面缺失本身不阻止发布。
    }
  }
  throw new Error("creator.publication-cover.render-failed");
}

function resourceContainer(fileName: string): ResourceContainer {
  const extension = fileName.split(".").at(-1)?.toLocaleLowerCase();
  if (extension === "dhcb") return "dhcb";
  if (extension === "png") return "png";
  return "json";
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/gu, "-").trim() || "resources";
}

function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isSemanticVersion(value: string): boolean {
  return /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value.trim());
}

export type CreatorAppMode = "creator" | "gm";

const creatorColumnPreferences = {
  workspace: { key: "pbdh.creator.columns.workspace", initial: 30, min: 0, max: 45 },
  editor: { key: "pbdh.creator.columns.editor", initial: 3 / 7 * 100, min: 30, max: 65 },
} as const;

export function storedColumnShare(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === "undefined") return fallback;
  const storedValue = window.localStorage.getItem(key);
  if (storedValue === null) return fallback;
  const value = Number(storedValue);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function CreatorColumnResizeHandle({
  label,
  value,
  preference,
  cssVariable,
  onChange,
}: {
  label: string;
  value: number;
  preference: (typeof creatorColumnPreferences)[keyof typeof creatorColumnPreferences];
  cssVariable: "--creator-workspace-share" | "--creator-editor-share";
  onChange(value: number): void;
}) {
  const liveValueRef = useRef(value);
  useEffect(() => { liveValueRef.current = value; }, [value]);

  function update(next: number, commit: boolean) {
    const clamped = Math.min(preference.max, Math.max(preference.min, next));
    liveValueRef.current = clamped;
    document.querySelector<HTMLElement>(".creator-prototype")?.style.setProperty(cssVariable, `${clamped}%`);
    window.localStorage.setItem(preference.key, String(clamped));
    if (commit) onChange(clamped);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return;
    update((event.clientX - bounds.left) / bounds.width * 100, false);
  }

  function finish(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onChange(liveValueRef.current);
  }

  function adjustWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = value + (event.key === "ArrowLeft" ? -1 : 1);
    update(next, true);
  }

  return <div
    className="creator-column-resize-handle"
    role="separator"
    aria-label={label}
    aria-orientation="vertical"
    aria-valuemin={preference.min}
    aria-valuemax={preference.max}
    aria-valuenow={Math.round(value)}
    tabIndex={0}
    title="拖动调整宽度；方向键微调；双击恢复默认"
    onDoubleClick={() => {
      update(preference.initial, true);
    }}
    onKeyDown={adjustWithKeyboard}
    onPointerDown={(event) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={move}
    onPointerUp={finish}
    onPointerCancel={finish}
  ><i /></div>;
}

export function CreatorWorkspacePrototype({
  mode,
  onModeChange,
  handoffUrl = window.location.href,
  onHandoffConsumed,
  systemPackageOptions = [],
}: {
  mode?: CreatorAppMode;
  onModeChange?(mode: CreatorAppMode): void;
  handoffUrl?: string;
  onHandoffConsumed?(cleanedUrl: URL): void;
  systemPackageOptions?: readonly SystemPackageOption[];
} = {}) {
  const auth = useAuth();
  const [workspaces, setWorkspaces] = useState<CreatorWorkspace[]>([]);
  const [activeKey, setActiveKey] = useState("");
  const [activeResourceId, setActiveResourceId] = useState("");
  const [assetUrls, setAssetUrls] = useState<Map<string, string>>(() => new Map());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [newName, setNewName] = useState("新资源包");
  const [packageNameDraft, setPackageNameDraft] = useState("");
  const [packageVersionDraft, setPackageVersionDraft] = useState("");
  const [packageDescriptionDraft, setPackageDescriptionDraft] = useState("");
  const [packageTargetsDraft, setPackageTargetsDraft] = useState<ResourcePackageLogicalDocument["targets"]>([]);
  const [copyPackageName, setCopyPackageName] = useState("新资源包");
  const [publicationTitle, setPublicationTitle] = useState("");
  const [publicationSummary, setPublicationSummary] = useState("");
  const [publicationLanguage, setPublicationLanguage] = useState("中文");
  const [publicationTags, setPublicationTags] = useState<string[]>([]);
  const [publicationLicense, setPublicationLicense] = useState<PublicationLicenseId>("public-domain");
  const [publicationCover, setPublicationCover] = useState<PublicationCoverDraft>({ assetId: "", url: "" });
  const [publicationBusy, setPublicationBusy] = useState(false);
  const [pendingCreatorImage, setPendingCreatorImage] = useState<PendingCreatorImage | null>(null);
  const [imageCropWorking, setImageCropWorking] = useState(false);
  const [imageCropError, setImageCropError] = useState<string | null>(null);
  const [creatorOperation, setCreatorOperation] = useState<CreatorOperation | null>(null);
  const [openFeatureMenu, setOpenFeatureMenu] = useState<number | null>(null);
  const [localAppMode, setLocalAppMode] = useState<CreatorAppMode>("creator");
  const appMode = mode ?? localAppMode;
  const changeAppMode = useCallback((nextMode: CreatorAppMode) => {
    setLocalAppMode(nextMode);
    if (nextMode === "creator") setResourcePanelOpen(true);
    if (mode !== nextMode) onModeChange?.(nextMode);
  }, [mode, onModeChange]);
  const [tabletops, setTabletops] = useState<TabletopDocumentModel[]>([]);
  const [workspaceSync, setWorkspaceSync] = useState<Map<string, LocalDocumentSync>>(() => new Map());
  const [tabletopSync, setTabletopSync] = useState<Map<string, LocalDocumentSync>>(() => new Map());
  const [workspaceCloudSyncRequest, setWorkspaceCloudSyncRequest] = useState(0);
  const [tabletopCloudSyncRequest, setTabletopCloudSyncRequest] = useState(0);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [tabletopSaving, setTabletopSaving] = useState(false);
  const [activeTabletopId, setActiveTabletopId] = useState("");
  const [tabletopNameDraft, setTabletopNameDraft] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceTemplateFilters, setResourceTemplateFilters] = useState<string[]>([]);
  const [workspaceSortDirection, setWorkspaceSortDirection] = useState<"ascending" | "descending">("ascending");
  const [selectedWorkspaceResources, setSelectedWorkspaceResources] = useState<WorkspaceResourceSelection[]>([]);
  const [resourceMultiSelect, setResourceMultiSelect] = useState(false);
  const [detailTabletopInstanceId, setDetailTabletopInstanceId] = useState("");
  const [resourcePanelOpen, setResourcePanelOpen] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 781px)").matches);
  const [workspaceColumnShare, setWorkspaceColumnShare] = useState(() => storedColumnShare(
    creatorColumnPreferences.workspace.key,
    creatorColumnPreferences.workspace.initial,
    creatorColumnPreferences.workspace.min,
    creatorColumnPreferences.workspace.max,
  ));
  const [editorColumnShare, setEditorColumnShare] = useState(() => storedColumnShare(
    creatorColumnPreferences.editor.key,
    creatorColumnPreferences.editor.initial,
    creatorColumnPreferences.editor.min,
    creatorColumnPreferences.editor.max,
  ));
  const [expandedWorkspaceKeys, setExpandedWorkspaceKeys] = useState<Set<string>>(() => new Set());
  const knownWorkspaceKeysRef = useRef<Set<string>>(new Set());
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
  const tabletopSurfaceRef = useRef<HTMLDivElement>(null);
  const tabletopViewportRef = useRef<HTMLDivElement>(null);
  const tabletopViewPreferenceLoadedRef = useRef("");
  const marketHandoffStartedRef = useRef<string | null>(null);
  const cloudRecoveryAccountRef = useRef<string | null>(null);
  const workspaceWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const tabletopWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const workspaceSaveSequenceRef = useRef(0);
  const tabletopSaveSequenceRef = useRef(0);
  const { notify } = usePlatformNotifications();
  const importRef = useRef<HTMLInputElement>(null);
  const conversionImportRef = useRef<HTMLInputElement>(null);
  const conversionFormatRef = useRef<Exclude<ResourceFormatId, "pbres">>("zzz");
  const tabletopImportRef = useRef<HTMLInputElement>(null);
  const portraitRef = useRef<HTMLInputElement>(null);
  const publicationCoverRef = useRef<HTMLInputElement>(null);
  const gmAppBarActions = useMemo(() => (
    <nav className="creator-toolbar" aria-label="GM 工具栏">
      <div className="creator-menu">
        <button className="creator-menu-trigger" type="button" aria-haspopup="menu"><span>GM 功能</span>{creatorOperation === "read-tabletop" || creatorOperation === "import-tabletop" ? <OperationStatus label={creatorOperationLabels[creatorOperation]} /> : null}</button>
        <div className="creator-menu-panel is-right" role="menu">
          <button type="button" role="menuitem" disabled={Boolean(creatorOperation)} onClick={() => tabletopImportRef.current?.click()}>导入 .pbtab</button>
        </div>
      </div>
    </nav>
  ), [creatorOperation]);
  usePlatformAppBarActions("gm", gmAppBarActions);
  const localDocumentStore = useMemo(() => new DexieLocalDocumentStore(), []);
  const creatorWorkspaceRepository = useMemo(() => new CreatorWorkspaceRepository(localDocumentStore), [localDocumentStore]);
  const tabletopRepository = useMemo(() => new TabletopDocumentRepository(localDocumentStore), [localDocumentStore]);
  const cloudDocumentService = useMemo(() => new CreatorCloudDocumentService(
    localDocumentStore,
    creatorWorkspaceRepository,
    tabletopRepository,
  ), [creatorWorkspaceRepository, localDocumentStore, tabletopRepository]);
  const active = workspaces.find((workspace) => workspace.key === activeKey) ?? workspaces[0];
  const activeTabletop = tabletops.find((tabletop) => tabletop.id === activeTabletopId);
  const selectedInstance = activeTabletop?.instances.find((instance) => instance.id === selectedInstanceId);
  const detailTabletopInstance = activeTabletop?.instances.find((instance) => instance.id === detailTabletopInstanceId);
  const selectedInstanceTemplate = selectedInstance
    ? templateRegistry.resolve(selectedInstance.resource.template.id, selectedInstance.resource.template.version)
    : undefined;
  const selectedInstanceLayout = selectedInstance
    ? trustedAuthoringLayoutFor(selectedInstance.resource.template.id, selectedInstance.resource.template.version)
    : undefined;
  const resourceTemplateOptions = useMemo(() => [...new Set(workspaces.flatMap((workspace) =>
    workspace.document.resources.map((item) => item.template.id)))].sort(), [workspaces]);
  const filteredWorkspaceResources = useMemo(() => {
    return filterWorkspaceResources(workspaces, resourceSearch, resourceTemplateFilters, workspaceSortDirection);
  }, [resourceSearch, resourceTemplateFilters, workspaceSortDirection, workspaces]);

  useEffect(() => {
    const currentKeys = new Set(workspaces.map((workspace) => workspace.key));
    const addedKeys = [...currentKeys].filter((key) => !knownWorkspaceKeysRef.current.has(key));
    setExpandedWorkspaceKeys((expanded) => new Set([
      ...[...expanded].filter((key) => currentKeys.has(key)),
      ...addedKeys,
    ]));
    knownWorkspaceKeysRef.current = currentKeys;
  }, [workspaces]);
  useEffect(() => {
    if (!workspaceStorageReady || !tabletopStorageReady) return;
    setTabletops((current) => {
      let changed = false;
      const repaired = current.map((tabletop) => {
        const next = containGmTabletopInstances(restoreOfficialTabletopImageModes(tabletop, workspaces));
        if (next !== tabletop) changed = true;
        return next;
      });
      return changed ? repaired : current;
    });
  }, [tabletopStorageReady, workspaceStorageReady, workspaces]);
  const applyCloudSnapshot = useCallback((snapshot: CreatorCloudRecovery, replaceDocuments: boolean) => {
    const restoredWorkspaces = snapshot.workspaces.map((item) => item.workspace);
    const restoredTabletops = snapshot.tabletops.map((item) => containGmTabletopInstances(item.model));
    setWorkspaceSync(new Map(snapshot.workspaces.map((item) => [item.workspace.key, item.sync])));
    setTabletopSync(new Map(snapshot.tabletops.map((item) => [item.model.id, item.sync])));
    if (!replaceDocuments) return;
    setWorkspaces(restoredWorkspaces);
    setTabletops(restoredTabletops);
    setActiveKey((current) => restoredWorkspaces.some((item) => item.key === current)
      ? current
      : restoredWorkspaces[0]?.key ?? "");
    setActiveResourceId((current) => restoredWorkspaces.some((item) =>
      item.document.resources.some((resource) => resource.id === current))
      ? current
      : restoredWorkspaces[0]?.openResourceIds[0] ?? "");
    setActiveTabletopId((current) => restoredTabletops.some((item) => item.id === current)
      ? current
      : restoredTabletops[0]?.id ?? "");
    const media = new Map(snapshot.tabletops.flatMap((item) => [...item.media]));
    setTabletopMedia(media);
    setAssetUrls((current) => new Map([
      ...current,
      ...restoredWorkspaces.flatMap((workspace) => [...bytesToUrlMap(workspace)]),
      ...[...media].map(([id, bytes]) => [id, URL.createObjectURL(new Blob([
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      ], { type: "image/webp" }))] as const),
    ]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    creatorWorkspaceRepository.listStored()
      .then((stored) => {
        const visible = stored.filter((item) => item.sync.scope === "local-only"
          || item.sync.accountId === auth.credentials?.accountId);
        if (cancelled) return;
        const restored = visible.map((item) => item.workspace);
        setWorkspaces(restored);
        setWorkspaceSync(new Map(visible.map((item) => [item.workspace.key, item.sync])));
        const restoredActive = restored[0];
        setActiveKey(restoredActive?.key ?? "");
        setActiveResourceId(restoredActive?.openResourceIds[0] ?? "");
        setAssetUrls((current) => new Map([
          ...current,
          ...restored.flatMap((workspace) => [...bytesToUrlMap(workspace)]),
        ]));
      })
      .catch((error) => notify(error instanceof Error ? error.message : "工作区恢复失败"))
      .finally(() => {
        if (!cancelled) setWorkspaceStorageReady(true);
      });
    return () => { cancelled = true; };
  }, [auth.credentials?.accountId, creatorWorkspaceRepository]);

  useEffect(() => {
    if (!workspaceStorageReady || !tabletopStorageReady || marketHandoffStartedRef.current === handoffUrl) return;
    const handoff = parseCreatorMarketHandoff(handoffUrl);
    if (!handoff) return;
    marketHandoffStartedRef.current = handoffUrl;
    const cleanedUrl = withoutCreatorMarketHandoff(handoffUrl);
    if (onHandoffConsumed) onHandoffConsumed(cleanedUrl);
    else window.history.replaceState(null, "", `${cleanedUrl.pathname}${cleanedUrl.search}${cleanedUrl.hash}`);
    fetch(`/api/publications/${encodeURIComponent(handoff.publicationId)}/download`, auth.credentials
      ? { headers: platformRequestHeaders(auth.credentials) }
      : undefined)
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
        if (handoff.creatorMode === "fork") {
          const source = createWorkspace(result.candidate);
          return forkCurrentWorkspace(source, {
            publicationId: handoff.publicationId,
            packageId: handoff.packageId,
            version: handoff.packageVersion,
            snapshotDigest: handoff.snapshotDigest,
          }).then((fork) => acceptIncoming({ document: fork.document, media: fork.media }, handoff));
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
  }, [auth.credentials, handoffUrl, onHandoffConsumed, tabletopStorageReady, workspaceStorageReady]);

  useEffect(() => {
    if (!workspaceStorageReady) return;
    const timeout = window.setTimeout(() => {
      const sequence = ++workspaceSaveSequenceRef.current;
      setWorkspaceSaving(true);
      const write = workspaceWriteQueueRef.current.then(async () => {
        await Promise.all(workspaces.map((workspace) =>
          creatorWorkspaceRepository.save(workspace, auth.credentials?.accountId ?? null)));
      });
      workspaceWriteQueueRef.current = write.catch(() => undefined);
      write.catch((error) => notify(error instanceof Error ? error.message : "工作区保存失败"));
      void write.then(
        () => { if (workspaceSaveSequenceRef.current === sequence) setWorkspaceSaving(false); },
        () => { if (workspaceSaveSequenceRef.current === sequence) setWorkspaceSaving(false); },
      );
    }, CREATOR_LOCAL_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [
    applyCloudSnapshot,
    auth.credentials,
    cloudDocumentService,
    creatorWorkspaceRepository,
    workspaceStorageReady,
    workspaces,
  ]);

  useEffect(() => {
    const credentials = auth.credentials;
    if (!workspaceStorageReady || !credentials || isCreatorAuthoringInputFocused()) return;
    const timeout = window.setTimeout(() => {
      const pendingLocalWrites = workspaceWriteQueueRef.current;
      const write = pendingLocalWrites.then(async () => {
        const snapshot = await cloudDocumentService.flush("creator-workspace", credentials);
        applyCloudSnapshot(snapshot, false);
      });
      workspaceWriteQueueRef.current = write.catch(() => undefined);
      write.catch((error) => notify(error instanceof Error ? error.message : "工作区同步失败"));
    }, CREATOR_CLOUD_SYNC_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [
    applyCloudSnapshot,
    auth.credentials,
    cloudDocumentService,
    workspaceStorageReady,
    workspaceCloudSyncRequest,
    workspaces,
  ]);

  useEffect(() => {
    let cancelled = false;
    tabletopRepository.list()
      .then((stored) => {
        const visible = stored.filter((item) => item.sync.scope === "local-only"
          || item.sync.accountId === auth.credentials?.accountId);
        if (cancelled) return;
        const models = visible.map((item) => item.model);
        const media = new Map(visible.flatMap((item) => [...item.media]));
        setTabletops(models);
        setTabletopSync(new Map(visible.map((item) => [item.model.id, item.sync])));
        setActiveTabletopId(models[0]?.id ?? "");
        setSelectedInstanceId("");
        setSelectedInstanceIds([]);
        setTabletopMedia(media);
        setAssetUrls((current) => new Map([...current, ...[...media].map(([id, bytes]) => [
          id,
          URL.createObjectURL(new Blob([
            bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
          ], { type: "image/webp" })),
        ] as const)]));
      })
      .catch((error) => notify(error instanceof Error ? error.message : "桌面恢复失败"))
      .finally(() => {
        if (!cancelled) setTabletopStorageReady(true);
      });
    return () => { cancelled = true; };
  }, [auth.credentials?.accountId, tabletopRepository]);

  useEffect(() => {
    const credentials = auth.credentials;
    if (!credentials) {
      cloudRecoveryAccountRef.current = null;
      return;
    }
    if (!workspaceStorageReady || !tabletopStorageReady) return;
    if (cloudRecoveryAccountRef.current === credentials.accountId) return;
    cloudRecoveryAccountRef.current = credentials.accountId;
    let cancelled = false;
    cloudDocumentService.recover(credentials)
      .then((snapshot) => {
        if (!cancelled) applyCloudSnapshot(snapshot, true);
      })
      .catch((error) => {
        cloudRecoveryAccountRef.current = null;
        if (!cancelled) notify(error instanceof Error ? error.message : "云文档恢复失败");
      });
    return () => { cancelled = true; };
  }, [
    applyCloudSnapshot,
    auth.credentials,
    cloudDocumentService,
    tabletopStorageReady,
    workspaceStorageReady,
  ]);

  const resource = active?.document.resources.find((candidate) => candidate.id === activeResourceId);
  const isAdversary = Boolean(resource && isTemplate(resource, adversaryTemplate));
  const isWeapon = Boolean(resource && isTemplate(resource, weaponTemplate));
  const isArmor = Boolean(resource && isTemplate(resource, armorTemplate));
  const isEnvironment = Boolean(resource && isTemplate(resource, environmentTemplate));
  const referenceLayout = resource
    ? isEnvironment
      ? environmentAuthoringLayout
      : !isAdversary && !isWeapon && !isArmor
        ? trustedAuthoringLayoutFor(resource.template.id, resource.template.version)
        : undefined
    : undefined;
  const referenceRenderer = resource && !isAdversary && !isWeapon && !isArmor && !isEnvironment
    ? trustedRendererFor(resource.template.id, resource.template.version)
    : undefined;
  const adversary = active && resource && isAdversary ? adversaryData(active, resource.id) : undefined;
  const weapon = active && resource && isWeapon ? weaponData(active, resource.id) : undefined;
  const armor = active && resource && isArmor ? armorData(active, resource.id) : undefined;
  const adversaryPreviewResource = resource && adversary ? { ...resource, data: adversary } : undefined;
  const weaponPreviewResource = resource && weapon ? { ...resource, data: weapon } : undefined;
  const armorPreviewResource = resource && armor ? { ...resource, data: armor } : undefined;
  const environmentPreviewResource = resource && isEnvironment
    ? { ...resource, data: resource.data as EnvironmentData }
    : undefined;
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
      const sequence = ++tabletopSaveSequenceRef.current;
      setTabletopSaving(true);
      const write = tabletopWriteQueueRef.current.then(async () => {
        await Promise.all(tabletops.map((tabletop) =>
          tabletopRepository.save(tabletop, allTabletopMedia, auth.credentials?.accountId ?? null)));
      });
      tabletopWriteQueueRef.current = write.catch(() => undefined);
      write.catch((error) => notify(error instanceof Error ? error.message : "桌面保存失败"));
      void write.then(
        () => { if (tabletopSaveSequenceRef.current === sequence) setTabletopSaving(false); },
        () => { if (tabletopSaveSequenceRef.current === sequence) setTabletopSaving(false); },
      );
    }, CREATOR_LOCAL_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [
    allTabletopMedia,
    applyCloudSnapshot,
    auth.credentials,
    cloudDocumentService,
    tabletopRepository,
    tabletopStorageReady,
    tabletops,
  ]);

  useEffect(() => {
    const credentials = auth.credentials;
    if (!tabletopStorageReady || !credentials || isCreatorAuthoringInputFocused()) return;
    const timeout = window.setTimeout(() => {
      const pendingLocalWrites = tabletopWriteQueueRef.current;
      const write = pendingLocalWrites.then(async () => {
        const snapshot = await cloudDocumentService.flush("gm-tabletop-document", credentials);
        applyCloudSnapshot(snapshot, false);
      });
      tabletopWriteQueueRef.current = write.catch(() => undefined);
      write.catch((error) => notify(error instanceof Error ? error.message : "桌面同步失败"));
    }, CREATOR_CLOUD_SYNC_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [
    applyCloudSnapshot,
    auth.credentials,
    cloudDocumentService,
    tabletopStorageReady,
    tabletopCloudSyncRequest,
    tabletops,
  ]);

  const requestWorkspaceCloudSyncAfterEditing = useCallback(() => {
    setWorkspaceCloudSyncRequest((current) => current + 1);
  }, []);

  const requestTabletopCloudSyncAfterEditing = useCallback(() => {
    setTabletopCloudSyncRequest((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!activeTabletopId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`pbdh:gm-tabletop-view:${activeTabletopId}`) ?? "null") as null | { zoom?: number; pan?: { x?: number; y?: number } };
      const zoom = saved?.zoom && tabletopZoomSteps.includes(saved.zoom as never) ? saved.zoom : 0.8;
      setCanvasZoom(zoom);
      setCanvasPan({ x: Number(saved?.pan?.x) || 0, y: Number(saved?.pan?.y) || 0 });
    } catch {
      setCanvasZoom(0.8);
      setCanvasPan({ x: 0, y: 0 });
    }
    tabletopViewPreferenceLoadedRef.current = activeTabletopId;
  }, [activeTabletopId]);

  useEffect(() => {
    if (!activeTabletopId || tabletopViewPreferenceLoadedRef.current !== activeTabletopId) return;
    localStorage.setItem(`pbdh:gm-tabletop-view:${activeTabletopId}`, JSON.stringify({ zoom: canvasZoom, pan: canvasPan }));
  }, [activeTabletopId, canvasPan, canvasZoom]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 781px)");
    const update = (event: MediaQueryListEvent) => setResourcePanelOpen(event.matches);
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const viewport = tabletopViewportRef.current;
    if (!viewport || appMode !== "gm" || tabletopView !== "canvas") return;
    const zoomAtPointer = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const currentIndex = tabletopZoomSteps.reduce((best, step, index) =>
        Math.abs(step - canvasZoom) < Math.abs(tabletopZoomSteps[best]! - canvasZoom) ? index : best, 0);
      const nextZoom = tabletopZoomSteps[Math.min(tabletopZoomSteps.length - 1, Math.max(0, currentIndex + (event.deltaY < 0 ? 1 : -1)))]!;
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

  function setTabletopZoom(nextZoom: number) {
    const viewport = tabletopViewportRef.current;
    const center = viewport ? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 } : { x: 0, y: 0 };
    const world = { x: (center.x - canvasPan.x) / canvasZoom, y: (center.y - canvasPan.y) / canvasZoom };
    setCanvasZoom(nextZoom);
    setCanvasPan({ x: center.x - world.x * nextZoom, y: center.y - world.y * nextZoom });
  }

  function updateTabletopPanPreview(pan: { x: number; y: number }) {
    if (!tabletopSurfaceRef.current) return;
    tabletopSurfaceRef.current.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${canvasZoom})`;
  }

  function fitTabletopContent() {
    if (!activeTabletop) return;
    const viewport = tabletopViewportRef.current;
    if (!viewport || activeTabletop.instances.length === 0) {
      setCanvasZoom(1);
      setCanvasPan({ x: 0, y: 0 });
      return;
    }
    const bounds = activeTabletop.instances.reduce((result, instance) => {
      const width = Number(instance.resource.presentation.width) * gmCardPixelsPerDesignUnit * instance.scale;
      const height = Number(instance.resource.presentation.height) * gmCardPixelsPerDesignUnit * instance.scale;
      return {
        left: Math.min(result.left, instance.position.x),
        top: Math.min(result.top, instance.position.y),
        right: Math.max(result.right, instance.position.x + width),
        bottom: Math.max(result.bottom, instance.position.y + height),
      };
    }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    const required = Math.min((viewport.clientWidth - 48) / Math.max(1, bounds.right - bounds.left), (viewport.clientHeight - 48) / Math.max(1, bounds.bottom - bounds.top));
    const zoom = [...tabletopZoomSteps].reverse().find((step) => step <= required) ?? tabletopZoomSteps[0];
    setCanvasZoom(zoom);
    setCanvasPan({
      x: (viewport.clientWidth - (bounds.right - bounds.left) * zoom) / 2 - bounds.left * zoom,
      y: (viewport.clientHeight - (bounds.bottom - bounds.top) * zoom) / 2 - bounds.top * zoom,
    });
  }

  const designStyle = {
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

  function replaceActive(next: CreatorWorkspace) {
    if (!active) return;
    setWorkspaces((current) => current.map((workspace) => workspace.key === active.key ? next : workspace));
    setActiveKey(next.key);
  }

  function replaceWorkspace(workspaceKey: string, next: CreatorWorkspace) {
    setWorkspaces((current) => current.map((workspace) => workspace.key === workspaceKey ? next : workspace));
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

  function requestCloudSync(documentKind: CloudDocumentKind, documentId: string, name: string) {
    if (!auth.credentials) {
      notify("请先登录再启用云同步");
      return;
    }
    setTabletopContextMenu(null);
    setDialog({ kind: "sync-document", documentKind, documentId, name });
  }

  async function confirmCloudSync(documentKind: CloudDocumentKind, documentId: string) {
    const credentials = auth.credentials;
    if (!credentials) return notify("请先登录再启用云同步");
    if (creatorOperation) return;
    setCreatorOperation("cloud-sync");
    try {
      const snapshot = await cloudDocumentService.enable(documentKind, documentId, credentials);
      applyCloudSnapshot(snapshot, false);
      setDialog(null);
      notify("已同步到云端");
    } catch (error) {
      notify(error instanceof Error ? error.message : "云同步失败");
    } finally {
      setCreatorOperation(null);
    }
  }

  const creatorTrashSource = useMemo<PlatformTrashSource>(() => ({
    id: "creator-and-gm-documents",
    async list() {
      const [workspaceTrash, tabletopTrash] = await Promise.all([
        creatorWorkspaceRepository.listTrash(),
        tabletopRepository.listTrash(),
      ]);
      const local = [
        ...workspaceTrash.map((item) => ({
          id: `local:creator-workspace:${item.workspace.key}`,
          name: item.workspace.document.package.name || "未命名资源工作区",
          documentType: "资源工作区" as const,
          location: "local" as const,
          deletedAt: item.deletedAt,
          purgeAfter: item.purgeAfter,
        })),
        ...tabletopTrash.map((item) => ({
          id: `local:gm-tabletop-document:${item.model.id}`,
          name: item.model.name || "未命名桌面",
          documentType: "GM 桌面" as const,
          location: "local" as const,
          deletedAt: item.deletedAt,
          purgeAfter: item.purgeAfter,
        })),
      ];
      if (!auth.credentials) return local;
      const cloud = (await cloudDocumentService.listTrash(auth.credentials)).map((remote) => ({
        id: `cloud:${remote.documentKind}:${remote.documentId}`,
        name: trashDocumentName(remote),
        documentType: remote.documentKind === "creator-workspace" ? "资源工作区" as const : "GM 桌面" as const,
        location: "cloud" as const,
        deletedAt: remote.deletedAt!,
        purgeAfter: remote.purgeAfter,
      }));
      return [...local, ...cloud];
    },
    async restore(itemId) {
      const { location, documentKind, documentId } = parseCreatorTrashItemId(itemId);
      if (location === "cloud") {
        const credentials = auth.credentials;
        if (!credentials) throw new Error("请先登录再恢复云文档。");
        const remote = (await cloudDocumentService.listTrash(credentials))
          .find((item) => item.documentKind === documentKind && item.documentId === documentId);
        if (!remote) throw new Error("云端回收站里找不到这个文档。");
        applyCloudSnapshot(await cloudDocumentService.restoreFromTrash(remote, credentials), true);
        notify("云文档已恢复");
        return;
      }
      if (documentKind === "creator-workspace") {
        const restored = await creatorWorkspaceRepository.restore(documentId);
        setWorkspaces((current) => [...current.filter((item) => item.key !== documentId), restored.workspace]);
        setWorkspaceSync((current) => new Map(current).set(documentId, restored.sync));
        setActiveKey(documentId);
        notify(`已恢复“${restored.workspace.document.package.name}”`);
        return;
      }
      const restored = await tabletopRepository.restore(documentId);
      setTabletops((current) => [...current.filter((item) => item.id !== documentId), restored.model]);
      setTabletopSync((current) => new Map(current).set(documentId, restored.sync));
      setTabletopMedia((current) => new Map([...current, ...restored.media]));
      setActiveTabletopId(documentId);
      notify(`已恢复“${restored.model.name}”`);
    },
    async deletePermanently(itemId) {
      const { location, documentKind, documentId } = parseCreatorTrashItemId(itemId);
      if (location === "local") {
        if (documentKind === "creator-workspace") await creatorWorkspaceRepository.deleteFromTrash(documentId);
        else await tabletopRepository.deleteFromTrash(documentId);
        return;
      }
      const credentials = auth.credentials;
      if (!credentials) throw new Error("请先登录再永久删除云文档。");
      const remote = (await cloudDocumentService.listTrash(credentials))
        .find((item) => item.documentKind === documentKind && item.documentId === documentId);
      if (!remote) throw new Error("云端回收站里找不到这个文档。");
      await cloudDocumentService.deleteFromTrash(remote, credentials);
    },
  }), [auth.credentials, cloudDocumentService, creatorWorkspaceRepository, tabletopRepository]);
  usePlatformTrashSource(creatorTrashSource);

  async function resolveCloudConflict(
    documentKind: CloudDocumentKind,
    documentId: string,
    action: "cloud" | "local" | "aside",
  ) {
    const credentials = auth.credentials;
    if (!credentials) return notify("请先登录再处理云冲突");
    if (creatorOperation) return;
    setCreatorOperation("cloud-conflict");
    try {
      if (documentKind === "creator-workspace") await workspaceWriteQueueRef.current;
      else await tabletopWriteQueueRef.current;
      if (action === "aside") {
        if (documentKind === "creator-workspace") {
          const source = workspaces.find((item) => item.key === documentId);
          if (!source) throw new Error("没有找到冲突的本地工作区。");
          const fork = await forkCurrentWorkspace(source);
          await creatorWorkspaceRepository.save(fork, null);
        } else {
          const source = tabletops.find((item) => item.id === documentId);
          if (!source) throw new Error("没有找到冲突的本地桌面。");
          await tabletopRepository.save({
            ...structuredClone(source),
            id: crypto.randomUUID(),
            name: `${source.name} - 本地副本`,
          }, allTabletopMedia, null);
        }
      }
      const snapshot = action === "local"
        ? await cloudDocumentService.overwriteWithLocal(documentKind, documentId, credentials)
        : await cloudDocumentService.keepCloud(documentKind, documentId, credentials);
      applyCloudSnapshot(snapshot, true);
      setDialog(null);
      notify(action === "local" ? "已用本地版本覆盖云端" : action === "aside" ? "本地版本已另存" : "已保留云端版本");
    } catch (error) {
      notify(error instanceof Error ? error.message : "云冲突处理失败");
    } finally {
      setCreatorOperation(null);
    }
  }

  async function closeWorkspacePackage(workspaceKey: string) {
    const closing = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!closing || creatorOperation) return;
    setCreatorOperation("trash-workspace");
    setTabletopContextMenu(null);
    try {
      await workspaceWriteQueueRef.current;
      const sync = workspaceSync.get(workspaceKey);
      if (sync?.scope === "cloud") {
        if (!auth.credentials) throw new Error("请先登录当前账号再删除云端工作区。");
        if (!auth.credentials.canWrite && sync.baseRevision !== null) {
          throw new Error("当前会话不能删除已经上传的云端工作区。");
        }
        applyCloudSnapshot(await cloudDocumentService.trash(
          "creator-workspace",
          workspaceKey,
          auth.credentials,
        ), true);
      } else {
        await creatorWorkspaceRepository.trash(workspaceKey);
        const remaining = workspaces.filter((workspace) => workspace.key !== workspaceKey);
        setWorkspaces(remaining);
        if (active?.key === workspaceKey) {
          const next = remaining[0];
          setActiveKey(next?.key ?? "");
          setActiveResourceId(next?.openResourceIds[0] ?? "");
        }
      }
      setDialog(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "资源包关闭失败");
      return;
    } finally {
      setCreatorOperation(null);
    }
    notify("资源包已移到回收站");
  }

  function activateWorkspaceResource(resourceId: string, workspaceKey = active?.key) {
    const sourceWorkspace = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!sourceWorkspace) return;
    const next = previewWorkspaceResource(sourceWorkspace, resourceId);
    const createdPreview = next.previewResourceId === resourceId && sourceWorkspace.previewResourceId !== resourceId;
    setWorkspaces((current) => current.map((workspace) => {
      if (workspace.key === sourceWorkspace.key) return next;
      if (createdPreview && workspace.previewResourceId) {
        return closeWorkspaceResourceTab(workspace, workspace.previewResourceId).workspace;
      }
      return workspace;
    }));
    setActiveKey(sourceWorkspace.key);
    setActiveResourceId(resourceId);
  }

  function pinWorkspaceTab(resourceId: string, workspaceKey = active?.key) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    replaceWorkspace(owner.key, pinWorkspaceResource(owner, resourceId));
    setActiveKey(owner.key);
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

  function moveWorkspaceTreeNode(workspaceKey: string, node: WorkspaceNodeRef, parentId: string | null): string | null {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return "没有打开的工作区";
    try {
      replaceWorkspace(owner.key, moveWorkspaceNode(owner, node, parentId));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "无法移动节点";
    }
  }

  function renameWorkspaceTreeFolder(workspaceKey: string, folderId: string, name: string): string | null {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return "没有打开的工作区";
    try {
      replaceWorkspace(owner.key, renameWorkspaceFolder(owner, folderId, name));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "无法重命名文件夹";
    }
  }

  function requestWorkspaceNodeDeletion(node: WorkspaceNodeRef, workspaceKey = active?.key) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    const name = node.kind === "folder"
      ? owner.folders.find((folder) => folder.id === node.id)?.name ?? "文件夹"
      : resourceTitle(owner.document.resources.find((candidate) => candidate.id === node.id)!);
    setDialog({ kind: "delete-workspace-node", workspaceKey: owner.key, node, name });
  }

  function duplicateResource(resourceId: string, workspaceKey = active?.key) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    const result = duplicateWorkspaceResource(owner, resourceId);
    replaceWorkspace(owner.key, result.workspace);
    setActiveKey(owner.key);
    setActiveResourceId(result.resourceId);
    setTabletopContextMenu(null);
  }

  function confirmWorkspaceNodeDeletion(workspaceKey: string, node: WorkspaceNodeRef) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    const next = deleteWorkspaceNode(owner, node);
    replaceWorkspace(owner.key, next);
    if (owner.key === active?.key && !next.document.resources.some((candidate) => candidate.id === activeResourceId)) {
      setActiveResourceId(next.openResourceIds[0] ?? "");
    }
    setTabletopContextMenu(null);
    setDialog(null);
  }

  function requestSelectedResourceDeletion() {
    if (selectedWorkspaceResources.length === 0) return;
    setTabletopContextMenu(null);
    setDialog({ kind: "delete-selected-resources", selections: [...selectedWorkspaceResources] });
  }

  function confirmSelectedResourceDeletion(selections: WorkspaceResourceSelection[]) {
    const selectedByWorkspace = new Map<string, Set<string>>();
    selections.forEach(({ workspaceKey, resourceId }) => {
      const resourceIds = selectedByWorkspace.get(workspaceKey) ?? new Set<string>();
      resourceIds.add(resourceId);
      selectedByWorkspace.set(workspaceKey, resourceIds);
    });
    const nextWorkspaces = workspaces.map((workspace) => {
      const resourceIds = selectedByWorkspace.get(workspace.key);
      if (!resourceIds) return workspace;
      return [...resourceIds].reduce((next, resourceId) => (
        next.document.resources.some((candidate) => candidate.id === resourceId)
          ? deleteWorkspaceNode(next, { kind: "resource", id: resourceId })
          : next
      ), workspace);
    });
    setWorkspaces(nextWorkspaces);
    const nextActive = nextWorkspaces.find((workspace) => workspace.key === active?.key);
    if (activeResourceId && selectedByWorkspace.get(active?.key ?? "")?.has(activeResourceId)) {
      setActiveResourceId(nextActive?.openResourceIds[0] ?? "");
    }
    setSelectedWorkspaceResources([]);
    setResourceMultiSelect(false);
    setTabletopContextMenu(null);
    setDialog(null);
    notify(`已删除 ${selections.length} 个资源`);
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

  function updateArmorField(field: keyof ArmorData, value: string) {
    if (active && resource) replaceActive(updateArmorData(active, (draft) => {
      draft[field] = value;
    }, resource.id));
  }

  function updateReferenceValue(path: string, value: unknown) {
    if (!active || !resource) return;
    replaceActive(updateWorkspaceResourceData(active, (draft) => {
      const parts = path.split(".");
      let target = draft;
      for (const part of parts.slice(0, -1)) {
        const current = target[part];
        if (!current || typeof current !== "object" || Array.isArray(current)) target[part] = {};
        target = target[part] as Record<string, unknown>;
      }
      target[parts.at(-1)!] = value;
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
      notify(result.diagnostics[0]!.code);
      return;
    }
    const contained = containGmTabletopInstances(result.document);
    setTabletops((current) => current.map((tabletop) =>
      tabletop.id === activeTabletop.id ? contained : tabletop));
  }

  function editInstanceData(path: string[], value: unknown) {
    if (!selectedInstance) return;
    applyTabletopCommand({
      type: "edit-instance-data",
      instanceId: selectedInstance.id,
      path,
      value,
    });
  }

  function selectTabletopInstance(instanceId: string, mode: "replace" | "add" | "toggle" = "replace") {
    const next = mode === "replace"
      ? [instanceId]
      : mode === "add"
        ? [...new Set([...selectedInstanceIds, instanceId])]
        : selectedInstanceIds.includes(instanceId)
          ? selectedInstanceIds.filter((id) => id !== instanceId)
          : [...selectedInstanceIds, instanceId];
    setSelectedInstanceIds(next);
    setSelectedInstanceId(next.at(-1) ?? "");
  }

  function selectAndRaiseTabletopInstance(instanceId: string, mode: "replace" | "add" | "toggle" = "replace") {
    selectTabletopInstance(instanceId, mode);
    const instance = activeTabletop?.instances.find((candidate) => candidate.id === instanceId);
    const topLayer = activeTabletop?.instances.reduce(
      (highest, candidate) => Math.max(highest, candidate.layer),
      Number.NEGATIVE_INFINITY,
    );
    if (instance && topLayer !== undefined && instance.layer < topLayer) {
      applyTabletopCommand({ type: "layer", instanceId, action: "front" });
    }
    setTabletopContextMenu(null);
  }

  function clearTabletopSelection() {
    setSelectedInstanceIds([]);
    setSelectedInstanceId("");
  }

  function placeWorkspaceResources(
    selections: WorkspaceResourceSelection[],
    firstPosition?: { x: number; y: number },
  ) {
    if (!activeTabletop || selections.length === 0) return;
    let next = activeTabletop;
    const media = new Map<string, Uint8Array>();
    const placedIds: string[] = [];
    try {
      selections.forEach((selection, index) => {
        const workspace = workspaces.find((item) => item.key === selection.workspaceKey);
        const source = workspace?.document.resources.find((item) => item.id === selection.resourceId);
        if (!workspace || !source) throw new Error("找不到要放置的资源");
        const template = templateRegistry.resolve(source.template.id, source.template.version);
        if (!template) throw new Error("找不到卡牌类型");
        const snapshot = snapshotWorkspaceResourceForTabletop(workspace, source.id);
        const instanceId = crypto.randomUUID();
        const sequence = next.instances.length;
        const origin = firstPosition ?? { x: 56 + (sequence % 3) * 380, y: 88 + Math.floor(sequence / 3) * 180 };
        const position = clampTabletopPosition(
          { resource: snapshot.resource, scale: 1, rotation: 0 },
          { ...next.canvas, containment: "full", pixelsPerUnit: gmCardPixelsPerDesignUnit },
          { x: origin.x + index * 28, y: origin.y + index * 28 },
        );
        const result = executeTabletopCommand(next, {
          type: "place",
          instanceId,
          resource: snapshot.resource,
          state: template.tabletop.defaultState(source.data as never),
          position,
          assets: snapshot.assets,
        }, { capabilities: gmCapabilities });
        if (result.diagnostics.length) throw new Error(result.diagnostics[0]!.code);
        next = result.document;
        placedIds.push(instanceId);
        snapshot.media.forEach((bytes, id) => media.set(id, bytes));
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "无法复制桌面资源");
      return;
    }
    setTabletopMedia((current) => new Map([...current, ...media]));
    setTabletops((current) => current.map((tabletop) => tabletop.id === activeTabletop.id ? next : tabletop));
    setSelectedInstanceIds(placedIds);
    setSelectedInstanceId(placedIds.at(-1) ?? "");
    setTabletopView("canvas");
    setTabletopContextMenu(null);
    if (window.matchMedia("(max-width: 780px)").matches) setResourcePanelOpen(false);
  }

  function placeResource(resourceId: string, position?: { x: number; y: number }) {
    if (active) placeWorkspaceResources([{ workspaceKey: active.key, resourceId }], position);
  }

  function toggleWorkspaceResourceSelection(workspaceKey: string, resourceId: string) {
    setSelectedWorkspaceResources((current) => current.some((item) => item.workspaceKey === workspaceKey && item.resourceId === resourceId)
      ? current.filter((item) => item.workspaceKey !== workspaceKey || item.resourceId !== resourceId)
      : [...current, { workspaceKey, resourceId }]);
  }

  function toggleResourceMultiSelect() {
    setResourceMultiSelect((current) => {
      if (current) setSelectedWorkspaceResources([]);
      return !current;
    });
    setTabletopContextMenu(null);
  }

  function placeSelectedTabletopResources() {
    if (selectedWorkspaceResources.length === 0) return;
    placeWorkspaceResources(selectedWorkspaceResources);
    setSelectedWorkspaceResources([]);
    setResourceMultiSelect(false);
  }

  function replaceSelectedInstanceForm(replacementId: string) {
    if (!activeTabletop || !selectedInstance) return;
    let prepared;
    try {
      prepared = prepareWorkspaceReplacement(
        workspaces,
        selectedInstance,
        replacementId,
        crypto.randomUUID(),
      );
    } catch (error) {
      notify(replacementFailureMessage(error instanceof Error ? error.message : ""));
      setTabletopContextMenu(null);
      return;
    }
    const result = executeTabletopCommand(activeTabletop, prepared.command, {
      capabilities: gmCapabilities,
    });
    if (result.diagnostics.length > 0) {
      notify(replacementFailureMessage(result.diagnostics[0]!.code));
      setTabletopContextMenu(null);
      return;
    }
    setTabletopMedia((current) => new Map([...current, ...prepared.media]));
    const contained = containGmTabletopInstances(result.document);
    setTabletops((current) => current.map((tabletop) =>
      tabletop.id === activeTabletop.id ? contained : tabletop));
    selectTabletopInstance(prepared.command.newInstanceId);
    setTabletopContextMenu(null);
  }

  function toggleWorkspacePackage(workspaceKey: string) {
    const opening = !expandedWorkspaceKeys.has(workspaceKey);
    setExpandedWorkspaceKeys((current) => {
      const next = new Set(current);
      if (next.has(workspaceKey)) next.delete(workspaceKey);
      else next.add(workspaceKey);
      return next;
    });
    if (opening) switchWorkspace(workspaceKey);
  }

  function requestResourcePackageCopy(resourceId: string, workspaceKey = active?.key) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    const source = owner.document.resources.find((candidate) => candidate.id === resourceId);
    if (!source) return;
    setCopyPackageName(`${resourceTitle(source)}资源包`);
    setTabletopContextMenu(null);
    setDialog({
      kind: "copy-resource-to-package",
      sourceWorkspaceKey: owner.key,
      resourceId,
      name: resourceTitle(source),
    });
  }

  function copyResourceIntoWorkspace(sourceWorkspaceKey: string, resourceId: string, targetWorkspaceKey: string) {
    const source = workspaces.find((workspace) => workspace.key === sourceWorkspaceKey);
    const target = workspaces.find((workspace) => workspace.key === targetWorkspaceKey);
    if (!source || !target) return;
    const result = copyWorkspaceResourceToPackage(source, target, resourceId);
    setWorkspaces((current) => current.map((workspace) => workspace.key === target.key ? result.workspace : workspace));
    setActiveKey(target.key);
    setActiveResourceId(result.resourceId);
    setDialog(null);
    notify(result.copiedResourceIds.length > 1
      ? `已复制到“${target.document.package.name}”，并带上 ${result.copiedResourceIds.length - 1} 个切换形态`
      : `已复制到“${target.document.package.name}”`);
  }

  async function copyResourceIntoNewWorkspace(sourceWorkspaceKey: string, resourceId: string) {
    const source = workspaces.find((workspace) => workspace.key === sourceWorkspaceKey);
    if (!source) return;
    const target = await createBlankWorkspace(copyPackageName);
    const result = copyWorkspaceResourceToPackage(source, target, resourceId);
    setWorkspaces((current) => [...current, result.workspace]);
    setActiveKey(result.workspace.key);
    setActiveResourceId(result.resourceId);
    setDialog(null);
    notify(`已新建“${result.workspace.document.package.name}”并复制资源`);
  }

  function requestTabletopCreation() {
    setTabletopNameDraft(`新桌面 ${tabletops.length + 1}`);
    setDialog({ kind: "new-tabletop" });
  }

  function openTabletopContextMenu(tabletopId: string, x: number, y: number) {
    setActiveTabletopId(tabletopId);
    clearTabletopSelection();
    setTabletopView("canvas");
    setTabletopContextMenu({ kind: "canvas", x, y });
  }

  function createTabletopFromDialog() {
    const name = tabletopNameDraft.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    setTabletops((current) => [...current, createTabletopDocument(id, name)]);
    setActiveTabletopId(id);
    clearTabletopSelection();
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
    notify(`桌面已重命名为“${name}”`);
  }

  async function duplicateTabletop() {
    if (!activeTabletop || creatorOperation) return;
    setCreatorOperation("duplicate-tabletop");
    setTabletopContextMenu(null);
    try {
      await tabletopWriteQueueRef.current;
      const copy = await tabletopRepository.duplicate(
        activeTabletop,
        allTabletopMedia,
        auth.credentials?.accountId ?? null,
      );
      setTabletops((current) => [...current, copy]);
      const sync = await tabletopRepository.syncState(copy.id);
      if (sync) setTabletopSync((current) => new Map(current).set(copy.id, sync));
      setActiveTabletopId(copy.id);
      clearTabletopSelection();
      setTabletopView("canvas");
      notify(`已创建“${copy.name}”`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "复制桌面失败");
    } finally {
      setCreatorOperation(null);
    }
  }

  async function deleteTabletop(tabletopId: string) {
    if (creatorOperation) return;
    setCreatorOperation("trash-tabletop");
    setTabletopContextMenu(null);
    try {
      await tabletopWriteQueueRef.current;
      const sync = tabletopSync.get(tabletopId);
      if (sync?.scope === "cloud") {
        if (!auth.credentials?.canWrite) throw new Error("当前会话不能删除云端桌面。");
        applyCloudSnapshot(await cloudDocumentService.trash(
          "gm-tabletop-document",
          tabletopId,
          auth.credentials,
        ), true);
      } else {
        await tabletopRepository.trash(tabletopId);
        const remaining = tabletops.filter((tabletop) => tabletop.id !== tabletopId);
        setTabletops(remaining);
        setActiveTabletopId(activeTabletopId === tabletopId ? remaining[0]?.id ?? "" : activeTabletopId);
      }
      clearTabletopSelection();
      setTabletopView("canvas");
      setDialog(null);
      notify("桌面已移到回收站");
    } catch (error) {
      notify(error instanceof Error ? error.message : "桌面删除失败");
    } finally {
      setCreatorOperation(null);
    }
  }

  function duplicateSelectedInstance() {
    if (!selectedInstance) return;
    const id = crypto.randomUUID();
    applyTabletopCommand({ type: "duplicate", instanceId: selectedInstance.id, newInstanceId: id });
    selectTabletopInstance(id);
    setTabletopContextMenu(null);
  }

  function deleteSelectedInstance() {
    if (!selectedInstance) return;
    applyTabletopCommand({ type: "delete", instanceId: selectedInstance.id });
    clearTabletopSelection();
    setTabletopContextMenu(null);
  }

  async function exportTabletop() {
    if (!activeTabletop || creatorOperation) return;
    setCreatorOperation("export-tabletop");
    try {
      const candidate = await tabletopRepository.save(activeTabletop, allTabletopMedia, auth.credentials?.accountId ?? null);
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
    } finally {
      setCreatorOperation(null);
    }
  }

  async function importTabletop(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || creatorOperation) return;
    setCreatorOperation("read-tabletop");
    try {
    const result = await loadPbtab(
      new Uint8Array(await file.arrayBuffer()),
      validateTabletopDocumentCandidate,
    );
    if (!result.candidate) {
      setDialog({ kind: "diagnostics", title: "导入失败 · 零写入", diagnostics: result.diagnostics });
      return;
    }
    const disposition = await tabletopRepository.importDisposition(result.candidate);
    if (disposition === "same") {
      setActiveTabletopId(result.candidate.document.documentId);
      clearTabletopSelection();
      setTabletopView("canvas");
      notify("这个桌面已经打开，内容完全相同，不需要重复导入");
      return;
    }
    if (disposition === "conflict") {
      setDialog({ kind: "tabletop-import-conflict", incoming: result.candidate });
      return;
    }
    await commitTabletopImport(result.candidate, "reject");
    } finally {
      setCreatorOperation(null);
    }
  }

  function deleteSelectedInstances() {
    if (selectedInstanceIds.length < 2) return deleteSelectedInstance();
    applyTabletopCommand({ type: "delete-many", instanceIds: selectedInstanceIds });
    clearTabletopSelection();
    setTabletopContextMenu(null);
  }

  function arrangeTabletopInstances() {
    if (!activeTabletop || activeTabletop.instances.length === 0) return;
    const viewportWidth = (tabletopViewportRef.current?.clientWidth ?? 1200) / canvasZoom;
    const gap = 24;
    const inset = 24;
    const widths = activeTabletop.instances.map((instance) =>
      Number(instance.resource.presentation.width) * gmCardPixelsPerDesignUnit * instance.scale);
    const widest = Math.max(240, ...widths);
    const columns = Math.max(1, Math.floor((viewportWidth - inset * 2 + gap) / (widest + gap)));
    const rowHeights: number[] = [];
    activeTabletop.instances.forEach((instance, index) => {
      const row = Math.floor(index / columns);
      const height = Number(instance.resource.presentation.height) * gmCardPixelsPerDesignUnit * instance.scale;
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, height);
    });
    const rowTops = rowHeights.map((_height, row) => inset + rowHeights
      .slice(0, row)
      .reduce((total, height) => total + height + gap, 0));
    const canvas = {
      width: Math.max(activeTabletop.canvas.width, inset * 2 + columns * widest + Math.max(0, columns - 1) * gap),
      height: Math.max(activeTabletop.canvas.height, (rowTops.at(-1) ?? inset) + (rowHeights.at(-1) ?? 0) + inset),
    };
    const result = executeTabletopCommand({ ...activeTabletop, canvas }, {
      type: "arrange",
      placements: activeTabletop.instances.map((instance, index) => ({
        instanceId: instance.id,
        position: {
          x: inset + (index % columns) * (widest + gap),
          y: rowTops[Math.floor(index / columns)] ?? inset,
        },
        layer: index,
        rotation: 0,
      })),
    }, { capabilities: gmCapabilities });
    if (result.diagnostics.length) {
      notify(result.diagnostics[0]!.code);
      return;
    }
    setTabletops((current) => current.map((tabletop) => tabletop.id === activeTabletop.id ? result.document : tabletop));
    clearTabletopSelection();
    setTabletopContextMenu(null);
  }

  function expandActiveTabletop() {
    if (!activeTabletop) return;
    setTabletops((current) => current.map((tabletop) => tabletop.id === activeTabletop.id
      ? { ...tabletop, canvas: { width: tabletop.canvas.width + 800, height: tabletop.canvas.height + 600 } }
      : tabletop));
    setTabletopContextMenu(null);
    notify("桌面已扩大");
  }

  async function commitTabletopImport(
    candidate: TabletopDocumentCandidate,
    resolution: "reject" | "replace" | "copy",
  ) {
    if (creatorOperation) return;
    setCreatorOperation("import-tabletop");
    try {
      const model = await tabletopRepository.import(
        candidate,
        auth.credentials?.accountId ?? null,
        resolution,
      );
      setTabletopMedia((current) => new Map([...current, ...candidate.media]));
    setAssetUrls((current) => new Map([
      ...current,
      ...[...candidate.media].map(([id, bytes]) => [
        id,
        URL.createObjectURL(new Blob([
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        ], { type: "image/webp" })),
      ] as const),
    ]));
      const contained = containGmTabletopInstances(model);
      setTabletops((current) => current.some((item) => item.id === contained.id)
        ? current.map((item) => item.id === contained.id ? contained : item)
        : [...current, contained]);
      setActiveTabletopId(model.id);
      clearTabletopSelection();
      setTabletopView("canvas");
      setTabletopContextMenu(null);
      setDialog(null);
      notify(resolution === "copy" ? `已导入副本“${model.name}”` : `已导入“${model.name}”`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "导入桌面失败");
    } finally {
      setCreatorOperation(null);
    }
  }

  function clearFeature(index: number) {
    if (active && resource) replaceActive(clearAdversaryFeature(active, index, resource.id));
    setOpenFeatureMenu(null);
  }

  function deleteFeature(index: number) {
    if (active && resource) {
      replaceActive(deleteAdversaryFeature(active, index, resource.id));
    }
    setOpenFeatureMenu(null);
    setDialog(null);
  }

  function requestFeatureDeletion(index: number, name: string) {
    setOpenFeatureMenu(null);
    setDialog({ kind: "delete-feature", index, name });
  }

  function finishMarketHandoff(workspace: CreatorWorkspace, handoff: CreatorMarketHandoff) {
    const focusedResourceId = workspace.document.resources.some((item) => item.id === handoff.focusResourceId)
      ? handoff.focusResourceId
      : workspace.document.resources[0]?.id;
    setActiveKey(workspace.key);
    setActiveResourceId(focusedResourceId ?? "");
    if (handoff.target === "gm") {
      changeAppMode("gm");
      setDialog(null);
      notify(`已从资源市场导入 ${workspace.document.package.name}`);
    } else {
      changeAppMode("creator");
      setDialog(null);
      notify(`已从资源市场导入 ${workspace.document.package.name}`);
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
    const write = workspaceWriteQueueRef.current.then(async () => {
      await creatorWorkspaceRepository.save(next, auth.credentials?.accountId ?? null, true);
    });
    workspaceWriteQueueRef.current = write.catch(() => undefined);
    write.then(() => {
      if (handoff) finishMarketHandoff(next, handoff);
      else notify(`已载入 ${next.document.package.name}`);
    }).catch((error) => notify(error instanceof Error ? error.message : "工作区保存失败"));
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
    if (!file || creatorOperation) return;
    setCreatorOperation("read-package");
    try {
    const result = await loadPbres(new Uint8Array(await file.arrayBuffer()), validateResourcePackageCandidate);
    if (!result.candidate) {
      setDialog({ kind: "diagnostics", title: "导入失败 · 零写入", diagnostics: result.diagnostics });
      return;
    }
    acceptIncoming(result.candidate);
    } finally {
      setCreatorOperation(null);
    }
  }

  async function exportPackage() {
    if (!active || creatorOperation) return;
    setCreatorOperation("export-package");
    try {
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
    notify(`已导出完整 .pbres · ${next.document.snapshotDigest.slice(0, 18)}…`);
    } finally {
      setCreatorOperation(null);
    }
  }

  async function openPublicationDialog() {
    if (!active || creatorOperation) return;
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
    setCreatorOperation("publication-cover");
    setPackageNameDraft(active.document.package.name);
    setPackageDescriptionDraft(active.document.package.description);
    setPackageTargetsDraft(structuredClone(active.document.targets));
    setPublicationTitle(active.document.package.name);
    setPublicationSummary(active.document.package.description);
    setPublicationLanguage("中文");
    setPublicationTags([]);
    setPublicationLicense(publicationLicenseId(active.document.license.label));
    try {
      const suggestedVersion = await suggestPublishVersion(active.document, auth.credentials);
      const cover = await generatedPublicationCover(active);
      setPackageVersionDraft(suggestedVersion);
      setPublicationCover(cover);
      setDialog({ kind: "publish" });
    } catch (error) {
      setDialog({
        kind: "diagnostics",
        title: error instanceof PublicationApiError ? "无法确定发布版本" : "无法生成发布封面",
        diagnostics: [{
          code: error instanceof PublicationApiError
            ? error.code
            : error instanceof Error && error.message === "creator.publication-cover.resource-missing"
              ? "creator.publication-cover.resource-missing"
              : "creator.publication-cover.render-failed",
          severity: "error",
          family: "creator-prototype",
          version: "1",
          location: "/publication/cover",
          params: {},
        }],
      });
    } finally {
      setCreatorOperation(null);
    }
  }

  function selectConversionFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void convertThirdPartyPackage(conversionFormatRef.current, file);
  }

  async function convertThirdPartyPackage(
    formatId: Exclude<ResourceFormatId, "pbres">,
    file: File,
  ) {
    if (creatorOperation) return;
    setCreatorOperation("convert-package");
    try {
      const imported = await resourceConversionRegistry.import(formatId, {
        bytes: new Uint8Array(await file.arrayBuffer()),
        fileName: file.name,
        container: resourceContainer(file.name),
      });
      if (!imported.ok) {
        setDialog({
          kind: "conversion",
          review: {
            formatId,
            sourceFileName: file.name,
            candidate: null,
            converted: imported.report.converted,
            failed: imported.report.failed,
            diagnostics: imported.report.diagnostics,
          },
        });
        return;
      }
      const materialized = await materializeCreatorResourceConversion(imported.batch);
      setDialog({
        kind: "conversion",
        review: {
          formatId,
          sourceFileName: file.name,
          candidate: materialized.candidate,
          converted: materialized.converted,
          failed: imported.report.failed + materialized.skipped,
          diagnostics: [...imported.report.diagnostics, ...materialized.diagnostics],
        },
      });
    } catch (error) {
      setDialog({
        kind: "conversion",
        review: {
          formatId,
          sourceFileName: file.name,
          candidate: null,
          converted: 0,
          failed: 1,
          diagnostics: [{
            code: "creator.resource-conversion.failed",
            severity: "error",
            message: error instanceof Error ? error.message : "第三方资源转换失败。",
          }],
        },
      });
    } finally {
      setCreatorOperation(null);
    }
  }

  function acceptConvertedPackage(review: CreatorConversionReview) {
    if (!review.candidate) return;
    setDialog(null);
    acceptIncoming(review.candidate);
  }

  function exportConvertedPackage(review: CreatorConversionReview) {
    if (!review.candidate) return;
    downloadBytes(
      writePbres(review.candidate.document, review.candidate.media),
      `${safeFileName(review.candidate.document.package.name)}.pbres`,
    );
  }

  function replacePublicationCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || creatorOperation) return;
    setImageCropError(null);
    setPendingCreatorImage({ purpose: "publication-cover", file });
  }

  async function applyCreatorImageCrop(selection: ImageCropSelection) {
    const pending = pendingCreatorImage;
    if (!pending) return;
    setImageCropWorking(true);
    setImageCropError(null);
    try {
      const policy = pending.purpose === "publication-cover" ? publicationCoverPolicy : resourceImagePolicy;
      const { asset, bytes, blob } = await imageAsset(pending.file, policy, selection);
      if (pending.purpose === "publication-cover") {
        setPublicationCover((current) => {
          if (current.url.startsWith("blob:")) URL.revokeObjectURL(current.url);
          return { assetId: asset.id, asset, bytes, url: URL.createObjectURL(blob) };
        });
      } else {
        const workspace = workspaces.find((candidate) => candidate.key === pending.workspaceKey);
        if (!workspace) throw new Error("找不到要修改的资源包。");
        const next = replacePortrait(workspace, asset, bytes, pending.resourceId);
        setAssetUrls((current) => new Map(current).set(asset.id, URL.createObjectURL(blob)));
        setWorkspaces((current) => current.map((candidate) => candidate.key === pending.workspaceKey ? next : candidate));
        notify("卡牌图片已替换；规范卡面同步更新");
      }
      setPendingCreatorImage(null);
    } catch (error) {
      setImageCropError(error instanceof Error ? error.message : "图片处理失败，请重试。");
    } finally {
      setImageCropWorking(false);
    }
  }

  async function publishWorkspace() {
    if (!active || publicationBusy) return;
    setPublicationBusy(true);
    try {
      const editedWorkspace = updateWorkspacePackageMetadata(active, {
        name: packageNameDraft,
        version: packageVersionDraft,
        description: packageDescriptionDraft,
        targets: packageTargetsDraft,
      });
      const result = await preparePublicationCandidate(editedWorkspace, {
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
        notify(publicationSuccessMessage(result.candidate.document.package.name, published.publication));
      } catch (error) {
        const apiDiagnostics = error instanceof PublicationApiError
        ? collapsePublicationFieldErrors(error.fieldErrors).map((item) => ({
            code: item.code,
            severity: "error" as const,
            family: "resource-package",
            version: "1",
            location: item.path,
            params: { message: item.message, count: item.count },
          }))
        : [];
        setDialog({
        kind: "diagnostics",
        title: "发布失败",
        diagnostics: apiDiagnostics.length > 0 ? apiDiagnostics : [{
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
    } finally {
      setPublicationBusy(false);
    }
  }

  async function createWorkspaceFromDialog() {
    const next = await createBlankWorkspace(newName);
    setWorkspaces((current) => [...current, next]);
    setActiveKey(next.key);
    setActiveResourceId(next.document.resources[0]?.id ?? "");
    setDialog(null);
    notify("已显式创建空白 Workspace");
  }

  function openPackageMetadataDialog(workspaceKey: string) {
    const workspace = workspaces.find((candidate) => candidate.key === workspaceKey);
    if (!workspace) return;
    setPackageNameDraft(workspace.document.package.name);
    setPackageVersionDraft(workspace.document.package.version);
    setPackageDescriptionDraft(workspace.document.package.description);
    setPackageTargetsDraft(structuredClone(workspace.document.targets));
    setTabletopContextMenu(null);
    setDialog({ kind: "package-metadata", workspaceKey });
  }

  function savePackageMetadata(workspaceKey: string) {
    if (!packageNameDraft.trim() || !isSemanticVersion(packageVersionDraft)) return;
    setWorkspaces((current) => current.map((workspace) => workspace.key === workspaceKey
      ? updateWorkspacePackageMetadata(workspace, {
          name: packageNameDraft,
          version: packageVersionDraft,
          description: packageDescriptionDraft,
          targets: packageTargetsDraft,
        })
      : workspace));
    setDialog(null);
    notify("资源包信息已保存");
  }

  function replacePortraitFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !active || !resource) return;
    setImageCropError(null);
    setPendingCreatorImage({ purpose: "resource-image", file, workspaceKey: active.key, resourceId: resource.id });
  }

  function createResource(template: { id: string; version: string }) {
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
    notify("本地修改已另存为新 Package ID；导入版本已载入");
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
    const displayResource = instance.flipped && instance.resource.media.back
      ? {
          ...instance.resource,
          presentation: { ...instance.resource.presentation, mode: "image" as const },
          media: { ...instance.resource.media, portrait: instance.resource.media.back },
        }
      : instance.resource;
    const instanceAssets = assetsFor(displayResource.media);
    if (displayResource.template.id === adversaryTemplate.id) {
      return <CanonicalCardSurface
        resource={displayResource as TabletopInstance["resource"] & { data: AdversaryData }}
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
        label={`${(displayResource.data as AdversaryData).名称}桌面实例`}
      />;
    }
    if (displayResource.template.id === weaponTemplate.id) {
      const renderer = weaponRendererFor(instance.resource.template.version);
      return <CanonicalCardSurface
        resource={displayResource as TabletopInstance["resource"] & { data: WeaponData }}
        expectedRendererRevision={renderer.revision}
        renderer={renderer}
        assets={instanceAssets}
        state={instance.state}
        label={`${(displayResource.data as WeaponData).名称}桌面实例`}
      />;
    }
    if (displayResource.template.id === armorTemplate.id) {
      return <CanonicalCardSurface
        resource={displayResource as TabletopInstance["resource"] & { data: ArmorData }}
        expectedRendererRevision={armorTemplate.rendererRevision}
        renderer={armorRendererFor(instance.resource.template.version)}
        assets={instanceAssets}
        state={instance.state}
        label={`${(displayResource.data as ArmorData).名称}桌面实例`}
      />;
    }
    if (displayResource.template.id === environmentTemplate.id) {
      return <CanonicalCardSurface
        resource={displayResource as TabletopInstance["resource"] & { data: EnvironmentData }}
        expectedRendererRevision={environmentTemplate.rendererRevision}
        renderer={environmentRendererFor(instance.resource.template.version)}
        assets={instanceAssets}
        state={instance.state}
        label={`${(displayResource.data as EnvironmentData).名称}桌面实例`}
      />;
    }
    const renderer = trustedRendererFor(displayResource.template.id, displayResource.template.version);
    if (renderer) return <CanonicalCardSurface
      resource={displayResource as unknown as SurfaceResource<Record<string, unknown>>}
      expectedRendererRevision={renderer.revision}
      renderer={renderer}
      assets={instanceAssets}
      state={instance.state}
      label={`${String((displayResource.data as Record<string, unknown>).名称 ?? "未命名资源")}桌面实例`}
    />;
    return <div className="tabletop-renderer-error">无法呈现卡面</div>;
  }

  return (
    <main className={`creator-prototype${appMode === "gm" ? " is-gm-mode" : ""}${appMode === "gm" || resourcePanelOpen ? " is-resource-panel-open" : ""}`} style={designStyle} data-design-source={creatorWorkspaceDesign.document}>
      <div className="creator-workspace">
        <aside className="resource-explorer">
          <header className="explorer-toolbar"><strong>资源管理器</strong><div>
            <button type="button" title="新建资源包" aria-label="新建资源包" disabled={Boolean(creatorOperation)} onClick={() => setDialog({ kind: "new" })}><Icon name="packagePlus" /></button>
            <div className="explorer-import-menu">
              <button type="button" title="导入资源包" aria-label="导入资源包" aria-haspopup="menu" disabled={Boolean(creatorOperation)}><Icon name="upload" /></button>
              <div className="explorer-import-menu-panel" role="menu">
                <button type="button" role="menuitem" disabled={Boolean(creatorOperation)} onClick={() => importRef.current?.click()}>导入 pbres 格式</button>
                {creatorThirdPartyFormats.map((format) => <button key={format.id} type="button" role="menuitem" disabled={Boolean(creatorOperation)} onClick={() => {
                  conversionFormatRef.current = format.id;
                  conversionImportRef.current?.click();
                }}>{format.label}</button>)}
              </div>
            </div>
            <button type="button" title="导出资源包" aria-label="导出资源包" disabled={!active || Boolean(creatorOperation)} onClick={exportPackage}><Icon name="download" /></button>
            <button type="button" title="发布到资源市场" aria-label="发布到资源市场" disabled={!active || Boolean(creatorOperation)} onClick={() => void openPublicationDialog()}><Icon name="package" /></button>
            <button type="button" title="新建资源" aria-label="新建资源" disabled={!active || Boolean(creatorOperation)} onClick={() => setDialog({ kind: "new-resource" })}><Icon name="filePlus" /></button>
            <button type="button" title="新建文件夹" aria-label="新建文件夹" disabled={!active || Boolean(creatorOperation)} onClick={() => active && replaceActive(createWorkspaceFolder(active))}><Icon name="folderPlus" /></button>
          </div></header>
          {creatorOperation && <div className="creator-operation-strip"><OperationStatus label={creatorOperationLabels[creatorOperation]} size="regular" /></div>}
          <label className="explorer-search"><Icon name="search" /><input aria-label="筛选资源" placeholder="名称、目录、标签或资源包" value={resourceSearch} onChange={(event) => setResourceSearch(event.currentTarget.value)} /></label>
          <div className="workspace-resource-filters">
            <TemplateMultiSelect options={resourceTemplateOptions} value={resourceTemplateFilters} onChange={setResourceTemplateFilters} />
            <button
              type="button"
              className={resourceMultiSelect ? "is-active" : ""}
              aria-pressed={resourceMultiSelect}
              onClick={toggleResourceMultiSelect}
            >多选{resourceMultiSelect && selectedWorkspaceResources.length > 0 ? `（${selectedWorkspaceResources.length}）` : ""}</button>
            <button
              type="button"
              className="workspace-sort-button"
              aria-label={workspaceSortDirection === "ascending" ? "按名称降序排列" : "按名称升序排列"}
              onClick={() => setWorkspaceSortDirection((current) => current === "ascending" ? "descending" : "ascending")}
            >名称 {workspaceSortDirection === "ascending" ? "↑" : "↓"}</button>
          </div>
          {(resourceSearch.trim() || resourceTemplateFilters.length > 0) && <div className="workspace-resource-results resource-tree" aria-label="跨资源包筛选结果" role="tree">
            {filteredWorkspaceResources.map(({ workspace, resource: item }) => {
              const selected = selectedWorkspaceResources.some((selection) => selection.workspaceKey === workspace.key && selection.resourceId === item.id);
              return <div className="workspace-tree-node" key={`${workspace.key}:${item.id}`}>
                <div
                  className={`file-row filtered-resource-row${workspace.key === active?.key && item.id === activeResourceId ? " is-current" : ""}${resourceMultiSelect && selected ? " is-multi-selected" : ""}`}
                  role="treeitem"
                  aria-selected={resourceMultiSelect ? selected : workspace.key === active?.key && item.id === activeResourceId}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (resourceMultiSelect) {
                      setSelectedWorkspaceResources((current) => current.some((selection) => selection.workspaceKey === workspace.key && selection.resourceId === item.id)
                        ? current
                        : [...current, { workspaceKey: workspace.key, resourceId: item.id }]);
                    } else {
                      activateWorkspaceResource(item.id, workspace.key);
                    }
                    setTabletopContextMenu({ kind: "resource", workspaceKey: workspace.key, resourceId: item.id, x: event.clientX, y: event.clientY });
                  }}
                >
                  <i />
                  <span className={templateMarkClassName(item.template.id)}><ResourceIcon resource={item} /></span>
                  <button type="button" className="tree-node-label" onClick={() => resourceMultiSelect ? toggleWorkspaceResourceSelection(workspace.key, item.id) : activateWorkspaceResource(item.id, workspace.key)} onDoubleClick={() => { if (!resourceMultiSelect) pinWorkspaceTab(item.id, workspace.key); }}>{resourceTitle(item)}</button>
                  <small className="filtered-resource-package" title={`${workspace.document.package.name} · ${item.path}`}>{workspace.document.package.name}</small>
                  {resourceMultiSelect && <label className="filtered-resource-select" title="选择资源"><input type="checkbox" checked={selected} onChange={() => toggleWorkspaceResourceSelection(workspace.key, item.id)} aria-label={`选择 ${resourceTitle(item)}`} /></label>}
                </div>
              </div>;
            })}
            {filteredWorkspaceResources.length === 0 && <p>没有符合条件的资源</p>}
          </div>}
          <div className={`workspace-package-list${resourceSearch.trim() || resourceTemplateFilters.length > 0 ? " is-filtering" : ""}`}>
            {workspaces.map((workspace) => {
              const expanded = expandedWorkspaceKeys.has(workspace.key);
              return <section className={`workspace-package${workspace.key === active?.key ? " is-current" : ""}${expanded ? " is-expanded" : ""}`} key={workspace.key}>
              <div className={`package-root${workspace.key === active?.key ? " is-current" : ""}`} onContextMenu={(event) => {
                event.preventDefault();
                switchWorkspace(workspace.key);
                setTabletopContextMenu({ kind: "workspace", workspaceKey: workspace.key, x: event.clientX, y: event.clientY });
              }}>
                <button type="button" className="package-root-main" aria-expanded={expanded} onClick={() => toggleWorkspacePackage(workspace.key)}>
                  <Icon name={expanded ? "chevronDown" : "chevronRight"} /><Icon name="package" /><strong>{workspace.document.package.name}</strong>
                  <CloudSyncIndicator sync={workspaceSync.get(workspace.key)} saving={workspaceSaving && workspace.key === activeKey} />
                </button>
                <button type="button" aria-label={`${workspace.document.package.name}菜单`} onClick={(event) => {
                  switchWorkspace(workspace.key);
                  const bounds = event.currentTarget.getBoundingClientRect();
                  setTabletopContextMenu({ kind: "workspace", workspaceKey: workspace.key, x: bounds.left, y: bounds.bottom });
                }}><Icon name="ellipsis" /></button>
              </div>
              <div className={`workspace-package-contents${expanded ? " is-open" : ""}`} aria-hidden={!expanded} inert={!expanded}><div>
                <div className="resource-tree"><WorkspaceTree
                  workspace={workspace}
                  activeResourceId={workspace.key === active?.key ? activeResourceId : ""}
                  selectionMode={resourceMultiSelect}
                  selectedResourceIds={new Set(selectedWorkspaceResources.filter((selection) => selection.workspaceKey === workspace.key).map((selection) => selection.resourceId))}
                  sortDirection={workspaceSortDirection}
                  onActivateResource={(resourceId) => activateWorkspaceResource(resourceId, workspace.key)}
                  onToggleResourceSelection={(resourceId) => toggleWorkspaceResourceSelection(workspace.key, resourceId)}
                  onPinResource={(resourceId) => pinWorkspaceTab(resourceId, workspace.key)}
                  onSelectFolder={(folderId) => {
                    setActiveKey(workspace.key);
                    replaceWorkspace(workspace.key, selectWorkspaceFolder(workspace, folderId));
                  }}
                  onToggleFolder={(folderId) => replaceWorkspace(workspace.key, toggleWorkspaceFolder(workspace, folderId))}
                  onRenameFolder={(folderId, name) => renameWorkspaceTreeFolder(workspace.key, folderId, name)}
                  onMoveNode={(node, parentId) => moveWorkspaceTreeNode(workspace.key, node, parentId)}
                  onDeleteNode={(node) => requestWorkspaceNodeDeletion(node, workspace.key)}
                  onResourceContextMenu={(resourceId, x, y) => {
                    if (resourceMultiSelect) {
                      setSelectedWorkspaceResources((current) => current.some((selection) => selection.workspaceKey === workspace.key && selection.resourceId === resourceId)
                        ? current
                        : [...current, { workspaceKey: workspace.key, resourceId }]);
                    } else {
                      activateWorkspaceResource(resourceId, workspace.key);
                    }
                    setTabletopContextMenu({ kind: "resource", workspaceKey: workspace.key, resourceId, x, y });
                  }}
                  onRootContextMenu={(x, y) => setTabletopContextMenu({ kind: "workspace", workspaceKey: workspace.key, x, y })}
                  resourceTitle={resourceTitle}
                  renderResourceIcon={(candidate) => <ResourceIcon resource={candidate} />}
                /></div>
              </div></div>
            </section>})}
          </div>
          <footer><span>{active?.document.resources.length ?? 0} 个资源</span></footer>
        </aside>

        {resourcePanelOpen && <CreatorColumnResizeHandle
          label="调整工作区宽度"
          value={workspaceColumnShare}
          preference={creatorColumnPreferences.workspace}
          cssVariable="--creator-workspace-share"
          onChange={setWorkspaceColumnShare}
        />}

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
                  <ResourceIcon resource={candidate} /><span>{resourceTitle(candidate)}</span>
                </button>
                <button type="button" className="resource-tab-close" aria-label={`关闭 ${resourceTitle(candidate)}`} onClick={() => closeWorkspaceTab(workspace.key, candidate.id)}><Icon name="x" /></button>
              </div>;
            }))}
          </nav>
          {resource ? <div className={`workbench-body${armor ? " armor-workbench-body" : ""}`} onPointerDown={() => pinWorkspaceTab(resource.id)}>
            <div
              className="authoring-column"
              onFocusCapture={requestWorkspaceCloudSyncAfterEditing}
              onBlurCapture={requestWorkspaceCloudSyncAfterEditing}
            >
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
            {adversary && active.document.contractVersion === RESOURCE_PACKAGE_VERSION
              && adversaryTemplate.tabletop.replacements.map((replacement) => <ReplacementEditor
              key={replacement.id}
              label={replacement.label}
              value={resource.replacements?.find((candidate) => candidate.replacementId === replacement.id)?.targetResourceId ?? ""}
              options={active.document.resources
                .filter((candidate) => candidate.id !== resource.id)
                .map((candidate) => ({ id: candidate.id, name: resourceTitle(candidate) }))}
              onChange={(targetResourceId) => replaceActive(updateResourceReplacement(
                active,
                resource.id,
                replacement.id,
                targetResourceId,
              ))}
            />)}

            {weapon && <WeaponEditor data={weapon} onField={updateWeaponField} />}
            {armor && <ArmorEditor data={armor} onField={updateArmorField} />}
            {referenceLayout && <StructuredEditor data={resource.data as Record<string, unknown>} layout={referenceLayout} onValue={updateReferenceValue} />}
            </div>

            <CreatorColumnResizeHandle
              label="调整编辑区与预览区宽度"
              value={editorColumnShare}
              preference={creatorColumnPreferences.editor}
              cssVariable="--creator-editor-share"
              onChange={setEditorColumnShare}
            />

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
              {adversaryPreviewResource
                ? <AdversaryRuntimePreview resource={adversaryPreviewResource} assets={previewAssets} />
                : <AutoFitPreview>
                  {weaponPreviewResource && <CanonicalCardSurface resource={weaponPreviewResource} expectedRendererRevision={weaponTemplate.rendererRevision} renderer={weaponRendererFor(weaponPreviewResource.template.version)} assets={previewAssets} label={`${weaponPreviewResource.data.名称 || "未命名武器"}规范卡面`} />}
                  {armorPreviewResource && <CanonicalCardSurface resource={armorPreviewResource} expectedRendererRevision="armor-card-r1" renderer={armorRendererFor(armorPreviewResource.template.version)} assets={previewAssets} label={`${armorPreviewResource.data.名称 || "未命名护甲"}规范卡面`} />}
                  {environmentPreviewResource && <CanonicalCardSurface resource={environmentPreviewResource} expectedRendererRevision="environment-card-r1" renderer={environmentRendererFor(environmentPreviewResource.template.version)} assets={previewAssets} label={`${environmentPreviewResource.data.名称 || "未命名环境"}规范卡面`} />}
                  {referenceRenderer && <CanonicalCardSurface resource={resource as unknown as SurfaceResource<Record<string, unknown>>} expectedRendererRevision={referenceRenderer.revision} renderer={referenceRenderer} assets={previewAssets} label={`${String((resource.data as Record<string, unknown>).名称 ?? "未命名资源")}规范卡面`} />}
                </AutoFitPreview>}
              <footer className="preview-media"><span className="media-icon"><Icon name="image" /></span><strong>{resource.media.portrait ? "已设置卡图" : "未设置卡图"}</strong><button type="button" onClick={() => portraitRef.current?.click()}><Icon name="image" />{resource.media.portrait ? "替换" : "添加"}</button></footer>
            </aside>
          </div> : <div className="closed-tabs-empty"><strong>没有打开的资源</strong></div>}
        </section>}

        {appMode === "gm" && <section className="gm-workbench" data-design-frame={creatorWorkspaceDesign.gmTabletop.frame}>
          <nav className="tabletop-tabs" aria-label="打开的桌面">
            {tabletops.map((tabletop) => <div
              className={`tabletop-tab ${tabletop.id === activeTabletop?.id ? "is-current" : ""}`}
              key={tabletop.id}
              onContextMenu={(event) => {
                event.preventDefault();
                openTabletopContextMenu(tabletop.id, event.clientX, event.clientY);
              }}
            ><button type="button" className="tabletop-tab-main" onClick={() => { setActiveTabletopId(tabletop.id); clearTabletopSelection(); setTabletopView("canvas"); }}><span>▦</span><b>{tabletop.name}</b><CloudSyncIndicator sync={tabletopSync.get(tabletop.id)} saving={tabletopSaving && tabletop.id === activeTabletopId} /></button><button
              type="button"
              className="tabletop-tab-close"
              aria-label={`删除 ${tabletop.name}`}
              title="删除桌面"
              onClick={() => {
                setDialog({ kind: "delete-tabletop", tabletopId: tabletop.id, name: tabletop.name });
              }}
            ><Icon name="x" /></button></div>)}
            <button type="button" className="tabletop-tab-action" aria-label="新建桌面" title="新建桌面" onClick={requestTabletopCreation}>＋</button>
          </nav>

          {!activeTabletop && <div className="gm-tabletop-empty"><strong>还没有桌面</strong><button type="button" onClick={requestTabletopCreation}>＋ 新建桌面</button></div>}

          {activeTabletop && tabletopView === "canvas" && <div
            ref={tabletopViewportRef}
            className="tabletop-viewport"
            tabIndex={0}
            aria-label={`${activeTabletop.name}桌面；方向键平移，0 回到 100%，F 适合内容`}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              const delta = {
                ArrowLeft: { x: 48, y: 0 }, ArrowRight: { x: -48, y: 0 },
                ArrowUp: { x: 0, y: 48 }, ArrowDown: { x: 0, y: -48 },
              }[event.key];
              if (delta) {
                event.preventDefault();
                setCanvasPan((current) => ({ x: current.x + delta.x, y: current.y + delta.y }));
              } else if (event.key === "0") {
                event.preventDefault();
                setTabletopZoom(1);
              } else if (event.key.toLocaleLowerCase() === "f") {
                event.preventDefault();
                fitTabletopContent();
              }
            }}
            onPointerDown={(event) => {
              if ((event.target as Element).closest("[data-tabletop-instance-id]")) return;
              setTabletopContextMenu(null);
              if (event.button === 0 && event.pointerType !== "touch") {
                clearTabletopSelection();
                return;
              }
              if (event.pointerType !== "touch" && event.button !== 1 && event.button !== 2) return;
              if (event.pointerType === "touch") event.preventDefault();
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
              updateTabletopPanPreview({ x: drag.startPan.x + dx, y: drag.startPan.y + dy });
            }}
            onPointerUp={(event) => {
              const drag = canvasPanRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              suppressCanvasContextMenuRef.current = drag.button === 2 && drag.moved;
              setCanvasPan({
                x: drag.startPan.x + event.clientX - drag.startPointer.x,
                y: drag.startPan.y + event.clientY - drag.startPointer.y,
              });
              canvasPanRef.current = null;
              event.currentTarget.style.cursor = "";
            }}
            onPointerCancel={(event) => {
              updateTabletopPanPreview(canvasPan);
              canvasPanRef.current = null;
              event.currentTarget.style.cursor = "";
            }}
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
              surfaceRef={tabletopSurfaceRef}
              document={activeTabletop}
              capabilities={gmCapabilities}
              selectedInstanceId={selectedInstanceId}
              selectedInstanceIds={selectedInstanceIds}
              renderInstance={(instance) => <CardDisplay
                width={Number(instance.resource.presentation.width)}
                height={Number(instance.resource.presentation.height)}
                fixedRatio={instance.resource.presentation.fixedRatio}
                displayWidth="250px"
                displayAspectRatio={63 / 88}
              >{renderTabletopInstance(instance)}</CardDisplay>}
              onSelect={(instanceId, mode) => selectAndRaiseTabletopInstance(instanceId, mode)}
              onCommand={applyTabletopCommand}
              onInstanceContextMenu={(instanceId, position) => {
                selectTabletopInstance(instanceId);
                setTabletopContextMenu({ kind: "instance", instanceId, x: position.x, y: position.y });
              }}
              coordinateScale={canvasZoom}
              positionBounds={{ ...activeTabletop.canvas, containment: "full", pixelsPerUnit: gmCardPixelsPerDesignUnit }}
              style={{ width: activeTabletop.canvas.width, height: activeTabletop.canvas.height, transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})` }}
            />
            <div className="tabletop-zoom-status" aria-label="桌面缩放">
              <button type="button" aria-label="缩小桌面" onClick={() => {
                const index = tabletopZoomSteps.indexOf(canvasZoom as never);
                setTabletopZoom(tabletopZoomSteps[Math.max(0, index - 1)] ?? tabletopZoomSteps[0]);
              }}>−</button>
              <output aria-live="polite">{Math.round(canvasZoom * 100)}%</output>
              <button type="button" aria-label="放大桌面" onClick={() => {
                const index = tabletopZoomSteps.indexOf(canvasZoom as never);
                setTabletopZoom(tabletopZoomSteps[Math.min(tabletopZoomSteps.length - 1, index + 1)] ?? tabletopZoomSteps.at(-1)!);
              }}>＋</button>
              <i aria-hidden="true" />
              <button type="button" className="zoom-reset" onClick={() => setTabletopZoom(1)}>100%</button>
              <button type="button" className="zoom-fit" onClick={fitTabletopContent}>适合内容</button>
            </div>
          </div>}

          {tabletopView === "instance-editor" && selectedInstance && <>
            <div className="instance-editor-toolbar">
              <button type="button" onClick={() => setTabletopView("canvas")}>← 返回桌面</button>
              <strong><ResourceIcon resource={selectedInstance.resource} />{selectedInstanceTemplate?.project(selectedInstance.resource.data).title ?? selectedInstance.id} · 实例</strong>
            </div>
            <div
              className="workbench-body instance-editor-body"
              onFocusCapture={requestTabletopCloudSyncAfterEditing}
              onBlurCapture={requestTabletopCloudSyncAfterEditing}
            >
              {instanceAdversary && <AdversaryEditor
                data={instanceAdversary}
                openFeatureMenu={openFeatureMenu}
                onField={(field, value) => editInstanceData([field], value)}
                onFeature={(index, field, value) => editInstanceData(["特性", String(index), field], value)}
              />}
              {instanceWeapon && <WeaponEditor data={instanceWeapon} onField={(field, value) => editInstanceData([field], value)} />}
              {!instanceAdversary && !instanceWeapon && selectedInstanceLayout && <StructuredEditor
                data={selectedInstance.resource.data}
                layout={selectedInstanceLayout}
                onValue={(path, value) => editInstanceData(path.split("."), value)}
              />}
              <aside className="preview-panel">
                <header><h1>实例预览</h1><span className="instance-edit-note">修改只作用于桌面上的这张卡</span></header>
                <AutoFitPreview>{renderTabletopInstance(selectedInstance)}</AutoFitPreview>
                <footer className="preview-media"><span className="media-icon"><Icon name="image" /></span><strong>{selectedInstance.resource.media.portrait ? "已设置卡图" : "未设置卡图"}</strong><button type="button" disabled><Icon name="image" />替换</button></footer>
              </aside>
            </div>
          </>}
        </section>}
      </div>

      {tabletopContextMenu?.kind === "workspace" && <TabletopContextMenu
        className="context-menu workspace-context-menu"
        x={tabletopContextMenu.x}
        y={tabletopContextMenu.y}
        estimatedWidth={210}
        estimatedHeight={260}
        onClose={() => setTabletopContextMenu(null)}
      >
        {(workspaceSync.get(tabletopContextMenu.workspaceKey)?.scope ?? "local-only") === "local-only" && <button type="button" role="menuitem" onClick={() => {
          const workspace = workspaces.find((item) => item.key === tabletopContextMenu.workspaceKey);
          if (workspace) requestCloudSync("creator-workspace", workspace.key, workspace.document.package.name);
        }}>同步到云端</button>}
        {workspaceSync.get(tabletopContextMenu.workspaceKey)?.state === "conflict" && <button type="button" role="menuitem" onClick={() => {
          const workspace = workspaces.find((item) => item.key === tabletopContextMenu.workspaceKey);
          if (workspace) setDialog({ kind: "cloud-conflict", documentKind: "creator-workspace", documentId: workspace.key, name: workspace.document.package.name });
          setTabletopContextMenu(null);
        }}>解决云冲突</button>}
        <i />
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); setDialog({ kind: "new" }); }}>新建资源包</button>
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); importRef.current?.click(); }}>导入 .pbres</button>
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); void exportPackage(); }}>导出 .pbres</button>
        <button type="button" role="menuitem" onClick={() => openPackageMetadataDialog(tabletopContextMenu.workspaceKey)}>编辑资源包信息</button>
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); void openPublicationDialog(); }}>发布到资源市场</button>
        <i />
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); setDialog({ kind: "new-resource" }); }}>新建资源</button>
        <button type="button" role="menuitem" onClick={() => { if (active) replaceActive(createWorkspaceFolder(active)); setTabletopContextMenu(null); }}>新建文件夹</button>
        <i />
        <button type="button" role="menuitem" onClick={() => requestWorkspacePackageClose(tabletopContextMenu.workspaceKey)}>关闭资源包</button>
      </TabletopContextMenu>}

      {tabletopContextMenu?.kind === "resource" && <TabletopContextMenu
        className="context-menu resource-context-menu"
        x={tabletopContextMenu.x}
        y={tabletopContextMenu.y}
        estimatedWidth={230}
        estimatedHeight={resourceMultiSelect ? 260 : 190}
        onClose={() => setTabletopContextMenu(null)}
      >
        {appMode === "gm" && activeTabletop && tabletopView === "canvas" && resourceMultiSelect && selectedWorkspaceResources.length > 0 && <>
          <button type="button" role="menuitem" onClick={placeSelectedTabletopResources}>批量放到当前桌面（{selectedWorkspaceResources.length}）</button>
          <i />
        </>}
        {appMode === "gm" && activeTabletop && tabletopView === "canvas" && !resourceMultiSelect && <>
          <button type="button" role="menuitem" onClick={() => {
            placeWorkspaceResources([{ workspaceKey: tabletopContextMenu.workspaceKey, resourceId: tabletopContextMenu.resourceId }]);
            setTabletopContextMenu(null);
          }}>放到当前桌面</button>
          <i />
        </>}
        <button type="button" role="menuitem" onClick={() => {
          activateWorkspaceResource(tabletopContextMenu.resourceId, tabletopContextMenu.workspaceKey);
          changeAppMode("creator");
          setTabletopContextMenu(null);
        }}>打开</button>
        <button type="button" role="menuitem" onClick={() => {
          pinWorkspaceTab(tabletopContextMenu.resourceId, tabletopContextMenu.workspaceKey);
          changeAppMode("creator");
          setTabletopContextMenu(null);
        }}>在新标签页打开</button>
        <i />
        <button type="button" role="menuitem" onClick={() => duplicateResource(tabletopContextMenu.resourceId, tabletopContextMenu.workspaceKey)}>复制</button>
        <button type="button" role="menuitem" onClick={() => requestResourcePackageCopy(tabletopContextMenu.resourceId, tabletopContextMenu.workspaceKey)}>复制到资源包…</button>
        {resourceMultiSelect && selectedWorkspaceResources.length > 0
          ? <button type="button" role="menuitem" className="delete" onClick={requestSelectedResourceDeletion}>删除已选（{selectedWorkspaceResources.length}）</button>
          : <button type="button" role="menuitem" className="delete" onClick={() => requestWorkspaceNodeDeletion({ kind: "resource", id: tabletopContextMenu.resourceId }, tabletopContextMenu.workspaceKey)}>删除</button>}
      </TabletopContextMenu>}

      {tabletopContextMenu?.kind === "instance" && <TabletopContextMenu
        className="context-menu instance-context-menu"
        x={tabletopContextMenu.x}
        y={tabletopContextMenu.y}
        estimatedWidth={190}
        estimatedHeight={330}
        onClose={() => setTabletopContextMenu(null)}
      >
        <button type="button" role="menuitem" onClick={() => { if (selectedInstance) setDetailTabletopInstanceId(selectedInstance.id); setTabletopContextMenu(null); }}>查看详情</button>
        {selectedInstanceLayout && <button type="button" role="menuitem" onClick={() => { setTabletopView("instance-editor"); setTabletopContextMenu(null); }}>编辑卡牌</button>}
        {selectedInstance?.resource.replacements.map((replacement) => {
          const label = templateRegistry.resolve(
            selectedInstance.resource.template.id,
            selectedInstance.resource.template.version,
          )?.tabletop.replacements.find((candidate) => candidate.id === replacement.replacementId)?.label
            ?? "切换形态";
          return <button type="button" role="menuitem" key={replacement.replacementId} onClick={() => replaceSelectedInstanceForm(replacement.replacementId)}>{label}</button>;
        })}
        <button type="button" role="menuitem" onClick={() => { if (selectedInstance) applyTabletopCommand({ type: "rotate-quarter", instanceId: selectedInstance.id, quarterTurns: 1 }); setTabletopContextMenu(null); }}>顺时针旋转 90°</button>
        {selectedInstance?.resource.media.back && <button type="button" role="menuitem" onClick={() => { applyTabletopCommand({ type: "flip", instanceId: selectedInstance.id }); setTabletopContextMenu(null); }}>{selectedInstance.flipped ? "翻至正面" : "翻至背面"}</button>}
        <button type="button" role="menuitem" onClick={duplicateSelectedInstance}>复制</button>
        <button type="button" role="menuitem" className="delete" onClick={deleteSelectedInstances}>{selectedInstanceIds.length > 1 ? `删除已选（${selectedInstanceIds.length}）` : "删除"}</button>
      </TabletopContextMenu>}

      {tabletopContextMenu?.kind === "canvas" && <TabletopContextMenu
        className="context-menu canvas-context-menu"
        x={tabletopContextMenu.x}
        y={tabletopContextMenu.y}
        estimatedWidth={240}
        estimatedHeight={360}
        onClose={() => setTabletopContextMenu(null)}
      >
        {(activeTabletop && (tabletopSync.get(activeTabletop.id)?.scope ?? "local-only") === "local-only") && <button type="button" role="menuitem" onClick={() => requestCloudSync("gm-tabletop-document", activeTabletop.id, activeTabletop.name)}>同步到云端</button>}
        {activeTabletop && tabletopSync.get(activeTabletop.id)?.state === "conflict" && <button type="button" role="menuitem" onClick={() => {
          setDialog({ kind: "cloud-conflict", documentKind: "gm-tabletop-document", documentId: activeTabletop.id, name: activeTabletop.name });
          setTabletopContextMenu(null);
        }}>解决云冲突</button>}
        <i />
        <button type="button" role="menuitem" onClick={requestTabletopRename}>重命名</button>
        <button type="button" role="menuitem" onClick={() => void duplicateTabletop()}>复制桌面</button>
        <i />
        <button type="button" role="menuitem" onClick={() => tabletopImportRef.current?.click()}>导入 .pbtab</button>
        <button type="button" role="menuitem" onClick={exportTabletop}>导出 .pbtab</button>
        <button type="button" role="menuitem" onClick={() => { setTabletopContextMenu(null); window.print(); }}>打印</button>
        <button type="button" role="menuitem" onClick={arrangeTabletopInstances}>整理卡牌</button>
        <button type="button" role="menuitem" onClick={expandActiveTabletop}>扩大桌面</button>
        <button type="button" role="menuitem" className="delete" onClick={() => { applyTabletopCommand({ type: "clear" }); clearTabletopSelection(); setTabletopContextMenu(null); }}>清空桌面</button>
        <i />
        <button type="button" role="menuitem" className="delete" onClick={() => {
          if (activeTabletop) setDialog({ kind: "delete-tabletop", tabletopId: activeTabletop.id, name: activeTabletop.name });
          setTabletopContextMenu(null);
        }}>删除桌面</button>
      </TabletopContextMenu>}

      <input ref={tabletopImportRef} hidden type="file" accept=".pbtab" onChange={importTabletop} />

      {detailTabletopInstance && <CardPreviewDialog
        width={Number(detailTabletopInstance.resource.presentation.width)}
        height={Number(detailTabletopInstance.resource.presentation.height)}
        fixedRatio={detailTabletopInstance.resource.presentation.fixedRatio}
        label="卡牌详情"
        onClose={() => setDetailTabletopInstanceId("")}
      >{renderTabletopInstance(detailTabletopInstance)}</CardPreviewDialog>}

      <input ref={importRef} hidden type="file" accept=".pbres" onChange={importPackage} />
      <input ref={conversionImportRef} hidden type="file" accept=".json,.dhcb,.png,application/json,image/png" onChange={selectConversionFile} />
      <input ref={portraitRef} hidden type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={replacePortraitFromFile} />
      <input ref={publicationCoverRef} hidden type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={replacePublicationCover} />

      {pendingCreatorImage && <ImageCropDialog
        file={pendingCreatorImage.file}
        label={pendingCreatorImage.purpose === "publication-cover" ? "发布封面" : "卡牌图片"}
        fixedAspectRatio={pendingCreatorImage.purpose === "publication-cover" ? publicationCoverPolicy.fixedAspectRatio : undefined}
        working={imageCropWorking}
        processingError={imageCropError}
        onCancel={() => { setPendingCreatorImage(null); setImageCropError(null); }}
        onConfirm={(selection) => void applyCreatorImageCrop(selection)}
      />}

      {dialog?.kind === "publish" && <ResourcePackageInfoDialog
        heading="发布到资源市场"
        submitLabel="发布当前版本"
        coverUrl={publicationCover.url}
        systemPackageOptions={systemPackageOptions}
        value={{
          package: { name: packageNameDraft, version: packageVersionDraft, description: packageDescriptionDraft, targets: packageTargetsDraft },
          publication: { title: publicationTitle, summary: publicationSummary, language: publicationLanguage, tags: publicationTags, licenseId: publicationLicense },
        }}
        licenseOptions={Object.entries(publicationLicenses).map(([id, license]) => ({ id, label: license.label }))}
        busy={publicationBusy || creatorOperation === "publication-cover"}
        submitDisabled={!packageNameDraft.trim() || !isSemanticVersion(packageVersionDraft)}
        busyLabel={creatorOperation === "publication-cover" ? "正在处理封面…" : "正在发布整包…"}
        onChange={(value: ResourcePackageEditorValue) => {
          setPackageNameDraft(value.package.name);
          setPackageVersionDraft(value.package.version);
          setPackageDescriptionDraft(value.package.description);
          setPackageTargetsDraft(value.package.targets);
          if (value.publication) {
            setPublicationTitle(value.publication.title);
            setPublicationSummary(value.publication.summary);
            setPublicationLanguage(value.publication.language);
            setPublicationTags(value.publication.tags);
            setPublicationLicense(value.publication.licenseId as PublicationLicenseId);
          }
        }}
        onChooseCover={() => publicationCoverRef.current?.click()}
        onClose={() => setDialog(null)}
        onSubmit={() => void publishWorkspace()}
      />}
      {dialog?.kind === "package-metadata" && <ResourcePackageInfoDialog
        heading="编辑资源包信息"
        submitLabel="保存"
        systemPackageOptions={systemPackageOptions}
        value={{ package: { name: packageNameDraft, version: packageVersionDraft, description: packageDescriptionDraft, targets: packageTargetsDraft } }}
        submitDisabled={!packageNameDraft.trim() || !isSemanticVersion(packageVersionDraft)}
        onChange={(value) => {
          setPackageNameDraft(value.package.name);
          setPackageVersionDraft(value.package.version);
          setPackageDescriptionDraft(value.package.description);
          setPackageTargetsDraft(value.package.targets);
        }}
        onClose={() => setDialog(null)}
        onSubmit={() => savePackageMetadata(dialog.workspaceKey)}
      />}
      {dialog && dialog.kind !== "publish" && dialog.kind !== "package-metadata" && <div className="dialog-backdrop" role="presentation"><section className={`dialog dialog-${dialog.kind}`} role="dialog" aria-modal="true">
         {dialog.kind === "new" && <><h2>新建资源包</h2><Field className="dialog-field" label="名称" value={newName} onChange={setNewName} />
           <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" onClick={createWorkspaceFromDialog}>创建</button></div></>}
        {dialog.kind === "new-resource" && <><h2>新建资源</h2>
          <div className="resource-type-choices"><button type="button" onClick={() => createResource(adversaryTemplate)}><TemplateIcon templateId={adversaryTemplate.id} />敌人</button><button type="button" onClick={() => createResource(weaponTemplate)}><TemplateIcon templateId={weaponTemplate.id} />主武器</button><button type="button" onClick={() => createResource(armorTemplate)}><TemplateIcon templateId={armorTemplate.id} />护甲</button>{[
            environmentTemplate,
            ancestryTemplate, communityTemplate, professionTemplate, subclassTemplate, itemTemplate, domainTemplate,
          ].map((template) => <button type="button" key={template.id} onClick={() => createResource(template)}><TemplateIcon templateId={template.id} />{template.id}</button>)}</div>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button></div></>}
        {dialog.kind === "diagnostics" && <><h2>{dialog.title}</h2><ul className="diagnostics">{dialog.diagnostics.map((item) =>
          <li key={`${item.code}:${item.location}`}><b>{publicationErrorMessage(item.code, typeof item.params.message === "string" ? item.params.message : undefined)}{typeof item.params.count === "number" && item.params.count > 1 ? `（共 ${item.params.count} 处）` : ""}</b></li>)}</ul>
          <div className="dialog-actions"><button type="button" className="primary" onClick={() => setDialog(null)}>保留现状</button></div></>}
        {dialog.kind === "conversion" && <><h2>转换报告</h2>
          <p><strong>{dialog.review.sourceFileName}</strong></p>
          <p>格式 {dialog.review.formatId} · 转换 {dialog.review.converted} · 跳过或失败 {dialog.review.failed}</p>
          {dialog.review.diagnostics.length > 0
            ? <ul className="diagnostics">{dialog.review.diagnostics.map((item, index) => <li key={`${item.code}:${item.resourceId ?? index}`}><b>{item.message}</b><small>{item.code}</small></li>)}</ul>
            : <p>没有发现字段损失。</p>}
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button>{dialog.review.candidate ? <>
            <button type="button" onClick={() => exportConvertedPackage(dialog.review)}>导出 .pbres 备份</button>
            <button type="button" className="primary" onClick={() => acceptConvertedPackage(dialog.review)}>导入工作区</button>
          </> : null}</div></>}
        {dialog.kind === "no-op" && <><h2>NO-OP · 同版本 / 同 Digest</h2><p>{dialog.name} 已是当前完整 Snapshot，不创建副本、不覆盖。</p>
          <div className="dialog-actions"><button type="button" className="primary" onClick={() => setDialog(null)}>打开现有 Workspace</button></div></>}
        {dialog.kind === "update" && <><h2>更新现有 Workspace</h2><p>当前 Workspace 未修改；导入内容 Digest 不同。确认后才替换。</p>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" onClick={() => commitIncoming(dialog.incoming, dialog.handoff)}>更新现有</button></div></>}
        {dialog.kind === "conflict" && <><h2>dirty 同 ID 冲突</h2><p>当前 Workspace 有本地修改，禁止自动合并。</p>
          <div className="conflict-choices"><button type="button" onClick={() => setDialog(null)}>取消（零写入）</button>
            <button type="button" onClick={() => saveAsideThenImport(dialog.incoming, dialog.handoff)}>另存 · 新 Package ID / 1.0.0</button>
            <button type="button" className="danger" onClick={() => commitIncoming(dialog.incoming, dialog.handoff)}>覆盖 · 丢弃本地修改</button></div></>}
        {dialog.kind === "delete-feature" && <><h2>删除特性</h2><p>删除“{dialog.name || "未命名特性"}”？此操作会立即从当前资源中移除该特性。</p>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="danger" onClick={() => deleteFeature(dialog.index)}>删除</button></div></>}
        {dialog.kind === "delete-workspace-node" && <><h2>删除{dialog.node.kind === "folder" ? "文件夹" : "资源"}</h2><p>删除“{dialog.name}”？{dialog.node.kind === "folder" ? "文件夹内的资源也会一并删除。" : ""}</p>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="danger" onClick={() => confirmWorkspaceNodeDeletion(dialog.workspaceKey, dialog.node)}>删除</button></div></>}
        {dialog.kind === "delete-selected-resources" && <><h2>批量删除资源</h2><p>删除已选的 {dialog.selections.length} 个资源？此操作会从对应资源包中移除它们。</p>
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="danger" onClick={() => confirmSelectedResourceDeletion(dialog.selections)}>删除</button></div></>}
        {dialog.kind === "copy-resource-to-package" && <><h2>复制“{dialog.name}”到资源包</h2>
          <p>复制后是独立资源，修改副本不会影响原资源。有关联的切换形态时会一起复制。</p>
          <div className="conflict-choices">{workspaces.filter((workspace) => workspace.key !== dialog.sourceWorkspaceKey).map((workspace) =>
            <button type="button" key={workspace.key} onClick={() => copyResourceIntoWorkspace(dialog.sourceWorkspaceKey, dialog.resourceId, workspace.key)}>{workspace.document.package.name}</button>)}</div>
          {workspaces.length <= 1 && <p>当前没有其他资源包，可以在下面直接新建。</p>}
          <Field className="dialog-field" label="新资源包名称" value={copyPackageName} onChange={setCopyPackageName} />
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" disabled={!copyPackageName.trim()} onClick={() => void copyResourceIntoNewWorkspace(dialog.sourceWorkspaceKey, dialog.resourceId)}>新建并复制</button></div></>}
        {dialog.kind === "close-workspace" && <><h2>移到回收站</h2><p>{dialog.name}</p>
          <div className="dialog-actions"><button type="button" disabled={Boolean(creatorOperation)} onClick={() => setDialog(null)}>取消</button><button type="button" className="danger" disabled={Boolean(creatorOperation)} onClick={() => void closeWorkspacePackage(dialog.workspaceKey)}>{creatorOperation === "trash-workspace" ? <OperationStatus label="正在移到回收站…" /> : "移到回收站"}</button></div></>}
        {dialog.kind === "new-tabletop" && <><h2>新建桌面</h2><Field className="dialog-field" label="名称" value={tabletopNameDraft} onChange={setTabletopNameDraft} />
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" disabled={!tabletopNameDraft.trim()} onClick={createTabletopFromDialog}>创建</button></div></>}
        {dialog.kind === "rename-tabletop" && <><h2>重命名桌面</h2><Field className="dialog-field" label="名称" value={tabletopNameDraft} onChange={setTabletopNameDraft} />
          <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" disabled={!tabletopNameDraft.trim()} onClick={() => renameTabletopFromDialog(dialog.tabletopId)}>保存</button></div></>}
        {dialog.kind === "delete-tabletop" && <><h2>{tabletopSync.get(dialog.tabletopId)?.scope === "cloud" ? "移到回收站" : "删除桌面"}</h2><p>{dialog.name}</p>
          <div className="dialog-actions"><button type="button" disabled={Boolean(creatorOperation)} onClick={() => setDialog(null)}>取消</button><button type="button" className="danger" disabled={Boolean(creatorOperation)} onClick={() => void deleteTabletop(dialog.tabletopId)}>{creatorOperation === "trash-tabletop" ? <OperationStatus label="正在移到回收站…" /> : "移到回收站"}</button></div></>}
        {dialog.kind === "tabletop-import-conflict" && <><h2>已有同一个桌面</h2><p>“{dialog.incoming.document.name}”的编号与现有桌面相同。请选择怎么处理。</p>
          {creatorOperation === "import-tabletop" && <OperationStatus label="正在写入桌面…" size="regular" />}
          <div className="conflict-choices"><button type="button" disabled={Boolean(creatorOperation)} onClick={() => setDialog(null)}>取消，不改数据</button>
            <button type="button" disabled={Boolean(creatorOperation)} onClick={() => void commitTabletopImport(dialog.incoming, "copy")}>保留两份</button>
            <button type="button" className="danger" disabled={Boolean(creatorOperation)} onClick={() => void commitTabletopImport(dialog.incoming, "replace")}>覆盖现有桌面</button></div></>}
        {dialog.kind === "sync-document" && <><h2>同步到云端</h2><p>{dialog.name}</p><p>同步前只保存在此浏览器，不等于云备份。同步后仍是同一个项目和编号。</p>
          <div className="cloud-document-kind">{dialog.documentKind === "creator-workspace" ? "资源工作区" : "GM 桌面"}</div>
          <div className="dialog-actions"><button type="button" disabled={Boolean(creatorOperation)} onClick={() => setDialog(null)}>取消</button><button type="button" className="primary" disabled={Boolean(creatorOperation)} onClick={() => void confirmCloudSync(dialog.documentKind, dialog.documentId)}>{creatorOperation === "cloud-sync" ? <OperationStatus label="正在同步云端…" /> : "同步"}</button></div></>}
        {dialog.kind === "cloud-conflict" && <><h2>云端版本有更新</h2><p>{dialog.name}</p>
          {creatorOperation === "cloud-conflict" && <OperationStatus label="正在处理云端版本…" size="regular" />}
          <div className="conflict-choices cloud-conflict-actions">
            <button type="button" className="primary" disabled={Boolean(creatorOperation)} onClick={() => void resolveCloudConflict(dialog.documentKind, dialog.documentId, "cloud")}>保留云端</button>
            <button type="button" disabled={Boolean(creatorOperation)} onClick={() => void resolveCloudConflict(dialog.documentKind, dialog.documentId, "aside")}>本地另存</button>
            <button type="button" className="danger" disabled={Boolean(creatorOperation)} onClick={() => void resolveCloudConflict(dialog.documentKind, dialog.documentId, "local")}>用本地覆盖</button>
          </div></>}
      </section></div>}
    </main>
  );
}
