import { useEffect, useRef, useState } from "react";
import { exportCharacterData, type CharacterData } from "../../domain/characterData";
import { createCardTableLayout, type CardLayoutSnapshotEntry, type CardTableLayout } from "../../domain/cardEngine";
import type { SystemPackage } from "../../domain/systemPackage";
import type { ValidationIssue } from "../../domain/validationRunner";
import { printablePages } from "../pagePresentation";
import { waitForTextFits } from "../textFit";
import type { PendingCharacterExport } from "../CharacterExportDialog";
import { useRuntimeStore } from "../../store/runtimeStore";
import { buildOutputFileName, sanitizeFileName } from "./outputFileName";

export type OutputKind = "json" | "html" | "print" | "long-screenshot";
type PreparedOutputMode = "print" | "long-screenshot";

interface SheetOutputOptions {
  currentPackage: SystemPackage | null;
  characterData: CharacterData | null;
  activeCharacterSaveName: string;
  cardTableCardWidths: Record<string, number>;
  tidyCardTable: (tableModuleId: string, layout: CardTableLayout) => void;
  runValidationChecks: () => Promise<void>;
  runPreOutputValidation: () => Promise<ValidationIssue[]>;
}

function downloadText(text: string, fileName: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function readCardTableSurfaceWidth(moduleId: string): number {
  const moduleElement = [...document.querySelectorAll<HTMLElement>(".card-table-module")].find((element) => element.dataset.moduleId === moduleId);
  return moduleElement?.querySelector<HTMLElement>(".card-table-surface")?.clientWidth ?? 800;
}

export function useSheetOutput({
  currentPackage,
  characterData,
  activeCharacterSaveName,
  cardTableCardWidths,
  tidyCardTable,
  runValidationChecks,
  runPreOutputValidation,
}: SheetOutputOptions) {
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [pendingOutput, setPendingOutput] = useState<OutputKind | null>(null);
  const [preparedOutputMode, setPreparedOutputMode] = useState<PreparedOutputMode | null>(null);
  const [pendingExternalExport, setPendingExternalExport] = useState<PendingCharacterExport | null>(null);
  const cardLayoutSnapshotRef = useRef<Array<{ tableModuleId: string; cards: CardLayoutSnapshotEntry[] }> | null>(null);
  const titleBeforePrintRef = useRef<string | null>(null);

  const restoreDocumentTitle = () => {
    if (titleBeforePrintRef.current === null) return;
    document.title = titleBeforePrintRef.current;
    titleBeforePrintRef.current = null;
  };

  useEffect(() => {
    const finishPrinting = () => {
      restoreDocumentTitle();
      setPreparedOutputMode((current) => current === "print" ? null : current);
    };
    window.addEventListener("afterprint", finishPrinting);
    return () => {
      window.removeEventListener("afterprint", finishPrinting);
      restoreDocumentTitle();
    };
  }, []);

  useEffect(() => {
    if (preparedOutputMode !== null) return;
    const snapshot = cardLayoutSnapshotRef.current;
    if (!snapshot) return;
    cardLayoutSnapshotRef.current = null;
    for (const table of snapshot) {
      if (table.cards.length === 0) continue;
      useRuntimeStore.getState().restoreCardTableLayout(table.tableModuleId, table.cards);
    }
  }, [preparedOutputMode]);

  const preparePrintableContent = async (tidyCardsForOutput = true, mode: PreparedOutputMode = "print") => {
    if (!currentPackage) return false;
    if (printablePages(currentPackage.pages, useRuntimeStore.getState().pageVisibility).length === 0) {
      useRuntimeStore.setState({ importNotice: "当前没有可打印页面。" });
      return false;
    }

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setPreparedOutputMode(mode);
    await nextFrame();
    await nextFrame();

    if (tidyCardsForOutput) {
      const characterData = useRuntimeStore.getState().characterData;
      cardLayoutSnapshotRef.current = currentPackage.modules
        .filter((module) => module.类型 === "cardTable")
        .map((module) => ({
          tableModuleId: module.ID,
          cards: (characterData?.cards.instances ?? [])
            .filter((instance) => instance.tableModuleId === module.ID)
            .map((instance) => ({
              instanceId: instance.instanceId,
              xPct: instance.xPct,
              yPct: instance.yPct,
              zIndex: instance.zIndex,
              rotation: instance.rotation,
            })),
        }));
      for (const module of currentPackage.modules) {
        if (module.类型 !== "cardTable") continue;
        const cardCount = characterData?.cards.instances.filter((instance) => instance.tableModuleId === module.ID).length ?? 0;
        tidyCardTable(
          module.ID,
          createCardTableLayout({
            surfaceWidthPx: readCardTableSurfaceWidth(module.ID),
            cardCount,
            preferredCardWidthPx: cardTableCardWidths[module.ID],
          }),
        );
      }
    }
    await nextFrame();
    await waitForTextFits(document.querySelector(".sheet-tool") ?? document);
    return true;
  };

  const performOutput = async (kind: OutputKind, printableContentPrepared = false) => {
    if (!characterData) return;
    const baseName = sanitizeFileName(activeCharacterSaveName);

    if (kind === "json") {
      downloadText(exportCharacterData(characterData), buildOutputFileName(activeCharacterSaveName, ".json"), "application/json");
      return;
    }

    if (!printableContentPrepared && !(await preparePrintableContent())) return;
    const printableRoot = document.querySelector(".sheet-tool");
    if (kind === "html") {
      const { buildReadonlyHtmlSnapshot, waitForVisibleImages } = await import("../../export/output");
      try {
        await waitForVisibleImages(printableRoot ?? document);
        downloadText(await buildReadonlyHtmlSnapshot(characterData, printableRoot ?? undefined, activeCharacterSaveName), buildOutputFileName(activeCharacterSaveName, ".html"), "text/html");
      } finally {
        setPreparedOutputMode(null);
      }
      return;
    }

    if (kind === "long-screenshot") return;

    if (!printableRoot) {
      setPreparedOutputMode(null);
      return;
    }
    try {
      const { waitForVisibleImages } = await import("../../export/output");
      await waitForVisibleImages(printableRoot);
      titleBeforePrintRef.current ??= document.title;
      document.title = baseName;
      window.print();
    } catch (error) {
      restoreDocumentTitle();
      setPreparedOutputMode(null);
      throw error;
    }
  };

  const beginOutput = async (kind: OutputKind) => {
    let frameworkIssues: ValidationIssue[] = [];
    let printableContentPrepared = false;
    if (kind !== "json") {
      printableContentPrepared = await preparePrintableContent(true, kind === "long-screenshot" ? "long-screenshot" : "print");
      if (!printableContentPrepared) return;
      const { collectFrameworkValidationIssues } = await import("../frameworkChecks");
      frameworkIssues = collectFrameworkValidationIssues(document.querySelector(".sheet-tool") ?? document);
    }
    const issues = [...frameworkIssues, ...(await runPreOutputValidation())];
    useRuntimeStore.setState({ validationIssues: issues });
    if (issues.length > 0) {
      setPendingOutput(kind);
      setValidationDialogOpen(true);
      return;
    }
    await performOutput(kind, printableContentPrepared);
  };

  const exportWithCharacterAdapter = async (adapterId: string) => {
    if (!characterData || !currentPackage) return;
    const adapter = currentPackage.characterFormatAdapters?.find((candidate) => candidate.ID === adapterId);
    if (!adapter?.exportScriptContent) return;
    const { exportExternalCharacterData } = await import("../../domain/characterFormatAdapter");
    const result = await exportExternalCharacterData(characterData, adapter, currentPackage);
    if ("error" in result) {
      useRuntimeStore.setState({ importError: result.error.text });
      return;
    }
    const { report } = result;
    const fileName = buildOutputFileName(activeCharacterSaveName, adapter.导出文件后缀, adapter.名称);
    if (report.skippedFields + report.skippedCards + report.skippedImages > 0) {
      setPendingExternalExport({ conversion: result, fileName });
      return;
    }
    downloadText(`${JSON.stringify(result.document, null, 2)}\n`, fileName, "application/json");
  };

  const exportCharacterText = async (exportId: string) => {
    if (!characterData || !currentPackage) return;
    const definition = currentPackage.characterTextExports?.find((candidate) => candidate.ID === exportId);
    if (!definition) return;
    const { formatCharacterTextExport } = await import("../../domain/characterTextFormatter");
    try {
      await navigator.clipboard.writeText(formatCharacterTextExport(definition, characterData));
      useRuntimeStore.setState({ importError: null, importNotice: `${definition.名称}已复制。` });
    } catch {
      useRuntimeStore.setState({ importError: `${definition.名称}复制失败，请检查浏览器剪贴板权限。`, importNotice: null });
    }
  };

  const handleValidation = async () => {
    let frameworkIssues: ValidationIssue[] = [];
    if (await preparePrintableContent(false)) {
      const { collectFrameworkValidationIssues } = await import("../frameworkChecks");
      frameworkIssues = collectFrameworkValidationIssues(document.querySelector(".sheet-tool") ?? document);
      setPreparedOutputMode(null);
    }
    await runValidationChecks();
    useRuntimeStore.setState({ validationIssues: [...frameworkIssues, ...useRuntimeStore.getState().validationIssues] });
    setValidationDialogOpen(true);
  };

  const closeValidationDialog = () => {
    if (pendingOutput) setPreparedOutputMode(null);
    setPendingOutput(null);
    setValidationDialogOpen(false);
  };

  const continuePendingOutput = pendingOutput
    ? () => {
        const output = pendingOutput;
        setPendingOutput(null);
        setValidationDialogOpen(false);
        void performOutput(output, output !== "json");
      }
    : undefined;

  const confirmExternalExport = () => {
    if (!pendingExternalExport) return;
    downloadText(`${JSON.stringify(pendingExternalExport.conversion.document, null, 2)}\n`, pendingExternalExport.fileName, "application/json");
    setPendingExternalExport(null);
  };

  return {
    printMode: preparedOutputMode !== null,
    longScreenshotMode: preparedOutputMode === "long-screenshot",
    validationDialogOpen,
    pendingExternalExport,
    beginOutput,
    exportCharacterText,
    exportWithCharacterAdapter,
    handleValidation,
    closeValidationDialog,
    continuePendingOutput,
    exitLongScreenshotMode: () => setPreparedOutputMode((current) => current === "long-screenshot" ? null : current),
    cancelExternalExport: () => setPendingExternalExport(null),
    confirmExternalExport,
  };
}
