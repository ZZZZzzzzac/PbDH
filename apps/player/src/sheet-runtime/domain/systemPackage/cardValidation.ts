import { z } from "zod";
import { getCardPresentationFields } from "../cardPresentation";
import { cardPresentationSchema } from "./contract";
import { findCardTableResourceLibrarySource, getResourcePickerLinks } from "./htmlTemplate";
import type { ValidationContext } from "./validationContext";

export function collectCardValidationIssues(context: ValidationContext): void {
  const { systemPackage, issues, moduleById, assetRefs, usedAssetRefs } = context;
  // --- Card creation references ---

  for (const module of systemPackage.modules) {
    if (module.类型 !== "resourcePicker" || !module.创建卡牌) {
      continue;
    }

    const targetModule = moduleById.get(module.创建卡牌.卡牌桌面模块ID);
    if (!targetModule) {
      issues.push({
        level: "error",
        code: "MISSING_CARD_TABLE_REFERENCE",
        text: `Resource Picker 创建卡牌引用了不存在的 Card Table：${module.创建卡牌.卡牌桌面模块ID}`,
        path: `modules.${module.ID}.创建卡牌.卡牌桌面模块ID`,
      });
      continue;
    }

    if (targetModule.类型 !== "cardTable") {
      issues.push({
        level: "error",
        code: "UNSUPPORTED_CARD_TABLE_REFERENCE",
        text: `Resource Picker 创建卡牌目标必须是 Card Table：${module.创建卡牌.卡牌桌面模块ID}`,
        path: `modules.${module.ID}.创建卡牌.卡牌桌面模块ID`,
      });
      continue;
    }

    const hasSourceMismatch = module.资源库 === "其他"
      ? !targetModule.资源来源.some((source) => source.类型 === "otherResourceLibraries")
      : getResourcePickerLinks(module).some((link) => !targetModule.资源来源.some((source) => source.类型 === "resourceLibrary" && source.ID === link.ID));
    if (hasSourceMismatch) {
      issues.push({
        level: "error",
        code: "CARD_TABLE_LIBRARY_MISMATCH",
        text: `Resource Picker 的 Resource Library 不在 Card Table 的资源来源中：${module.ID}`,
        path: `modules.${module.ID}.创建卡牌.卡牌桌面模块ID`,
      });
    }
    if (module.创建卡牌.默认状态 && targetModule.状态选项 && !targetModule.状态选项.includes(module.创建卡牌.默认状态)) {
      issues.push({
        level: "error",
        code: "CARD_DEFAULT_STATE_UNKNOWN",
        text: `Resource Picker 默认状态不在目标 Card Table 的状态选项中：${module.创建卡牌.默认状态}`,
        path: `modules.${module.ID}.创建卡牌.默认状态`,
      });
    }
  }

  for (const module of systemPackage.modules) {
    if (module.类型 !== "resourceComposer" || !module.创建卡牌) continue;
    const targetModule = moduleById.get(module.创建卡牌.卡牌桌面模块ID);
    if (!targetModule) {
      issues.push({ level: "error", code: "MISSING_CARD_TABLE_REFERENCE", text: `Resource Composer 创建卡牌引用了不存在的 Card Table：${module.创建卡牌.卡牌桌面模块ID}`, path: `modules.${module.ID}.创建卡牌.卡牌桌面模块ID` });
      continue;
    }
    if (targetModule.类型 !== "cardTable") {
      issues.push({ level: "error", code: "UNSUPPORTED_CARD_TABLE_REFERENCE", text: `Resource Composer 创建卡牌目标必须是 Card Table：${module.创建卡牌.卡牌桌面模块ID}`, path: `modules.${module.ID}.创建卡牌.卡牌桌面模块ID` });
      continue;
    }
    if (!targetModule.资源来源.some((source) => source.类型 === "resourceComposer" && source.ID === module.ID)) {
      issues.push({ level: "error", code: "CARD_TABLE_COMPOSER_MISMATCH", text: `Resource Composer 不在 Card Table 的资源来源中：${module.ID}`, path: `modules.${module.ID}.创建卡牌.卡牌桌面模块ID` });
    }
    if (module.创建卡牌.默认状态 && targetModule.状态选项 && !targetModule.状态选项.includes(module.创建卡牌.默认状态)) {
      issues.push({ level: "error", code: "CARD_DEFAULT_STATE_UNKNOWN", text: `Resource Composer 默认状态不在目标 Card Table 的状态选项中：${module.创建卡牌.默认状态}`, path: `modules.${module.ID}.创建卡牌.默认状态` });
    }
  }

  // --- Card art & reverse references + unused assets ---
  const cardArtFieldsByLibrary = new Map<string, Set<string>>();
  const cardPresentationsByLibrary = new Map<string, Array<{ moduleId: string; presentation?: z.infer<typeof cardPresentationSchema> }>>();
  for (const module of systemPackage.modules) {
    if (module.类型 !== "cardTable") {
      continue;
    }
    for (const source of module.资源来源.filter((candidate) => candidate.类型 === "resourceLibrary")) {
      const libraryId = source.ID;
      const artField = module.卡图字段 ?? "卡图";
      const artFields = cardArtFieldsByLibrary.get(libraryId) ?? new Set<string>();
      artFields.add(artField);
      artFields.add(module.卡背字段 ?? "卡背");
      cardArtFieldsByLibrary.set(libraryId, artFields);

      const presentations = cardPresentationsByLibrary.get(libraryId) ?? [];
      presentations.push({ moduleId: module.ID, presentation: source.卡牌展示 });
      cardPresentationsByLibrary.set(libraryId, presentations);
    }
    for (const source of module.资源来源.filter((candidate) => candidate.类型 === "resourceComposer")) {
      const composer = systemPackage.modules.find((candidate) => candidate.类型 === "resourceComposer" && candidate.ID === source.ID);
      if (composer?.类型 !== "resourceComposer") continue;
      for (const outputField of [module.卡图字段 ?? "卡图", module.卡背字段 ?? "卡背"]) {
        const mapping = composer.输出字段.find((candidate) => candidate.字段 === outputField);
        const slot = mapping ? composer.来源槽位.find((candidate) => candidate.ID === mapping.来源槽位ID) : undefined;
        if (!mapping || !slot) continue;
        const artFields = cardArtFieldsByLibrary.get(slot.资源库ID) ?? new Set<string>();
        artFields.add(mapping.来源字段);
        cardArtFieldsByLibrary.set(slot.资源库ID, artFields);
      }
    }
  }

  for (const library of systemPackage.resourceLibraries ?? []) {
    for (const { moduleId, presentation } of cardPresentationsByLibrary.get(library.ID) ?? []) {
      for (const field of library.entries.length > 0 ? getCardPresentationFields(presentation) : []) {
        if (library.fields.some((candidate) => candidate.key === field)) continue;
        issues.push({
          level: "error",
          code: "MISSING_RESOURCE_FIELD_REFERENCE",
          text: `Card Presentation 引用了不存在的 Resource 字段：${field}`,
          path: `modules.${moduleId}.资源来源`,
          evidence: [{ label: "requiredField", value: field }, { label: "resourceLibraryId", value: library.ID }],
        });
      }
    }

    for (const module of systemPackage.modules) {
      if (module.类型 !== "cardTable" || !findCardTableResourceLibrarySource(systemPackage, module, library.ID)) {
        continue;
      }
      const reverseIdField = module.背面卡牌ID字段 ?? "背面卡牌ID";
      const definitionsById = new Map(library.entries.map((entry) => [entry.ID, entry]));
      library.entries.forEach((entry, entryIndex) => {
        const reverseId = (entry.fields[reverseIdField] ?? "").trim();
        if (!reverseId) {
          return;
        }
        if (reverseId === entry.ID) {
          issues.push({
            level: "error",
            code: "CARD_REVERSE_DEFINITION_SELF_REFERENCE",
            text: `Card Definition 的背面不能引用自身：${entry.ID}`,
            path: `resourceLibraries.${library.ID}.entries.${entryIndex}.${reverseIdField}`,
          });
        } else if (!definitionsById.has(reverseId)) {
          issues.push({
            level: "error",
            code: "MISSING_CARD_REVERSE_DEFINITION_REFERENCE",
            text: `Card Definition 引用了不存在的背面 Card Definition：${reverseId}`,
            path: `resourceLibraries.${library.ID}.entries.${entryIndex}.${reverseIdField}`,
          });
        }
      });
    }

    const artFields = cardArtFieldsByLibrary.get(library.ID);
    if (!artFields || artFields.size === 0) {
      continue;
    }

    library.entries.forEach((entry, entryIndex) => {
      for (const artField of artFields) {
        const cardArtRef = entry.fields[artField];
        if (cardArtRef) {
          usedAssetRefs.add(cardArtRef);
        }
        if (!cardArtRef || assetRefs.has(cardArtRef)) {
          continue;
        }

        issues.push({
          level: "error",
          code: "MISSING_CARD_ART_ASSET_REFERENCE",
          text: `Card Definition 引用了不存在的卡图 Asset：${cardArtRef}`,
          path: `resourceLibraries.${library.ID}.entries.${entryIndex}.${artField}`,
        });
      }
    });
  }

}
