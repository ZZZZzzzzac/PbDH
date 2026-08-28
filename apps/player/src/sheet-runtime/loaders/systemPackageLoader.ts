import type { SystemPackageDocument } from "@pbdh/contract-runtime";
import type { ResourceLibraryReference } from "../domain/resourceLibrary";
import type { PackageSourceMap, PackageValidationResult } from "../domain/systemPackage";
import { packagePagesSourceSchema } from "../domain/systemPackageAuthorSchema";
import type { RuntimePackageAsset } from "./assetResolver";
import { createVirtualFileSystemFromDirectoryFiles, createVirtualFileSystemFromDirectoryHandle, createVirtualFileSystemFromZipFile, type PackageDirectoryHandle, type PackageVirtualFileSystem } from "./packageVfs";
import { inferMimeType, isPlainObject } from "../utils";
import { validateSystemPackageDocument } from "../../system-package-validator";

export const systemDocumentPath = "system.json";
export type LoadedPackageAsset = RuntimePackageAsset;

export type PackageLoadResult = PackageValidationResult & { packageAssets?: LoadedPackageAsset[] };
export type PackageLoadOverrides = {
  resourceLibraries?: Array<ResourceLibraryReference & { entries: unknown }>;
  packageAssets?: RuntimePackageAsset[];
};

const pageLayoutReferenceSchema = packagePagesSourceSchema;

export async function loadSystemPackageFromZipFile(file: Blob): Promise<PackageLoadResult> {
  const vfsResult = await createVirtualFileSystemFromZipFile(file);
  if (!vfsResult.ok) {
    return { ok: false, issues: vfsResult.issues };
  }

  return loadSystemPackageFromVfs(vfsResult.vfs);
}

export async function loadSystemPackageFromVfs(
  vfs: PackageVirtualFileSystem,
  overrides: PackageLoadOverrides = {},
): Promise<PackageLoadResult> {
  const systemText = vfs.readText(systemDocumentPath);
  if (!systemText.ok) {
    if (systemText.issue.code === "PACKAGE_FILE_MISSING") {
      return {
        ok: false,
        issues: [
          {
            level: "fatal",
            code: "SYSTEM_DOCUMENT_MISSING",
            text: "System Package 缺少 system.json。",
            path: systemDocumentPath,
          },
        ],
      };
    }

    return { ok: false, issues: [systemText.issue] };
  }

  const systemJson = parsePackageJson(systemText.value, systemDocumentPath, "SYSTEM_DOCUMENT_JSON_INVALID");
  if (!systemJson.ok) {
    return { ok: false, issues: [systemJson.issue] };
  }

  const document = systemJson.value as SystemPackageDocument;
  const documentDiagnostics = validateSystemPackageDocument(document);
  if (documentDiagnostics.length > 0) {
    return {
      ok: false,
      issues: documentDiagnostics.map((diagnostic) => ({
        level: "fatal",
        code: "SYSTEM_DOCUMENT_SHAPE_INVALID",
        text: `System Package Contract 校验失败：${diagnostic.code}`,
        path: `${systemDocumentPath}${diagnostic.location}`,
      })),
    };
  }
  const runtime = document.runtime;

  const pagesJson = readPackageJsonFile(vfs, runtime.pages);
  if (!pagesJson.ok) {
    return { ok: false, issues: [pagesJson.issue] };
  }

  const pagesWithLayouts = loadPageLayoutFilesFromVfs(vfs, pagesJson.value);
  if (!pagesWithLayouts.ok) {
    return { ok: false, issues: [pagesWithLayouts.issue] };
  }

  const modulesJson = readPackageJsonFile(vfs, runtime.modules);
  if (!modulesJson.ok) {
    return { ok: false, issues: [modulesJson.issue] };
  }

  const dependenciesJson = runtime.dependencies ? readPackageJsonFile(vfs, runtime.dependencies) : undefined;
  if (dependenciesJson && !dependenciesJson.ok) {
    return { ok: false, issues: [dependenciesJson.issue] };
  }
  const shell = runtime.shell ? loadTemplateFilesFromVfs(vfs, runtime.shell) : undefined;
  if (shell && !shell.ok) return { ok: false, issues: [shell.issue] };
  const skins = loadSkinFilesFromVfs(vfs, runtime.skins ?? []);
  if (!skins.ok) return { ok: false, issues: [skins.issue] };

  const guideJson = runtime.characterCreationGuide
    ? readPackageJsonFile(vfs, runtime.characterCreationGuide)
    : undefined;
  if (guideJson && !guideJson.ok) {
    return { ok: false, issues: [guideJson.issue] };
  }
  const questionnaire = runtime.questionnaireCharacterCreation
    ? loadQuestionnaireFileFromVfs(vfs, runtime.questionnaireCharacterCreation)
    : undefined;
  if (questionnaire && !questionnaire.ok) return { ok: false, issues: [questionnaire.issue] };
  const characterFormatAdaptersJson = runtime.characterFormatAdapters
    ? readPackageJsonFile(vfs, runtime.characterFormatAdapters)
    : undefined;
  if (characterFormatAdaptersJson && !characterFormatAdaptersJson.ok) return { ok: false, issues: [characterFormatAdaptersJson.issue] };
  const characterTextExportsJson = runtime.characterTextExports
    ? readPackageJsonFile(vfs, runtime.characterTextExports)
    : undefined;
  if (characterTextExportsJson && !characterTextExportsJson.ok) return { ok: false, issues: [characterTextExportsJson.issue] };
  const characterFormatAdapters = characterFormatAdaptersJson
    ? loadFormatAdapterScriptFilesFromVfs(vfs, characterFormatAdaptersJson.value, true)
    : undefined;
  if (characterFormatAdapters && !characterFormatAdapters.ok) return { ok: false, issues: [characterFormatAdapters.issue] };

  const validationChecks = loadValidationScriptFilesFromVfs(vfs, runtime.validationChecks ?? []);
  if (!validationChecks.ok) {
    return { ok: false, issues: [validationChecks.issue] };
  }

  const packageAssets = resolvePackageAssets(vfs);
  const effectivePackageAssets = [...packageAssets, ...(overrides.packageAssets ?? [])];
  const normalized = await normalizeSystemPackage(
    document,
    pagesWithLayouts.value,
    modulesJson.value,
    overrides.resourceLibraries ?? [],
    dependenciesJson?.value,
    validationChecks.value,
    guideJson?.value,
    questionnaire?.value,
    characterFormatAdapters?.value,
    characterTextExportsJson?.value,
    shell?.value,
    skins.value,
    effectivePackageAssets,
    buildPackageSourceMap(document, pagesJson.value),
  );
  if (!normalized.ok) {
    return normalized;
  }

  return {
    ...normalized,
    packageAssets: effectivePackageAssets,
  };
}

async function normalizeSystemPackage(
  document: SystemPackageDocument,
  pages: unknown,
  modules: unknown,
  resourceLibraries: Array<ResourceLibraryReference & { entries: unknown }> = [],
  dependencies?: unknown,
  validationChecks?: Array<{ ID: string; 脚本: string; scriptContent: string }>,
  characterCreationGuide?: unknown,
  questionnaireCharacterCreation?: unknown,
  characterFormatAdapters?: unknown,
  characterTextExports?: unknown,
  shell?: unknown,
  skins?: Array<{ ID: string; 名称: string; cssContent: string; 推荐框架配色: "light" | "dark" }>,
  packageAssets: RuntimePackageAsset[] = [],
  sourceMap: PackageSourceMap = {},
): Promise<PackageValidationResult> {
  const { validateSystemPackage } = await import("../domain/systemPackage/validator");
  const runtime = document.runtime;
  return validateSystemPackage({
    manifest: {
      ID: document.package.id,
      名称: document.package.name,
      版本: document.package.version,
      ...(runtime.loadingPresentation ? { 加载展示: {
        标语: runtime.loadingPresentation.tagline,
        强调色: runtime.loadingPresentation.accentColor,
      } } : {}),
    },
    ...(skins && skins.length > 0 ? { skins } : {}),
    ...(runtime.defaultSkin ? { defaultSkin: runtime.defaultSkin } : {}),
    pages,
    shell,
    modules,
    assets: packageAssets.map(({ 路径, 类型 }) => ({ 路径, 类型 })),
    resourceLibraries,
    dependencies,
    validationChecks,
    characterCreationGuide,
    questionnaireCharacterCreation,
    characterFormatAdapters,
    characterTextExports,
  }, sourceMap, {
    unusedAssetWarningRefs: new Set(packageAssets
      .filter((asset) => asset.sourceType !== "resourceExtension")
      .map((asset) => asset.路径)),
  });
}

function buildPackageSourceMap(document: SystemPackageDocument, pages: unknown): PackageSourceMap {
  const runtime = document.runtime;
  const sourceMap: PackageSourceMap = {
    manifest: systemDocumentPath,
    pages: runtime.pages,
    modules: runtime.modules,
    ...(runtime.dependencies ? { dependencies: runtime.dependencies } : {}),
    ...(runtime.characterCreationGuide ? { characterCreationGuide: runtime.characterCreationGuide } : {}),
    ...(runtime.questionnaireCharacterCreation ? { questionnaireCharacterCreation: runtime.questionnaireCharacterCreation.html } : {}),
    ...(runtime.characterFormatAdapters ? { characterFormatAdapters: runtime.characterFormatAdapters } : {}),
    ...(runtime.characterTextExports ? { characterTextExports: runtime.characterTextExports } : {}),
    ...(runtime.shell ? { shell: runtime.shell.html } : {}),
  };
  runtime.validationChecks?.forEach((check, index) => {
    sourceMap[`validationChecks.${index}`] = check.script;
  });
  runtime.skins?.forEach((skin) => {
    sourceMap[`skins.${skin.id}.css`] = skin.css;
    if (skin.layoutOverrides?.shell) sourceMap[`skins.${skin.id}.layoutOverrides.shell.html`] = skin.layoutOverrides.shell.html;
    skin.layoutOverrides?.pages?.forEach((page) => {
      sourceMap[`skins.${skin.id}.layoutOverrides.pages.${page.id}.html`] = page.html;
    });
  });
  if (Array.isArray(pages)) {
    pages.forEach((page) => {
      if (!isPlainObject(page) || typeof page.ID !== "string" || !isPlainObject(page.layout)) return;
      if (typeof page.layout.html === "string") sourceMap[`pages.${page.ID}.layout.html`] = page.layout.html;
      if (typeof page.layout.css === "string") sourceMap[`pages.${page.ID}.layout.css`] = page.layout.css;
    });
  }
  return sourceMap;
}

function loadTemplateFilesFromVfs(vfs: PackageVirtualFileSystem, reference: { html: string; css?: string }) {
  const html = vfs.readText(reference.html);
  if (!html.ok) return html;
  const css = reference.css ? vfs.readText(reference.css) : undefined;
  if (css && !css.ok) return css;
  return { ok: true as const, value: { 类型: "htmlTemplate" as const, htmlContent: html.value, ...(css?.ok ? { cssContent: css.value } : {}) } };
}

function loadQuestionnaireFileFromVfs(
  vfs: PackageVirtualFileSystem,
  reference: { id: string; name: string; html: string },
) {
  const html = vfs.readText(reference.html);
  if (!html.ok) return html;
  return { ok: true as const, value: { ID: reference.id, 名称: reference.name, htmlContent: html.value } };
}

export async function loadSystemPackageFromDirectoryFiles(files: Iterable<File>): Promise<PackageLoadResult> {
  const vfsResult = await createVirtualFileSystemFromDirectoryFiles(files);
  if (!vfsResult.ok) return { ok: false, issues: vfsResult.issues };
  return loadSystemPackageFromVfs(vfsResult.vfs);
}

export async function loadSystemPackageFromDirectoryHandle(handle: PackageDirectoryHandle): Promise<PackageLoadResult> {
  const vfsResult = await createVirtualFileSystemFromDirectoryHandle(handle);
  if (!vfsResult.ok) return { ok: false, issues: vfsResult.issues };
  return loadSystemPackageFromVfs(vfsResult.vfs);
}

function readPackageJsonFile(vfs: PackageVirtualFileSystem, path: string) {
  const text = vfs.readText(path);
  if (!text.ok) {
    return text;
  }

  return parsePackageJson(text.value, text.path, "PACKAGE_JSON_INVALID");
}

function parsePackageJson(text: string, path: string, code: string) {
  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false as const,
      issue: {
        level: "fatal" as const,
        code,
        text: `System Package JSON 格式错误：${path}`,
        path,
      },
    };
  }
}

function loadPageLayoutFilesFromVfs(vfs: PackageVirtualFileSystem, pages: unknown) {
  const parsed = pageLayoutReferenceSchema.safeParse(pages);
  if (!parsed.success) {
    return { ok: true as const, value: pages };
  }

  const normalizedPages = [];
  for (const page of parsed.data) {
    if (!page.layout) {
      normalizedPages.push(page);
      continue;
    }

    const html = vfs.readText(page.layout.html);
    if (!html.ok) {
      return { ok: false as const, issue: html.issue };
    }

    const css = page.layout.css ? vfs.readText(page.layout.css) : undefined;
    if (css && !css.ok) {
      return { ok: false as const, issue: css.issue };
    }

    normalizedPages.push({
      ...page,
      layout: {
        类型: page.layout.类型,
        htmlContent: html.value,
        ...(css?.ok ? { cssContent: css.value } : {}),
      },
    });
  }

  return { ok: true as const, value: normalizedPages };
}

function loadValidationScriptFilesFromVfs(
  vfs: PackageVirtualFileSystem,
  checks: NonNullable<SystemPackageDocument["runtime"]["validationChecks"]>,
) {
  const normalizedChecks = [];

  for (const check of checks) {
    const script = vfs.readText(check.script);
    if (!script.ok) {
      return { ok: false as const, issue: script.issue };
    }

    normalizedChecks.push({ ID: check.id, 脚本: script.path, scriptContent: script.value });
  }

  return { ok: true as const, value: normalizedChecks };
}

function loadFormatAdapterScriptFilesFromVfs(vfs: PackageVirtualFileSystem, adapters: unknown, includeExport: boolean) {
  if (!Array.isArray(adapters)) return { ok: true as const, value: adapters };
  const normalized = [];
  for (const adapter of adapters) {
    if (typeof adapter !== "object" || adapter === null || Array.isArray(adapter)) {
      normalized.push(adapter);
      continue;
    }
    const next = { ...(adapter as Record<string, unknown>) };
    if (typeof next.导入脚本 === "string") {
      const script = vfs.readText(next.导入脚本);
      if (!script.ok) return { ok: false as const, issue: script.issue };
      next.导入脚本 = script.path;
      next.importScriptContent = script.value;
    }
    if (includeExport && typeof next.导出脚本 === "string") {
      const script = vfs.readText(next.导出脚本);
      if (!script.ok) return { ok: false as const, issue: script.issue };
      next.导出脚本 = script.path;
      next.exportScriptContent = script.value;
    }
    normalized.push(next);
  }
  return { ok: true as const, value: normalized };
}

function resolvePackageAssets(vfs: PackageVirtualFileSystem): LoadedPackageAsset[] {
  const resolvedAssets: LoadedPackageAsset[] = [];

  for (const path of vfs.listFiles().filter(isSupportedPackageImagePath)) {
    const read = vfs.readBytes(path);
    if (!read.ok) {
      continue;
    }

    resolvedAssets.push({
      路径: read.path,
      类型: inferMimeType(read.path),
      bytes: read.value,
    });
  }

  return resolvedAssets;
}

function loadSkinFilesFromVfs(
  vfs: PackageVirtualFileSystem,
  skins: NonNullable<SystemPackageDocument["runtime"]["skins"]>,
) {
  const normalizedSkins = [];
  for (const skin of skins) {
    const css = vfs.readText(skin.css);
    if (!css.ok) return { ok: false as const, issue: css.issue };
    const shell = skin.layoutOverrides?.shell ? vfs.readText(skin.layoutOverrides.shell.html) : undefined;
    if (shell && !shell.ok) return { ok: false as const, issue: shell.issue };
    const pages = [];
    for (const page of skin.layoutOverrides?.pages ?? []) {
      const html = vfs.readText(page.html);
      if (!html.ok) return { ok: false as const, issue: html.issue };
      pages.push({ ID: page.id, htmlContent: html.value });
    }
    normalizedSkins.push({
      ID: skin.id,
      名称: skin.name,
      cssContent: css.value,
      推荐框架配色: skin.frameworkColorScheme,
      ...((shell?.ok || pages.length > 0) ? { layoutOverrides: {
        ...(shell?.ok ? { shell: { htmlContent: shell.value } } : {}),
        ...(pages.length > 0 ? { pages } : {}),
      } } : {}),
    });
  }
  return { ok: true as const, value: normalizedSkins };
}

function isSupportedPackageImagePath(path: string): boolean {
  return path.startsWith("assets/") && /\.(?:png|jpe?g|webp|gif|avif|svg)$/iu.test(path);
}
