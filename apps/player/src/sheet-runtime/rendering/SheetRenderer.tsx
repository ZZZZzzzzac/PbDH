import { createElement, useEffect, useRef, useState, type ReactNode } from "react";
import type { SystemPackage } from "../domain/systemPackage";
import { allowedHtmlTags, findModule } from "../domain/systemPackage";
import type { SheetValue } from "../domain/characterData";
import { useRuntimeStore } from "../store/runtimeStore";
import { RenderSheetModule } from "./moduleRegistry";
import { printablePages, resolveCurrentPageId, runtimeVisiblePages } from "./pagePresentation";

interface SheetRendererProps {
  systemPackage: SystemPackage;
  outputMode?: boolean;
  requestedPageId?: string | null;
}

const allowedTemplateAttributes = new Set(["alt", "aria-label", "class", "colspan", "rowspan", "src", "title"]);
const reactAttributeNames = new Map([
  ["class", "className"],
  ["colspan", "colSpan"],
  ["rowspan", "rowSpan"],
]);

function renderTemplateNode(systemPackage: SystemPackage, node: ChildNode, key: string, moduleVisibility: Record<string, boolean>, assetUrls: Record<string, string>, pageOutlet?: ReactNode): ReactNode {
  if (node.nodeType === 3) {
    return node.textContent;
  }

  if (node.nodeType !== 1) {
    return null;
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  if (tagName === "pb-module") {
    return renderModulePlaceholder(systemPackage, element.getAttribute("id"), key, moduleVisibility);
  }
  if (tagName === "pb-page-outlet") return <div className="page-outlet" key={key}>{pageOutlet}</div>;

  if (!allowedHtmlTags.has(tagName)) {
    return null;
  }

  const props = templateElementProps(element, assetUrls);
  const children = [...element.childNodes].map((child, index) => renderTemplateNode(systemPackage, child, `${key}-${index}`, moduleVisibility, assetUrls, pageOutlet));

  return createTemplateElement(tagName, key, props, children);
}

function renderModulePlaceholder(systemPackage: SystemPackage, moduleId: string | null, key: string, moduleVisibility: Record<string, boolean>) {
  if (!moduleId) {
    return null;
  }

  const module = findModule(systemPackage, moduleId);
  if (!module) {
    return null;
  }
  if (!isRuntimeVisible(module.默认隐藏, moduleVisibility[module.ID])) {
    return null;
  }

  return (
    <div className="module-slot" data-module-slot-id={module.ID} data-module-slot-type={module.类型} key={key}>
      <RenderSheetModule module={module} systemPackage={systemPackage} />
    </div>
  );
}

function templateElementProps(element: Element, assetUrls: Record<string, string>) {
  const props: Record<string, string> = {};

  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    if (name.startsWith("on")) {
      continue;
    }
    if (name.startsWith("data-") || allowedTemplateAttributes.has(name)) {
      props[reactAttributeNames.get(name) ?? name] = name === "src" ? assetUrls[attribute.value] ?? attribute.value : attribute.value;
    }
  }

  return props;
}

function createTemplateElement(tagName: string, key: string, props: Record<string, string>, children: ReactNode[]) {
  return createElement(tagName, { key, ...props }, ...children);
}

const templateCache = new Map<string, Document>();

function renderHtmlTemplate(systemPackage: SystemPackage, html: string, moduleVisibility: Record<string, boolean>, assetUrls: Record<string, string>, pageOutlet?: ReactNode) {
  let document = templateCache.get(html);
  if (!document) {
    document = new DOMParser().parseFromString(html, "text/html");
    if (templateCache.size > 20) templateCache.clear();
    templateCache.set(html, document);
  }
  return [...document.body.childNodes].map((node, index) => renderTemplateNode(systemPackage, node, String(index), moduleVisibility, assetUrls, pageOutlet));
}

function scopeTemplateCss(pageId: string, css: string | undefined, assetUrls: Record<string, string>): string {
  if (!css) {
    return "";
  }

  const scope = `[data-template-page-id="${cssStringEscape(pageId)}"]`;
  return scopeCssBlock(resolveTemplateCssAssets(css, assetUrls), scope);
}

function scopeSkinCss(systemPackage: SystemPackage, skinId: string | null, assetUrls: Record<string, string>): string {
  const skin = activeSkin(systemPackage, skinId);
  if (!skin) return "";
  const scope = `[data-system-package-id="${cssStringEscape(systemPackage.manifest.ID)}"]`;
  return scopeCssBlock(resolveTemplateCssAssets(skin.cssContent, assetUrls), scope);
}

function activeSkin(systemPackage: SystemPackage, skinId: string | null) {
  return systemPackage.skins?.find((candidate) => candidate.ID === skinId)
    ?? systemPackage.skins?.find((candidate) => candidate.ID === systemPackage.defaultSkin);
}

function effectivePageHtml(systemPackage: SystemPackage, skinId: string | null, pageId: string, baseHtml: string): string {
  return activeSkin(systemPackage, skinId)?.layoutOverrides?.pages?.find((page) => page.ID === pageId)?.htmlContent ?? baseHtml;
}

function effectiveShellHtml(systemPackage: SystemPackage, skinId: string | null): string | undefined {
  if (!systemPackage.shell) return undefined;
  return activeSkin(systemPackage, skinId)?.layoutOverrides?.shell?.htmlContent ?? systemPackage.shell.htmlContent;
}

function resolveTemplateCssAssets(css: string, assetUrls: Record<string, string>): string {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/giu, (match, quote: string, path: string) => {
    const url = assetUrls[path];
    return url ? `url(${quote}${url}${quote})` : match;
  });
}

function scopeCssBlock(css: string, scope: string): string {
  let result = "";
  let cursor = 0;

  while (cursor < css.length) {
    const openIndex = css.indexOf("{", cursor);
    if (openIndex === -1) {
      result += css.slice(cursor);
      break;
    }

    const selector = css.slice(cursor, openIndex).trim();
    const closeIndex = findMatchingBrace(css, openIndex);
    if (closeIndex === -1) {
      result += css.slice(cursor);
      break;
    }

    const body = css.slice(openIndex + 1, closeIndex);
    if (/^@(media|supports|container|layer)\b/i.test(selector)) {
      result += `${selector} {${scopeCssBlock(body, scope)}}`;
    } else if (selector && !selector.startsWith("@")) {
      result += `${scopeSelectors(selector, scope)} {${body}}`;
    }

    cursor = closeIndex + 1;
  }

  return result;
}

function findMatchingBrace(css: string, openIndex: number): number {
  let depth = 0;

  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === "{") {
      depth += 1;
    }
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function scopeSelectors(selectors: string, scope: string): string {
  return splitCssSelectors(selectors)
    .map((selector) => {
      const trimmed = selector.trim();
      return trimmed.includes(":scope") ? trimmed.replaceAll(":scope", scope) : `${scope} ${trimmed}`;
    })
    .join(", ");
}

function splitCssSelectors(selectors: string): string[] {
  const result: string[] = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let index = 0; index < selectors.length; index += 1) {
    const char = selectors[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") parentheses += 1;
    else if (char === ")") parentheses = Math.max(0, parentheses - 1);
    else if (char === "[") brackets += 1;
    else if (char === "]") brackets = Math.max(0, brackets - 1);
    else if (char === "," && parentheses === 0 && brackets === 0) {
      result.push(selectors.slice(start, index));
      start = index + 1;
    }
  }
  result.push(selectors.slice(start));
  return result;
}

function cssStringEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

export function SheetRenderer({ systemPackage, outputMode = false, requestedPageId }: SheetRendererProps) {
  const pageVisibility = useRuntimeStore((state) => state.pageVisibility);
  const moduleVisibility = useRuntimeStore((state) => state.moduleVisibility);
  const packageAssetUrls = useRuntimeStore((state) => state.packageAssetUrls);
  const selectedSkinId = useRuntimeStore((state) => state.selectedSkinId);
  const characterValues = useRuntimeStore((state) => state.characterData?.character.values);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const visiblePages = runtimeVisiblePages(systemPackage.pages, pageVisibility);
  const requestedVisiblePageId = requestedPageId && visiblePages.some((page) => page.ID === requestedPageId) ? requestedPageId : null;
  const resolvedCurrentPageId = requestedVisiblePageId ?? resolveCurrentPageId(visiblePages, currentPageId);
  const renderedPages = outputMode ? printablePages(systemPackage.pages, pageVisibility) : visiblePages.filter((page) => page.ID === resolvedCurrentPageId);
  const skinCss = scopeSkinCss(systemPackage, selectedSkinId, packageAssetUrls);
  const resolvedSkinId = activeSkin(systemPackage, selectedSkinId)?.ID;
  useEffect(() => setCurrentPageId(null), [systemPackage.manifest.ID, systemPackage.manifest.版本]);
  useEffect(() => { if (currentPageId !== resolvedCurrentPageId) setCurrentPageId(resolvedCurrentPageId); }, [currentPageId, resolvedCurrentPageId]);

  const outlet = <>
    {!outputMode && visiblePages.length > 1 ? <nav className="page-navigation" aria-label="页面导航">{visiblePages.map((page) => <button type="button" className={page.ID === resolvedCurrentPageId ? "active" : undefined} aria-current={page.ID === resolvedCurrentPageId ? "page" : undefined} onClick={() => setCurrentPageId(page.ID)} key={page.ID}>{page.名称}</button>)}</nav> : null}
    {!outputMode && visiblePages.length === 0 ? <p className="empty-page-state">当前没有可见页面。</p> : null}
    {renderedPages.map((page) =>
      (
          <article className="sheet-page" data-template-page-id={page.ID} key={page.ID}>
            <style>{scopeTemplateCss(page.ID, page.layout.cssContent, packageAssetUrls)}</style>
            {renderHtmlTemplate(systemPackage, effectivePageHtml(systemPackage, selectedSkinId, page.ID, page.layout.htmlContent), moduleVisibility, packageAssetUrls)}
          </article>
      ),
    )}
  </>;
  return (
    <main
      className="sheet-tool"
      aria-label="Sheet Tool"
      data-system-package-id={systemPackage.manifest.ID}
      data-countable-print-strategy={outputMode ? "clear-uniform-squares" : undefined}
      {...sheetValueDataAttributes(systemPackage, characterValues)}
    >
      {systemPackage.shell ? <div className="sheet-shell" data-template-shell="true"><style>{scopeCssBlock(resolveTemplateCssAssets(systemPackage.shell.cssContent ?? "", packageAssetUrls), '[data-template-shell="true"]')}</style>{renderHtmlTemplate(systemPackage, effectiveShellHtml(systemPackage, selectedSkinId)!, moduleVisibility, packageAssetUrls, outlet)}</div> : outlet}
      {skinCss ? <style data-system-package-skin={resolvedSkinId}>{skinCss}</style> : null}
    </main>
  );
}

/**
 * 将 freeText 模块的当前文本值暴露为 Sheet 根元素的 `data-value-<模块ID>` 属性,
 * 供 System Package Skin 以 `:scope[data-value-...]` 做条件化装饰(如按主领域切换卡牌桌面纹章)。
 * 模块 ID 统一转小写;空值不输出属性。
 */
function sheetValueDataAttributes(systemPackage: SystemPackage, values: Record<string, SheetValue> | undefined): Record<string, string> {
  if (!values) return {};
  const attributes: Record<string, string> = {};
  for (const module of systemPackage.modules) {
    if (module.类型 !== "freeText") continue;
    const value = values[module.ID];
    if (typeof value === "string" && value.trim()) {
      attributes[`data-value-${module.ID.toLowerCase()}`] = value.trim();
    }
  }
  return attributes;
}

function isRuntimeVisible(defaultHidden: boolean | undefined, runtimeVisible: boolean | undefined): boolean {
  return runtimeVisible ?? !defaultHidden;
}
