import type { ResourceLibrary } from "../resourceLibrary";
import type {
  CardTableModule,
  CardTableResourceSource,
  PackageAsset,
  PackageIssue,
  ResourcePickerModule,
  SheetModule,
  SystemPackage,
  SystemPackageSkin,
} from "./contract";

export function findModule(systemPackage: SystemPackage, moduleId: string): SheetModule | undefined {
  return systemPackage.modules.find((module) => module.ID === moduleId);
}

export function findAsset(systemPackage: SystemPackage, assetPath: string): PackageAsset | undefined {
  return systemPackage.assets?.find((asset) => asset.路径 === assetPath);
}

export function findResourceLibrary(systemPackage: SystemPackage, libraryId: string): ResourceLibrary | undefined {
  return systemPackage.resourceLibraries?.find((library) => library.ID === libraryId);
}

export function getResourcePickerLinks(module: ResourcePickerModule) {
  return module.资源库 === "其他" ? [] : module.资源库;
}

export function getOtherResourceLibraries(systemPackage: SystemPackage): ResourceLibrary[] {
  const linked = new Set<string>();
  for (const module of systemPackage.modules) {
    if (module.类型 === "resourcePicker") {
      for (const link of getResourcePickerLinks(module)) linked.add(link.ID);
    } else if (module.类型 === "resourceComposer") {
      for (const slot of module.来源槽位) linked.add(slot.资源库ID);
    }
  }
  return (systemPackage.resourceLibraries ?? []).filter((library) =>
    library.路径.startsWith("resource-extension:") && !linked.has(library.ID));
}

export function findCardTableResourceLibrarySource(
  systemPackage: SystemPackage,
  module: CardTableModule,
  libraryId: string,
): CardTableResourceSource | undefined {
  const explicit = module.资源来源.find((source) => source.类型 === "resourceLibrary" && source.ID === libraryId);
  if (explicit) return explicit;
  if (!getOtherResourceLibraries(systemPackage).some((library) => library.ID === libraryId)) return undefined;
  return module.资源来源.find((source) => source.类型 === "otherResourceLibraries");
}

export function getHtmlTemplateModuleReferences(html: string): string[] {
  const matches = html.matchAll(/<pb-module\b[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>/gi);
  return [...matches].map((match) => match[1]);
}

export function collectTemplateImageReferences(html: string, css: string | undefined): string[] {
  const references = new Set<string>();
  for (const match of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/giu)) {
    if (isPackageImageReference(match[1])) references.add(match[1]);
  }
  for (const match of (css ?? "").matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/giu)) {
    if (isPackageImageReference(match[1])) references.add(match[1]);
  }
  return [...references];
}

function isPackageImageReference(value: string): boolean {
  return !isExternalResourceReference(value) && /\.(?:png|jpe?g|webp|gif|avif|svg)$/iu.test(value);
}

export function validateSkinLayoutOverrides(
  systemPackage: SystemPackage,
  skin: SystemPackageSkin,
  assetRefs: Set<string>,
  usedAssetRefs: Set<string>,
  issues: PackageIssue[],
): void {
  const overrides = skin.layoutOverrides;
  if (!overrides) return;

  const moduleIds = new Set(systemPackage.modules.map((module) => module.ID));
  const pageById = new Map(systemPackage.pages.map((page) => [page.ID, page]));
  const seenPageIds = new Set<string>();

  for (const override of overrides.pages ?? []) {
    const path = `skins.${skin.ID}.layoutOverrides.pages.${override.ID}.html`;
    if (seenPageIds.has(override.ID)) {
      issues.push({ level: "error", code: "DUPLICATE_SKIN_LAYOUT_OVERRIDE_PAGE_ID", text: `Skin Page override ID 重复：${override.ID}`, path });
      continue;
    }
    seenPageIds.add(override.ID);
    const basePage = pageById.get(override.ID);
    if (!basePage) {
      issues.push({ level: "error", code: "SKIN_LAYOUT_OVERRIDE_PAGE_UNKNOWN", text: `Skin 引用了不存在的 Page：${override.ID}`, path: `skins.${skin.ID}.layoutOverrides.pages.${override.ID}.ID` });
      continue;
    }
    issues.push(...validateHtmlTemplate(override.htmlContent, path));
    validateOverrideModuleOwnership(basePage.layout.htmlContent, override.htmlContent, path, issues);
    validateOverrideModuleReferences(override.htmlContent, moduleIds, path, issues);
    if (printPageMarkerCount(override.htmlContent) !== printPageMarkerCount(basePage.layout.htmlContent)) {
      issues.push({ level: "error", code: "SKIN_LAYOUT_PRINT_PAGE_MISMATCH", text: "Skin Page override 不能改变 data-print-page 页面数量。", path });
    }
    collectTemplateImageReferences(override.htmlContent, undefined).forEach((assetPath) => {
      usedAssetRefs.add(assetPath);
      if (!assetRefs.has(assetPath)) issues.push({ level: "error", code: "MISSING_TEMPLATE_IMAGE_REFERENCE", text: `Skin HTML override 引用了不存在的图片：${assetPath}`, path });
    });
  }

  if (overrides.shell) {
    const path = `skins.${skin.ID}.layoutOverrides.shell.html`;
    if (!systemPackage.shell) {
      issues.push({ level: "error", code: "SKIN_LAYOUT_OVERRIDE_SHELL_MISSING_BASE", text: "没有 Base Sheet Shell 时不能声明 Skin Shell override。", path });
    } else {
      issues.push(...validateHtmlTemplate(overrides.shell.htmlContent, path));
      validateOverrideModuleOwnership(systemPackage.shell.htmlContent, overrides.shell.htmlContent, path, issues);
      validateOverrideModuleReferences(overrides.shell.htmlContent, moduleIds, path, issues);
      const outletCount = (overrides.shell.htmlContent.match(/<pb-page-outlet\b/gi) ?? []).length;
      if (outletCount !== 1) issues.push({ level: "error", code: "SHELL_PAGE_OUTLET_COUNT_INVALID", text: "Skin Sheet Shell override 必须且只能包含一个 pb-page-outlet。", path });
      if (printPageMarkerCount(overrides.shell.htmlContent) !== printPageMarkerCount(systemPackage.shell.htmlContent)) {
        issues.push({ level: "error", code: "SKIN_LAYOUT_PRINT_PAGE_MISMATCH", text: "Skin Sheet Shell override 不能改变 data-print-page 页面数量。", path });
      }
      collectTemplateImageReferences(overrides.shell.htmlContent, undefined).forEach((assetPath) => {
        usedAssetRefs.add(assetPath);
        if (!assetRefs.has(assetPath)) issues.push({ level: "error", code: "MISSING_TEMPLATE_IMAGE_REFERENCE", text: `Skin Shell override 引用了不存在的图片：${assetPath}`, path });
      });
    }
  }

  const effectiveRegions = new Set<string>();
  let duplicateRegion = false;
  const pageOverrides = new Map((overrides.pages ?? []).map((override) => [override.ID, override.htmlContent]));
  const effectiveHtml = systemPackage.pages.map((page) => pageOverrides.get(page.ID) ?? page.layout.htmlContent);
  if (systemPackage.shell) effectiveHtml.push(overrides.shell?.htmlContent ?? systemPackage.shell.htmlContent);
  for (const html of effectiveHtml) {
    for (const regionId of getHtmlTemplateGuideRegionIds(html)) {
      if (effectiveRegions.has(regionId)) duplicateRegion = true;
      effectiveRegions.add(regionId);
    }
  }
  if (duplicateRegion) issues.push({ level: "error", code: "DUPLICATE_GUIDE_REGION_ID", text: `Skin ${skin.ID} 的有效 Layout Region ID 必须全包唯一。`, path: `skins.${skin.ID}.layoutOverrides` });
  for (const [stepIndex, step] of (systemPackage.characterCreationGuide?.步骤 ?? []).entries()) {
    if (step.目标?.类型 === "region" && !effectiveRegions.has(step.目标.区域ID)) {
      issues.push({ level: "error", code: "MISSING_GUIDE_TARGET_REGION", text: `Skin ${skin.ID} 缺少 Guide Layout Region：${step.目标.区域ID}`, path: `characterCreationGuide.步骤.${stepIndex}.目标.区域ID` });
    }
  }
}

function validateOverrideModuleOwnership(baseHtml: string, overrideHtml: string, path: string, issues: PackageIssue[]): void {
  const baseIds = getHtmlTemplateModuleReferences(baseHtml).sort();
  const overrideIds = getHtmlTemplateModuleReferences(overrideHtml).sort();
  if (baseIds.length !== overrideIds.length || baseIds.some((id, index) => id !== overrideIds[index])) {
    issues.push({ level: "error", code: "SKIN_LAYOUT_MODULE_OWNERSHIP_MISMATCH", text: "Skin HTML override 必须保留 Base Layout 的完整 Sheet Module 集合。", path });
  }
}

function validateOverrideModuleReferences(html: string, moduleIds: Set<string>, path: string, issues: PackageIssue[]): void {
  for (const moduleId of getHtmlTemplateModuleReferences(html)) {
    if (!moduleIds.has(moduleId)) issues.push({ level: "error", code: "MISSING_MODULE_REFERENCE", text: `Skin HTML override 引用了不存在的 Sheet Module：${moduleId}`, path });
  }
}

function printPageMarkerCount(html: string): number {
  return (html.match(/\bdata-print-page\s*=\s*["']true["']/gi) ?? []).length;
}

export function getHtmlTemplateGuideRegionIds(html: string): string[] {
  const matches = html.matchAll(/<[a-z][a-z0-9-]*\b[^>]*\bdata-guide-region-id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi);
  return [...matches].map((match) => match[1] ?? match[2] ?? match[3]);
}

export const forbiddenHtmlTags = new Set(["button", "form", "input", "script", "select", "textarea"]);
export const allowedGlobalHtmlAttributes = new Set(["aria-label", "class", "title"]);
export const allowedHtmlAttributesByTag = new Map([
  ["img", new Set(["alt", "src"])],
  ["pb-module", new Set(["id"])],
  ["pb-page-outlet", new Set()],
  ["td", new Set(["colspan", "rowspan"])],
  ["th", new Set(["colspan", "rowspan"])],
]);
export const allowedHtmlTags = new Set([
  "article",
  "div",
  "em",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "img",
  "li",
  "main",
  "ol",
  "p",
  "pb-module",
  "pb-page-outlet",
  "section",
  "small",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

export function validateHtmlTemplate(html: string, path: string): PackageIssue[] {
  const issues: PackageIssue[] = [];
  const tagMatches = html.matchAll(/<\/?\s*([a-z][a-z0-9-]*)\b([^>]*)>/gi);

  for (const match of tagMatches) {
    if (match[0].startsWith("</")) {
      continue;
    }

    const tagName = match[1].toLowerCase();
    const attributes = (match[2] ?? "").replace(/\/\s*$/, "");

    if (forbiddenHtmlTags.has(tagName)) {
      issues.push({
        level: "error",
        code: "HTML_TEMPLATE_FORBIDDEN_TAG",
        text: `HTML Layout Template 禁止使用交互或脚本标签：${tagName}`,
        path,
      });
      continue;
    }

    if (!allowedHtmlTags.has(tagName)) {
      issues.push({
        level: "error",
        code: "HTML_TEMPLATE_UNSUPPORTED_TAG",
        text: `HTML Layout Template 不支持标签：${tagName}`,
        path,
      });
    }

    if (/\son[a-z]+\s*=/i.test(attributes)) {
      issues.push({
        level: "error",
        code: "HTML_TEMPLATE_FORBIDDEN_EVENT_HANDLER",
        text: `HTML Layout Template 禁止事件属性：${tagName}`,
        path,
      });
    }

    const attributeIssues = validateHtmlTemplateAttributes(tagName, attributes, path);
    issues.push(...attributeIssues);
  }

  return issues;
}

function validateHtmlTemplateAttributes(tagName: string, attributes: string, path: string): PackageIssue[] {
  const issues: PackageIssue[] = [];
  const tagAttributes = allowedHtmlAttributesByTag.get(tagName);
  const attributeMatches = attributes.matchAll(/\s+([^\s"'=<>`]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g);
  let moduleId: string | undefined;

  for (const match of attributeMatches) {
    const attributeName = match[1].toLowerCase();
    const attributeValue = match[2]?.replace(/^["']|["']$/g, "");

    if (tagName === "pb-module" && attributeName === "id") {
      moduleId = attributeValue;
    }

    if (attributeName === "data-guide-region-id" && !attributeValue?.trim()) {
      issues.push({
        level: "error",
        code: "GUIDE_REGION_ID_EMPTY",
        text: "HTML Layout Template 的 data-guide-region-id 不能为空。",
        path,
      });
    }

    const isAllowedAttribute =
      tagAttributes?.has(attributeName) || (tagName !== "pb-module" && (attributeName.startsWith("data-") || allowedGlobalHtmlAttributes.has(attributeName)));

    if (isAllowedAttribute) {
      if (tagName === "img" && attributeName === "src" && attributeValue && isExternalResourceReference(attributeValue)) {
        issues.push({
          level: "error",
          code: "HTML_TEMPLATE_EXTERNAL_RESOURCE",
          text: `HTML Layout Template 禁止外部资源：${attributeValue}`,
          path,
        });
      }
      continue;
    }

    issues.push({
      level: "error",
      code: "HTML_TEMPLATE_UNSUPPORTED_ATTRIBUTE",
      text: `HTML Layout Template 不支持属性：${tagName}.${attributeName}`,
      path,
    });
  }

  if (tagName === "pb-module" && !moduleId) {
    issues.push({
      level: "error",
      code: "HTML_TEMPLATE_MODULE_ID_MISSING",
      text: "HTML Layout Template 的 pb-module 缺少 id 属性。",
      path,
    });
  }

  return issues;
}

export function validateTemplateCss(css: string | undefined, path: string): PackageIssue[] {
  if (!css) {
    return [];
  }

  const issues: PackageIssue[] = [];

  if (/@import\b/i.test(css)) {
    issues.push({
      level: "error",
      code: "CSS_TEMPLATE_IMPORT_FORBIDDEN",
      text: "HTML Layout Template CSS 禁止 @import。",
      path,
    });
  }

  if (/@font-face\b/i.test(css)) {
    issues.push({
      level: "error",
      code: "CSS_TEMPLATE_FONT_FACE_FORBIDDEN",
      text: "HTML Layout Template 与 Skin CSS 禁止 @font-face。",
      path,
    });
  }

  const urlMatches = css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi);
  for (const match of urlMatches) {
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();

    if (isExternalResourceReference(value)) {
      issues.push({
        level: "error",
        code: "CSS_TEMPLATE_EXTERNAL_RESOURCE",
        text: `HTML Layout Template CSS 禁止外部资源：${value}`,
        path,
      });
    }
  }

  return issues;
}

function isExternalResourceReference(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//") || value.startsWith("/");
}
