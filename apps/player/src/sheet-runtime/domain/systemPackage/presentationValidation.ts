import {
  collectTemplateImageReferences,
  getHtmlTemplateModuleReferences,
  validateHtmlTemplate,
  validateTemplateCss,
} from "./htmlTemplate";
import type { ValidationContext } from "./validationContext";

export function collectPresentationValidationIssues(context: ValidationContext): void {
  const { systemPackage, issues, moduleIds, assetRefs, usedAssetRefs } = context;
  // --- HTML page templates & shell ---
  for (const page of systemPackage.pages) {
    const htmlIssues = validateHtmlTemplate(page.layout.htmlContent, `pages.${page.ID}.layout.html`);
    issues.push(...htmlIssues);
    issues.push(...validateTemplateCss(page.layout.cssContent, `pages.${page.ID}.layout.css`));
    collectTemplateImageReferences(page.layout.htmlContent, page.layout.cssContent).forEach((assetPath) => {
      usedAssetRefs.add(assetPath);
      if (!assetRefs.has(assetPath)) {
        issues.push({
          level: "error",
          code: "MISSING_TEMPLATE_IMAGE_REFERENCE",
          text: `HTML Layout Template 引用了不存在的图片：${assetPath}`,
          path: `pages.${page.ID}.layout.html`,
        });
      }
    });

    for (const moduleId of getHtmlTemplateModuleReferences(page.layout.htmlContent)) {
      if (!moduleIds.has(moduleId)) {
        issues.push({
          level: "error",
          code: "MISSING_MODULE_REFERENCE",
          text: `HTML Layout Template 引用了不存在的 Sheet Module：${moduleId}`,
          path: `pages.${page.ID}.layout.html`,
        });
      }
    }
  }

  if (systemPackage.shell) {
    issues.push(...validateHtmlTemplate(systemPackage.shell.htmlContent, "shell.html"));
    issues.push(...validateTemplateCss(systemPackage.shell.cssContent, "shell.css"));
    collectTemplateImageReferences(systemPackage.shell.htmlContent, systemPackage.shell.cssContent).forEach((assetPath) => {
      usedAssetRefs.add(assetPath);
      if (!assetRefs.has(assetPath)) {
        issues.push({ level: "error", code: "MISSING_TEMPLATE_IMAGE_REFERENCE", text: `Sheet Shell 引用了不存在的图片：${assetPath}`, path: "shell.html" });
      }
    });
    for (const moduleId of getHtmlTemplateModuleReferences(systemPackage.shell.htmlContent)) {
      if (!moduleIds.has(moduleId)) issues.push({ level: "error", code: "MISSING_MODULE_REFERENCE", text: `Sheet Shell 引用了不存在的 Sheet Module：${moduleId}`, path: "shell.html" });
    }
    const outletCount = (systemPackage.shell.htmlContent.match(/<pb-page-outlet\b/gi) ?? []).length;
    if (outletCount !== 1) issues.push({ level: "error", code: "SHELL_PAGE_OUTLET_COUNT_INVALID", text: "Sheet Shell 必须且只能包含一个 pb-page-outlet。", path: "shell.html" });
  }

  // --- Unused asset warnings ---
  for (const assetPath of assetRefs) {
    if (!usedAssetRefs.has(assetPath)) {
      issues.push({
        level: "warning",
        code: "UNUSED_PACKAGE_IMAGE",
        text: `System Package 图片未被引用：${assetPath}`,
        path: assetPath,
      });
    }
  }

}
