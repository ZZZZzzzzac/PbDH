import { frameworkSchemaVersion } from "./contract";
import { collectTemplateImageReferences, validateSkinLayoutOverrides, validateTemplateCss } from "./htmlTemplate";
import type { ValidationContext } from "./validationContext";
import { collectDuplicateIdIssues } from "./validationHelpers";

export function collectBaseValidationIssues(context: ValidationContext): void {
  const { systemPackage, issues, assetRefs, usedAssetRefs } = context;
  collectDuplicateIdIssues(systemPackage.pages, "Page", "DUPLICATE_PAGE_ID", "pages", issues);
  collectDuplicateIdIssues(systemPackage.skins ?? [], "Skin", "DUPLICATE_SKIN_ID", "skins", issues);
  collectDuplicateIdIssues(
    systemPackage.validationChecks ?? [],
    "Validation Check",
    "DUPLICATE_VALIDATION_CHECK_ID",
    "validationChecks",
    issues,
  );
  collectDuplicateIdIssues(systemPackage.resourceFormatAdapters ?? [], "Resource Format Adapter", "DUPLICATE_RESOURCE_FORMAT_ADAPTER_ID", "resourceFormatAdapters", issues);
  collectDuplicateIdIssues(systemPackage.characterFormatAdapters ?? [], "Character Format Adapter", "DUPLICATE_CHARACTER_FORMAT_ADAPTER_ID", "characterFormatAdapters", issues);
  collectDuplicateIdIssues(systemPackage.characterTextExports ?? [], "Character Text Export", "DUPLICATE_CHARACTER_TEXT_EXPORT_ID", "characterTextExports", issues);

  if (systemPackage.manifest.schemaVersion !== frameworkSchemaVersion) {
    issues.push({
      level: "warning",
      code: "SCHEMA_VERSION_MISMATCH",
      text: `System Package schemaVersion ${systemPackage.manifest.schemaVersion} 与框架当前版本 ${frameworkSchemaVersion} 不一致,可能存在兼容问题。`,
      path: "manifest.schemaVersion",
    });
  }

  // --- Skins ---
  if (systemPackage.skins?.length) {
    if (!systemPackage.defaultSkin || !systemPackage.skins.some((skin) => skin.ID === systemPackage.defaultSkin)) {
      issues.push({
        level: "error",
        code: "MISSING_DEFAULT_SKIN_REFERENCE",
        text: `默认 Skin 不存在：${systemPackage.defaultSkin ?? "未声明"}`,
        path: "defaultSkin",
      });
    }

    for (const skin of systemPackage.skins) {
      const path = `skins.${skin.ID}.css`;
      issues.push(...validateTemplateCss(skin.cssContent, path));
      collectTemplateImageReferences("", skin.cssContent).forEach((assetPath) => {
        usedAssetRefs.add(assetPath);
        if (!assetRefs.has(assetPath)) {
          issues.push({
            level: "error",
            code: "MISSING_TEMPLATE_IMAGE_REFERENCE",
            text: `System Package Skin 引用了不存在的图片：${assetPath}`,
            path,
          });
        }
      });
      validateSkinLayoutOverrides(systemPackage, skin, assetRefs, usedAssetRefs, issues);
    }
  } else if (systemPackage.defaultSkin) {
    issues.push({
      level: "error",
      code: "MISSING_DEFAULT_SKIN_REFERENCE",
      text: `默认 Skin 不存在：${systemPackage.defaultSkin}`,
      path: "defaultSkin",
    });
  }

}
