import { exportCharacterData, parseCharacterDataJson, type CharacterData, type CharacterImportResult } from "../domain/characterData";
import type { SystemPackage } from "../domain/systemPackage";

const embeddedCharacterDataId = "pbdh-character-data";
const printCardImageCache = new Map<string, Blob>();
const printCardImageCacheLimit = 32;

export async function buildReadonlyHtmlSnapshot(data: CharacterData, printableRoot?: Element, title?: string): Promise<string> {
  const jsonText = exportCharacterData(data);
  const inertJson = jsonText.replace(/</g, "\\u003c");
  const snapshotTitle = htmlEscape(title || readCharacterName(data));
  const printableHtml = printableRoot ? await serializePrintableRoot(printableRoot) : buildFallbackSnapshotBody(data, title);
  const documentStyles = printableRoot ? collectDocumentStyles(printableRoot.ownerDocument) : "";
  const snapshotStyles = buildSnapshotStyles();

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${snapshotTitle}</title>
  <style>${documentStyles}
${snapshotStyles}</style>
</head>
<body class="snapshot-body print-mode">
  <main class="snapshot-shell" aria-label="Read-only Character Snapshot">
    ${printableHtml}
  </main>
  <script id="${embeddedCharacterDataId}" type="application/json">${inertJson}</script>
</body>
</html>`;
}

function buildFallbackSnapshotBody(data: CharacterData, title?: string): string {
  const snapshotTitle = htmlEscape(title || readCharacterName(data));
  const values = Object.entries(data.character.values)
    .map(([key, value]) => `<tr><th>${htmlEscape(key)}</th><td>${htmlEscape(formatSnapshotValue(value))}</td></tr>`)
    .join("");
  const cards = data.cards.instances
    .map((card) => `<li>${htmlEscape(card.definitionRef.type === "resourceLibrary" ? card.definitionRef.entryId : card.definitionRef.compositeResourceId)} <span>${htmlEscape(card.state)}</span></li>`)
    .join("");

  return `
    <h1>${snapshotTitle}</h1>
    <p>${htmlEscape(data.systemPackage.id)} v${htmlEscape(data.systemPackage.version)}</p>
    <table><tbody>${values}</tbody></table>
    <h2>Cards</h2>
    <ul>${cards || "<li>无卡牌</li>"}</ul>`;
}

export function parseCharacterDataText(text: string, currentPackage: SystemPackage): CharacterImportResult {
  if (looksLikeHtml(text)) {
    const extracted = extractEmbeddedCharacterJson(text);
    if (!extracted.ok) {
      return extracted;
    }
    return parseCharacterDataJson(extracted.text, currentPackage);
  }

  return parseCharacterDataJson(text, currentPackage);
}

export function extractEmbeddedCharacterJson(text: string): { ok: true; text: string } | { ok: false; error: string } {
  const match = text.match(new RegExp(`<script\\b[^>]*\\bid=["']${embeddedCharacterDataId}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i"));
  if (!match) {
    return { ok: false, error: "导入失败：HTML snapshot 中没有嵌入的 Character JSON。" };
  }

  return { ok: true, text: htmlUnescape(match[1].trim()) };
}

export async function waitForVisibleImages(root: ParentNode, timeoutMs = 2000): Promise<void> {
  const images = queryIncludingShadowRoots<HTMLImageElement>(root, "img").filter(isVisibleImage);
  if (images.length === 0) {
    return;
  }

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          const timeout = window.setTimeout(done, timeoutMs);
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });

          function done() {
            window.clearTimeout(timeout);
            image.removeEventListener("load", done);
            image.removeEventListener("error", done);
            resolve();
          }
        }),
    ),
  );
}

function isVisibleImage(image: HTMLImageElement): boolean {
  if (image.hidden || image.getAttribute("aria-hidden") === "true") {
    return false;
  }

  if (typeof image.getClientRects === "function" && image.getClientRects().length > 0) {
    return true;
  }

  return image.offsetWidth > 0 || image.offsetHeight > 0;
}

function looksLikeHtml(text: string): boolean {
  return /^\s*(<!doctype html>|<html|<main|<body)/i.test(text);
}

function readCharacterName(data: CharacterData): string {
  return data.character.id;
}

function formatSnapshotValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

async function serializePrintableRoot(root: Element): Promise<string> {
  const clone = root.cloneNode(true) as Element;
  // 车卡外壳上的继承变量在独立文档中也必须保留。
  const computed = getComputedStyle(root);
  for (const property of Array.from(computed)) {
    if (property.startsWith("--")) (clone as HTMLElement).style.setProperty(property, computed.getPropertyValue(property));
  }
  syncFormControls(root, clone);
  await embedImages(root, clone);
  await serializeShadowRoots(root, clone);
  clone.querySelectorAll("[data-output-exclude]").forEach((element) => element.remove());
  stripInteractiveRuntimeState(clone);
  return clone.outerHTML;
}

function queryIncludingShadowRoots<T extends Element>(root: ParentNode, selector: string): T[] {
  const matches = [...root.querySelectorAll<T>(selector)];
  for (const element of root.querySelectorAll("*")) {
    if (element.shadowRoot) matches.push(...queryIncludingShadowRoots<T>(element.shadowRoot, selector));
  }
  return matches;
}

async function serializeShadowRoots(source: ParentNode, clone: ParentNode): Promise<void> {
  const originals = [...source.querySelectorAll("*")];
  const copies = [...clone.querySelectorAll("*")];
  await Promise.all(originals.map(async (element, index) => {
    if (!element.shadowRoot) return;
    const template = document.createElement("template");
    template.setAttribute("shadowrootmode", "open");
    for (const child of element.shadowRoot.childNodes) template.content.append(child.cloneNode(true));
    syncFormControls(element.shadowRoot, template.content);
    await embedImages(element.shadowRoot, template.content);
    await serializeShadowRoots(element.shadowRoot, template.content);
    stripInteractiveRuntimeState(template.content);
    copies[index].prepend(template);
  }));
}

async function embedImages(sourceRoot: ParentNode, cloneRoot: ParentNode, requireInline = false): Promise<void> {
  const sourceImages = sourceRoot.querySelectorAll("img");
  const cloneImages = cloneRoot.querySelectorAll("img");

  await Promise.all([...sourceImages].map(async (sourceImage, index) => {
    const source = sourceImage.currentSrc || sourceImage.src;
    if (source.startsWith("data:") || (!requireInline && !shouldInlineImageUrl(source))) {
      return;
    }

    const cloneImage = cloneImages[index];
    if (!cloneImage) {
      return;
    }

    try {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`无法内联导出图片：${response.status} ${response.statusText}`);
      }

      const mimeType = response.headers.get("Content-Type")?.split(";", 1)[0] || "application/octet-stream";
      const bytes = new Uint8Array(await response.arrayBuffer());
      cloneImage.setAttribute("src", `data:${mimeType};base64,${bytesToBase64(bytes)}`);
      cloneImage.removeAttribute("srcset");
    } catch (error) {
      if (requireInline || source.startsWith("blob:")) {
        throw error;
      }
      // 静态资源（如预制包的相对路径卡图）内联失败时保留原 URL，避免阻断整个导出。
    }
  }));
}

/** 固化已经显示的规范卡面，不重新解释模板数据或改变卡牌存档。 */
export async function buildCardPrintSvg(host: HTMLElement): Promise<{ svg: string; width: number; height: number }> {
  if (!host.shadowRoot) throw new Error("卡面尚未加载完成，请稍后重试打印。");
  const width = host.offsetWidth;
  const height = host.offsetHeight;
  if (width <= 0 || height <= 0) throw new Error("卡面尺寸尚未就绪，请稍后重试打印。");
  const clone = host.cloneNode(false) as HTMLElement;
  clone.setAttribute("data-print-card-root", "");
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  const computed = getComputedStyle(host);
  for (const property of Array.from(computed)) {
    if (property.startsWith("--")) clone.style.setProperty(property, computed.getPropertyValue(property));
  }
  for (const node of host.shadowRoot.childNodes) clone.append(node.cloneNode(true));
  syncFormControls(host.shadowRoot, clone);
  await embedImages(host.shadowRoot, clone, true);
  stripInteractiveRuntimeState(clone);
  clone.querySelectorAll("style").forEach((style) => {
    style.textContent = style.textContent?.replaceAll(":host", "[data-print-card-root]") ?? "";
  });
  const markup = new XMLSerializer().serializeToString(clone);
  return {
    width, height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="${width}" height="${height}">${markup}</foreignObject></svg>`,
  };
}

export async function prepareCardImagesForPrint(root: ParentNode): Promise<() => void> {
  const generated: HTMLImageElement[] = [];
  const urls = new Map<string, string>();
  const dispose = () => {
    for (const image of generated) {
      image.parentElement?.removeAttribute("data-print-card-ready");
      image.remove();
    }
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  };
  try {
    for (const frame of root.querySelectorAll<HTMLElement>(".play-card > [data-pbdh-card-display]")) {
      const host = frame.querySelector<HTMLElement>("[data-pbdh-canonical-surface]");
      if (!host) continue;
      const snapshot = await buildCardPrintSvg(host);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(snapshot.svg));
      const key = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
      let blob = printCardImageCache.get(key);
      if (!blob) {
        const source = new Image();
        source.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshot.svg)}`;
        await source.decode();
        const canvas = document.createElement("canvas");
        // 63 个设计坐标打印为 63mm；每坐标 12px，约 305 DPI。
        const scale = Math.min(12, 8192 / Math.max(snapshot.width, snapshot.height));
        canvas.width = Math.ceil(snapshot.width * scale);
        canvas.height = Math.ceil(snapshot.height * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("浏览器无法生成卡面打印图像。");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          (result) => result ? resolve(result) : reject(new Error("卡面打印图像编码失败。")),
          "image/jpeg", 0.94,
        ));
      }
      printCardImageCache.delete(key);
      printCardImageCache.set(key, blob);
      while (printCardImageCache.size > printCardImageCacheLimit) {
        printCardImageCache.delete(printCardImageCache.keys().next().value!);
      }
      const image = new Image();
      image.className = "player-card-print-image";
      image.alt = host.getAttribute("aria-label") ?? "卡牌";
      let url = urls.get(key);
      if (!url) {
        url = URL.createObjectURL(blob);
        urls.set(key, url);
      }
      image.src = url;
      generated.push(image);
      await image.decode();
      frame.append(image);
      frame.setAttribute("data-print-card-ready", "true");
    }
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}

// 导出后仍可用的 URL 无需内联：data: 已内联，跨域外部图保留原样（离线时才可能失效）。
function shouldInlineImageUrl(source: string): boolean {
  if (source.startsWith("data:")) {
    return false;
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(source)) {
    return true;
  }
  if (source.startsWith("blob:")) {
    return true;
  }
  try {
    return new URL(source).origin === location.origin;
  } catch {
    return false;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function syncFormControls(sourceRoot: ParentNode, cloneRoot: ParentNode) {
  const sourceControls = sourceRoot.querySelectorAll("input, textarea, select");
  const cloneControls = cloneRoot.querySelectorAll("input, textarea, select");

  sourceControls.forEach((source, index) => {
    const clone = cloneControls[index];
    if (!clone) {
      return;
    }

    if (source instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
      clone.textContent = source.value;
      clone.setAttribute("readonly", "");
      return;
    }

    if (source instanceof HTMLSelectElement && clone instanceof HTMLSelectElement) {
      [...clone.options].forEach((option, optionIndex) => {
        option.toggleAttribute("selected", source.options[optionIndex]?.selected ?? false);
      });
      clone.setAttribute("disabled", "");
      return;
    }

    if (source instanceof HTMLInputElement && clone instanceof HTMLInputElement) {
      if (source.type === "checkbox" || source.type === "radio") {
        clone.toggleAttribute("checked", source.checked);
      } else {
        clone.setAttribute("value", source.value);
      }
      clone.setAttribute("readonly", "");
    }
  });
}

function stripInteractiveRuntimeState(clone: ParentNode) {
  clone.querySelectorAll("[data-markdown-editor]").forEach((element) => {
    if (element.getAttribute("data-markdown-empty") !== "true") {
      element.remove();
    }
  });
  clone.querySelectorAll("[data-markdown-preview]").forEach((element) => {
    if (element.getAttribute("data-markdown-empty") === "true") {
      element.remove();
      return;
    }
    element.removeAttribute("hidden");
    element.removeAttribute("aria-hidden");
    element.removeAttribute("role");
    element.removeAttribute("tabindex");
  });
  clone.querySelectorAll("button, input[type='file']").forEach((element) => {
    element.remove();
  });
  clone.querySelectorAll("[contenteditable]").forEach((element) => element.removeAttribute("contenteditable"));
  clone.querySelectorAll("[style]").forEach((element) => {
    const style = element.getAttribute("style");
    if (style) {
      element.setAttribute("style", style);
    }
  });
}

function collectDocumentStyles(sourceDocument: Document): string {
  const chunks: string[] = [];

  for (const styleSheet of [...sourceDocument.styleSheets]) {
    try {
      const rules = [...styleSheet.cssRules].map((rule) => rule.cssText).join("\n");
      if (rules) {
        chunks.push(rules);
      }
    } catch {
      const owner = styleSheet.ownerNode;
      if (owner instanceof HTMLStyleElement) {
        chunks.push(owner.textContent ?? "");
      }
    }
  }

  sourceDocument.querySelectorAll("style").forEach((styleElement) => {
    const text = styleElement.textContent ?? "";
    if (text && !chunks.includes(text)) {
      chunks.push(text);
    }
  });

  return chunks.join("\n");
}

function buildSnapshotStyles(): string {
  return `
body.snapshot-body {
  margin: 0;
  background: #ffffff;
}
.snapshot-shell {
  width: 100%;
  margin: 0;
}
.snapshot-shell button,
.snapshot-shell input,
.snapshot-shell textarea,
.snapshot-shell select {
  pointer-events: none;
}
.snapshot-shell .top-bar,
.snapshot-shell .top-menu-bar,
.snapshot-shell .message,
.snapshot-shell .resource-dialog-backdrop,
.snapshot-shell .validation-dialog-backdrop,
.snapshot-shell .resource-picker-module,
.snapshot-shell .image-actions,
.snapshot-shell .card-table-actions,
.snapshot-shell .play-card-delete {
  display: none !important;
}
.snapshot-shell .sheet-tool {
  padding: 0;
}
.snapshot-shell .sheet-page,
.snapshot-shell [data-print-page="true"] {
  box-sizing: border-box;
  width: 210mm;
  height: 297mm;
  margin: 0 auto 16px;
  padding: 0;
  overflow: hidden;
  background: #ffffff;
}
.snapshot-shell .sheet-page:has([data-module-type="cardTable"]),
.snapshot-shell [data-print-page="true"]:has([data-module-type="cardTable"]) {
  height: auto !important;
  min-height: 297mm !important;
  overflow: visible !important;
}
.snapshot-shell .card-table-surface {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(0, var(--play-card-width)));
  align-items: start;
  align-content: start;
  gap: 4px;
  padding: 0;
  height: auto !important;
  min-height: 0 !important;
  overflow: visible;
  border: 0;
  background: #ffffff;
}
.snapshot-shell .play-card {
  position: relative;
  width: var(--play-card-width) !important;
  left: auto !important;
  top: auto !important;
  z-index: auto !important;
  transform: none !important;
  box-shadow: none !important;
  filter: none !important;
}
.snapshot-shell [data-print-page="true"]:has([data-module-type="cardTable"]) {
  padding: var(--card-table-print-page-padding, 3mm);
}
.snapshot-shell .sheet-page,
.snapshot-shell .module-slot,
.snapshot-shell .container,
.snapshot-shell .play-card {
  break-inside: avoid;
  page-break-inside: avoid;
}
.snapshot-shell .play-card {
  box-shadow: none !important;
  filter: none !important;
}
.snapshot-shell .play-card,
.snapshot-shell .play-card * {
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.snapshot-shell input::placeholder,
.snapshot-shell textarea::placeholder {
  color: #e6e8e9 !important;
  -webkit-text-fill-color: #e6e8e9 !important;
  opacity: 1 !important;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }

  .snapshot-shell input::placeholder,
  .snapshot-shell textarea::placeholder {
    color: #e6e8e9 !important;
    -webkit-text-fill-color: #e6e8e9 !important;
    opacity: 1 !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .snapshot-shell .card-table-surface {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(0, var(--play-card-width)));
    align-items: start;
    align-content: start;
    gap: 4px;
    padding: 0;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible;
    border: 0;
  }
  .snapshot-shell .play-card {
    position: relative;
    width: var(--play-card-width) !important;
    left: auto !important;
    top: auto !important;
    z-index: auto !important;
    transform: none !important;
    box-shadow: none !important;
    filter: none !important;
  }
  .snapshot-shell .play-card,
  .snapshot-shell .play-card * {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .snapshot-shell .sheet-page,
  .snapshot-shell [data-print-page="true"],
  .sheet-page,
  [data-print-page="true"] {
    box-sizing: border-box;
    width: 210mm;
    height: 297mm;
    margin: 0;
    padding: 0;
    overflow: hidden;
    break-after: page;
  }
  .snapshot-shell [data-print-page="true"]:has([data-module-type="cardTable"]),
  [data-print-page="true"]:has([data-module-type="cardTable"]) {
    padding: var(--card-table-print-page-padding, 3mm);
  }
  .snapshot-shell [data-print-page="true"],
  [data-print-page="true"] {
    break-after: auto;
    page-break-after: auto;
  }
  .snapshot-shell .sheet-page:has([data-module-type="cardTable"]),
  .snapshot-shell [data-print-page="true"]:has([data-module-type="cardTable"]) {
    height: auto !important;
    min-height: 297mm !important;
    overflow: visible !important;
    break-inside: auto;
    page-break-inside: auto;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .snapshot-shell .module-slot:has([data-module-type="cardTable"]),
  .snapshot-shell .container:has([data-module-type="cardTable"]) {
    break-inside: auto;
    page-break-inside: auto;
  }
}`;
}

function htmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlUnescape(value: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}
