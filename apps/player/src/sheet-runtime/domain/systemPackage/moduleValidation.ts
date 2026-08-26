import { getCardPresentationFields } from "../cardPresentation";
import { findResourceLibrary } from "./htmlTemplate";
import type { ValidationContext } from "./validationContext";
import { collectDuplicateIdIssues, validateResourceLibraryField } from "./validationHelpers";

export function collectModuleValidationIssues(context: ValidationContext): void {
  const { systemPackage, issues, assetRefs, usedAssetRefs, moduleIds } = context;
  // --- Module field references ---
  for (const module of systemPackage.modules) {
    if (module.类型 === "readOnlyDisplay" && !module.内容 && !module.资源路径) {
      issues.push({
        level: "error",
        code: "DISPLAY_CONTENT_MISSING",
        text: "ReadOnly Display 需要 内容 或 资源路径。",
        path: `modules.${module.ID}.内容`,
      });
    }

    if (module.类型 === "readOnlyDisplay" && module.资源路径 && !assetRefs.has(module.资源路径)) {
      issues.push({
        level: "error",
        code: "MISSING_ASSET_REFERENCE",
        text: `ReadOnly Display 引用了不存在的图片：${module.资源路径}`,
        path: `modules.${module.ID}.资源路径`,
      });
    }

    if (module.类型 === "resourcePicker" && module.资源库 !== "其他") {
      module.资源库.forEach((link, linkIndex) => {
        if (findResourceLibrary(systemPackage, link.ID)) return;
        issues.push({
          level: "error",
          code: "MISSING_RESOURCE_LIBRARY_REFERENCE",
          text: `Resource Picker 引用了不存在的 Resource Library：${link.ID}`,
          path: `modules.${module.ID}.资源库.${linkIndex}.ID`,
        });
      });
    }
    if (module.类型 === "readOnlyDisplay" && module.资源路径) {
      usedAssetRefs.add(module.资源路径);
    }

    if (module.类型 === "countableResource" && module.显示方式 === "标记") {
      for (const [field, marker] of [
        ["当前值标记", module.当前值标记],
        ["剩余值标记", module.剩余值标记],
      ] as const) {
        if (marker?.类型 !== "图片") continue;
        usedAssetRefs.add(marker.资源路径);
        if (!assetRefs.has(marker.资源路径)) {
          issues.push({
            level: "error",
            code: "MISSING_ASSET_REFERENCE",
            text: `Countable Resource 图片标记引用了不存在的图片：${marker.资源路径}`,
            path: `modules.${module.ID}.${field}.资源路径`,
          });
        }
      }
    }

    if (module.类型 === "resourceComposer") {
      const slotById = new Map(module.来源槽位.map((slot) => [slot.ID, slot]));
      module.来源槽位.forEach((slot, slotIndex) => {
        if (findResourceLibrary(systemPackage, slot.资源库ID)) return;
        issues.push({
          level: "error",
          code: "MISSING_RESOURCE_LIBRARY_REFERENCE",
          text: `Resource Composer 引用了不存在的 Resource Library：${slot.资源库ID}`,
          path: `modules.${module.ID}.来源槽位.${slotIndex}.资源库ID`,
        });
      });
      module.输出字段.forEach((mapping, mappingIndex) => {
        const slot = slotById.get(mapping.来源槽位ID);
        if (!slot) {
          issues.push({
            level: "error",
            code: "MISSING_RESOURCE_COMPOSER_SLOT_REFERENCE",
            text: `Resource Composer 输出字段引用了不存在的来源槽位：${mapping.来源槽位ID}`,
            path: `modules.${module.ID}.输出字段.${mappingIndex}.来源槽位ID`,
          });
          return;
        }
        validateResourceLibraryField(findResourceLibrary(systemPackage, slot.资源库ID), mapping.来源字段, `modules.${module.ID}.输出字段.${mappingIndex}.来源字段`, module.ID, module.ID, issues);
      });
      if (module.选择关系输出 && module.输出字段.some((mapping) => mapping.字段 === module.选择关系输出?.字段)) {
        issues.push({
          level: "error",
          code: "DUPLICATE_RESOURCE_COMPOSER_OUTPUT_FIELD",
          text: `Resource Composer 的选择关系输出字段与普通输出字段重复：${module.选择关系输出.字段}`,
          path: `modules.${module.ID}.选择关系输出.字段`,
        });
      }
    }

    if (module.类型 === "cardTable") {
      module.资源来源.forEach((source, sourceIndex) => {
        const exists = source.类型 === "resourceLibrary"
          ? Boolean(findResourceLibrary(systemPackage, source.ID))
          : source.类型 === "resourceComposer"
            ? systemPackage.modules.some((candidate) => candidate.类型 === "resourceComposer" && candidate.ID === source.ID)
            : systemPackage.modules.some((candidate) => candidate.类型 === "resourcePicker" && candidate.资源库 === "其他");
        if (!exists) {
          issues.push({
            level: "error",
            code: source.类型 === "resourceLibrary" ? "MISSING_RESOURCE_LIBRARY_REFERENCE" : source.类型 === "resourceComposer" ? "MISSING_RESOURCE_COMPOSER_REFERENCE" : "MISSING_OTHER_RESOURCES_PICKER_REFERENCE",
            text: `Card Table 引用了不存在的 ${source.类型}：${source.ID}`,
            path: `modules.${module.ID}.资源来源.${sourceIndex}.ID`,
          });
        }
        if (source.类型 === "resourceComposer" && source.卡牌展示) {
          const composer = systemPackage.modules.find((candidate) => candidate.类型 === "resourceComposer" && candidate.ID === source.ID);
          const knownFields = new Set([
            "ID",
            ...(composer?.类型 === "resourceComposer" ? composer.输出字段.map((mapping) => mapping.字段) : []),
            ...(composer?.类型 === "resourceComposer" && composer.选择关系输出 ? [composer.选择关系输出.字段] : []),
          ]);
          for (const field of getCardPresentationFields(source.卡牌展示)) {
            if (knownFields.has(field)) continue;
            issues.push({
              level: "error",
              code: "MISSING_RESOURCE_FIELD_REFERENCE",
              text: `Card Presentation 引用了 Resource Composer 中不存在的输出字段：${field}`,
              path: `modules.${module.ID}.资源来源.${sourceIndex}.卡牌展示`,
              evidence: [{ label: "referencedField", value: field }, { label: "knownFields", value: [...knownFields] }],
            });
          }
        }
      });
      const stateOptions = module.状态选项 ?? [];
      for (const state of Object.keys(module.状态外观 ?? {})) {
        if (!stateOptions.includes(state)) {
          issues.push({
            level: "error",
            code: "CARD_STATE_PRESENTATION_UNKNOWN_STATE",
            text: `Card state 外观引用了状态选项中不存在的 state：${state}`,
            path: `modules.${module.ID}.状态外观.${state}`,
          });
        }
      }
    }
    if (module.类型 === "checkboxResource") {
      collectDuplicateIdIssues(module.选项, "Checkbox Resource option", "DUPLICATE_CHECKBOX_OPTION_ID", `modules.${module.ID}.选项`, issues);
    }
  }

  // --- Module ID uniqueness & Other Picker ---

  for (const module of systemPackage.modules) {
    if (moduleIds.has(module.ID)) {
      issues.push({
        level: "error",
        code: "DUPLICATE_MODULE_ID",
        text: `Sheet Module ID 重复：${module.ID}`,
        path: `modules.${module.ID}`,
      });
    }
    moduleIds.add(module.ID);
  }

  const otherResourcePickers = systemPackage.modules.filter((module) => module.类型 === "resourcePicker" && module.资源库 === "其他");
  otherResourcePickers.slice(1).forEach((module) => issues.push({
    level: "error",
    code: "DUPLICATE_OTHER_RESOURCE_PICKER",
    text: "一个 System Package 最多声明一个 Other Resources Picker。",
    path: `modules.${module.ID}.资源库`,
  }));

}
