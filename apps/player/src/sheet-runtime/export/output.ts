import { exportCharacterData, parseCharacterDataJson, type CharacterData, type CharacterImportResult } from "../domain/characterData";
import type { SystemPackage } from "../domain/systemPackage";

const embeddedCharacterDataId = "pbdh-character-data";

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
  const images = [...root.querySelectorAll("img")].filter(isVisibleImage);
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
  syncFormControls(root, clone);
  await embedImages(root, clone);
  clone.querySelectorAll("[data-output-exclude]").forEach((element) => element.remove());
  stripInteractiveRuntimeState(clone);
  return clone.outerHTML;
}

async function embedImages(sourceRoot: Element, cloneRoot: Element): Promise<void> {
  const sourceImages = sourceRoot.querySelectorAll("img");
  const cloneImages = cloneRoot.querySelectorAll("img");

  await Promise.all([...sourceImages].map(async (sourceImage, index) => {
    const source = sourceImage.currentSrc || sourceImage.src;
    if (!shouldInlineImageUrl(source)) {
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
    } catch (error) {
      if (source.startsWith("blob:")) {
        throw error;
      }
      // 静态资源（如预制包的相对路径卡图）内联失败时保留原 URL，避免阻断整个导出。
    }
  }));
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

function syncFormControls(sourceRoot: Element, cloneRoot: Element) {
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

function stripInteractiveRuntimeState(clone: Element) {
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
