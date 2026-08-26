import type { StateCreator } from "zustand";
import type { ImageAdmissionSelection } from "@pbdh/media-admission";
import type { CardLayoutSnapshotEntry, CardTableLayout } from "../domain/cardEngine";
import type {
  CheckboxState,
  CharacterConversionReport,
  CharacterData,
  SheetValue,
} from "../domain/characterData";
import type { EffectiveResourceCatalog } from "../domain/effectiveResourceCatalog";
import type { GeneratedResourceId, ResourceExtension, ResourceExtensionIssue } from "../domain/resourceExtension";
import type { ResourceComposerSelections } from "../domain/resourceComposer";
import type { ResourceLibraryEntry, ResourceLibraryQuery } from "../domain/resourceLibrary";
import type { PackageIssue, SystemPackage } from "../domain/systemPackage";
import type { ValidationIssue } from "../domain/validationRunner";
import type { RuntimePackageAsset } from "../loaders/assetResolver";
import type { PackageDirectoryHandle } from "../loaders/packageVfs";
import type { PackageLoadResult } from "../loaders/systemPackageLoader";
import type { PresetLoadProgress, PresetSystemPackage } from "../loaders/presetSystemPackageLoader";
import type { NormalizedResourceExtensionArtifact, ResourceExtensionFileLoadResult } from "../loaders/resourceExtensionLoader";
import type { CharacterSaveSummary, RuntimeStorage } from "../storage/runtimeStorage";
import type { runValidationChecks } from "../domain/validationRunner";

export type BootStatus = "idle" | "loading" | "ready" | "error";
export type StorageStatus = "idle" | "saving" | "saved" | "error";
export type ValidationStatus = "idle" | "running" | "complete";
export type FrameworkColorSchemePreference = "follow-skin" | "light" | "dark";

export interface RuntimeDependencies {
  loadSystemPackageFromFile: (file: Blob) => Promise<PackageLoadResult>;
  loadSystemPackageFromDirectory: (files: Iterable<File>) => Promise<PackageLoadResult>;
  loadSystemPackageFromDirectoryHandle: (handle: PackageDirectoryHandle) => Promise<PackageLoadResult>;
  loadPresetSystemPackage: (preset: PresetSystemPackage, onProgress?: (progress: PresetLoadProgress) => void) => Promise<PackageLoadResult>;
  loadPreviewDirectoryHandle: () => Promise<PackageDirectoryHandle | null>;
  savePreviewDirectoryHandle: (handle: PackageDirectoryHandle) => Promise<void>;
  storage: RuntimeStorage;
  runValidationChecks: typeof runValidationChecks;
}

export type ResourceExtensionImportState =
  | { status: "success"; extensionId: string; contributionCount: number; entryCount: number; generatedIds: GeneratedResourceId[]; normalizedArtifact: NormalizedResourceExtensionArtifact; issues: ResourceExtensionIssue[] }
  | { status: "error"; issues: ResourceExtensionIssue[] };

export interface ResourceExtensionDifference {
  libraryId: string;
  added: number;
  removed: number;
  retained: number;
}

export interface PendingResourceExtensionReplacement {
  extension: ResourceExtension;
  assets: RuntimePackageAsset[];
  generatedIds: GeneratedResourceId[];
  normalizedArtifact: NormalizedResourceExtensionArtifact;
  issues: ResourceExtensionIssue[];
  differences: ResourceExtensionDifference[];
  previousImageCount: number;
  nextImageCount: number;
}

export interface PendingResourceExtensionRemoval {
  extensionId: string;
  extensionName: string;
  libraries: Array<{ libraryId: string; entryCount: number }>;
  imageCount: number;
  staleReferenceCount: number;
}

export interface PendingResourceExtensionConversion {
  loaded: Extract<ResourceExtensionFileLoadResult, { ok: true }>;
}

export interface PendingResourceFormatSelection {
  file: Blob;
  adapters: Array<{ ID: string; 名称: string }>;
}

export interface PendingCharacterConversion {
  sourceName: string;
  data: CharacterData;
  suggestedSaveName?: string;
  successNotice: string;
  report: CharacterConversionReport;
}

export interface PendingCharacterFormatSelection {
  text: string;
  fileName: string;
  adapters: Array<{ ID: string; 名称: string }>;
}

export interface PendingQuestionnaireResult {
  questionnaireId: string;
  questionnaireName: string;
  packageId: string;
  characterId: string;
  baseUpdatedAt: string;
  selections: Array<{
    sourceModuleId: string;
    pickerLabel: string;
    libraryId: string;
    libraryName: string;
    entries: Array<{ id: string; name: string }>;
  }>;
  missingResources: Array<{
    sourceModuleId: string;
    pickerLabel: string;
    libraryId: string;
    libraryName: string;
    entryId: string;
  }>;
  nextCharacterData: CharacterData;
}

export interface PackageSlice {
  basePackage: SystemPackage | null;
  currentPackage: SystemPackage | null;
  selectedSkinId: string | null;
  frameworkColorSchemePreference: FrameworkColorSchemePreference;
  packageAssetUrls: Record<string, string>;
  packageIssues: PackageIssue[];
  bootStatus: BootStatus;
  packageLoadProgress: PresetLoadProgress | null;
  packageLoadingPresentation: NonNullable<PresetSystemPackage["loadingPresentation"]> | null;
  storageStatus: StorageStatus;
  importError: string | null;
  importNotice: string | null;
  authorPreviewActive: boolean;
  initialize: (presets?: PresetSystemPackage[]) => Promise<void>;
  uploadSystemPackageFromFile: (file: Blob) => Promise<void>;
  uploadSystemPackageFromDirectory: (files: Iterable<File>) => Promise<void>;
  switchToPresetSystemPackage: (preset: PresetSystemPackage, forceReload?: boolean) => Promise<void>;
  selectSystemPackageSkin: (skinId: string) => void;
  setFrameworkColorSchemePreference: (preference: FrameworkColorSchemePreference) => void;
  enterAuthorPreview: (handle: PackageDirectoryHandle) => Promise<void>;
  exitAuthorPreview: () => void;
  clearImportMessage: () => void;
}

export interface ResourceExtensionSlice {
  resourceCatalog: EffectiveResourceCatalog | null;
  installedResourceExtensions: ResourceExtension[];
  resourceExtensionImport: ResourceExtensionImportState | null;
  pendingResourceExtensionReplacement: PendingResourceExtensionReplacement | null;
  pendingResourceExtensionConversion: PendingResourceExtensionConversion | null;
  pendingResourceFormatSelection: PendingResourceFormatSelection | null;
  pendingResourceExtensionRemoval: PendingResourceExtensionRemoval | null;
  resourceReferenceIssues: ResourceExtensionIssue[];
  uploadResourceExtensionFromFile: (file: Blob) => Promise<void>;
  selectResourceFormatAdapter: (adapterId: string) => Promise<void>;
  confirmResourceExtensionConversion: () => Promise<void>;
  cancelResourceExtensionConversion: () => void;
  confirmResourceExtensionReplacement: () => Promise<void>;
  cancelResourceExtensionReplacement: () => void;
  requestResourceExtensionRemoval: (extensionId: string) => void;
  confirmResourceExtensionRemoval: () => Promise<void>;
  cancelResourceExtensionRemoval: () => void;
}

export interface CharacterSlice {
  characterData: CharacterData | null;
  characterSaves: CharacterSaveSummary[];
  activeCharacterSaveId: string | null;
  derivedReadOnlyDisplayContent: Record<string, string>;
  derivedTextPlaceholders: Record<string, string>;
  moduleVisibility: Record<string, boolean>;
  pageVisibility: Record<string, boolean>;
  resourcePickerDefaultQueries: Record<string, ResourceLibraryQuery>;
  createCharacterSave: (name?: string) => Promise<void>;
  switchCharacterSave: (saveId: string) => Promise<void>;
  renameCharacterSave: (saveId: string, name: string) => Promise<void>;
  duplicateCharacterSave: (saveId: string, name?: string) => Promise<void>;
  deleteCharacterSave: (saveId: string) => Promise<void>;
  updateModuleValue: (moduleId: string, value: SheetValue) => void;
  commitFreeTextChange: (moduleId: string, value: string) => void;
  commitResourceSelection: (moduleId: string, libraryId: string, entries: ResourceLibraryEntry[]) => void;
  commitResourceComposition: (moduleId: string, selections: ResourceComposerSelections) => void;
  commitCheckboxChange: (moduleId: string, optionId: string, checked: boolean, checkboxState: CheckboxState) => void;
  uploadPlayerImage: (moduleId: string, file: File, selection?: ImageAdmissionSelection) => Promise<void>;
  removePlayerImage: (moduleId: string) => Promise<void>;
}

export interface QuestionnaireSlice {
  pendingQuestionnaireResult: PendingQuestionnaireResult | null;
  prepareQuestionnaireResult: (questionnaireId: string, input: unknown) => void;
  confirmQuestionnaireResult: () => void;
  cancelQuestionnaireResult: () => void;
}

export interface CardSlice {
  cardTableCardWidths: Record<string, number>;
  cardTableSurfaceHeights: Record<string, number>;
  pendingCardTablePlacements: Record<string, string[]>;
  updateCardInstancePosition: (instanceId: string, xPct: number, yPct: number) => void;
  bringCardInstanceToFront: (instanceId: string) => void;
  updateCardInstanceState: (instanceId: string, cardState: string) => void;
  flipCardInstance: (instanceId: string) => void;
  rotateCardInstance: (instanceId: string, quarterTurns: number) => void;
  setCardInstanceUpright: (instanceId: string) => void;
  addCardIndicator: (instanceId: string) => void;
  transitionCardIndicator: (instanceId: string, indicatorId: string, direction: "increment" | "decrement") => void;
  tidyCardTable: (tableModuleId: string, layout: CardTableLayout) => void;
  restoreCardTableLayout: (tableModuleId: string, snapshot: CardLayoutSnapshotEntry[]) => void;
  placePendingCardInstances: (tableModuleId: string, layout: CardTableLayout) => void;
  setCardTableCardWidth: (tableModuleId: string, widthPx: number) => void;
  setCardTableSurfaceHeight: (tableModuleId: string, heightPx: number | null) => void;
  deleteCardInstance: (instanceId: string) => void;
}

export interface ValidationSlice {
  validationIssues: ValidationIssue[];
  validationStatus: ValidationStatus;
  runValidationChecks: () => Promise<void>;
  runPreOutputValidation: () => Promise<ValidationIssue[]>;
}

export interface CharacterImportSlice {
  pendingCharacterConversion: PendingCharacterConversion | null;
  pendingCharacterFormatSelection: PendingCharacterFormatSelection | null;
  importCharacterDataFromText: (text: string) => Promise<void>;
  importCharacterDataFromFile: (file: File) => Promise<void>;
  selectCharacterFormatAdapter: (adapterId: string) => Promise<void>;
  confirmCharacterConversion: () => Promise<void>;
  cancelCharacterConversion: () => void;
}

export type RuntimeState = PackageSlice
  & ResourceExtensionSlice
  & CharacterSlice
  & QuestionnaireSlice
  & CardSlice
  & ValidationSlice
  & CharacterImportSlice;

export type RuntimeSet = (
  partial: Partial<RuntimeState> | ((state: RuntimeState) => Partial<RuntimeState>),
) => void;
export type RuntimeGet = () => RuntimeState;
export type RuntimeSlice<T> = StateCreator<RuntimeState, [], [], T>;
