import { z } from "zod";
import type { ResourceLibraryReference } from "../domain/resourceLibrary";
import type { PackageSourceMap, PackageValidationResult } from "../domain/systemPackage";
import { packagePagesSourceSchema, systemPackageManifestSourceSchema } from "../domain/systemPackageAuthorSchema";
import type { RuntimePackageAsset } from "./assetResolver";
import { createVirtualFileSystemFromDirectoryFiles, createVirtualFileSystemFromDirectoryHandle, createVirtualFileSystemFromZipFile, type PackageDirectoryHandle, type PackageVirtualFileSystem } from "./packageVfs";
import { inferMimeType, isPlainObject } from "../utils";

export const packageManifestPath = "manifest.json";
export type LoadedPackageAsset = RuntimePackageAsset;

export type PackageLoadResult = PackageValidationResult & { packageAssets?: LoadedPackageAsset[] };
export type PackageLoadOverrides = {
  resourceLibraries?: Array<ResourceLibraryReference & { entries: unknown }>;
  packageAssets?: RuntimePackageAsset[];
};

const packageManifestSchema = systemPackageManifestSourceSchema;
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
  const manifestText = vfs.readText(packageManifestPath);
  if (!manifestText.ok) {
    if (manifestText.issue.code === "PACKAGE_FILE_MISSING") {
      return {
        ok: false,
        issues: [
          {
            level: "fatal",
            code: "MANIFEST_MISSING",
            text: "System Package 缺少 manifest.json。",
            path: packageManifestPath,
          },
        ],
      };
    }

    return { ok: false, issues: [manifestText.issue] };
  }

  const manifestJson = parsePackageJson(manifestText.value, packageManifestPath, "MANIFEST_JSON_INVALID");
  if (!manifestJson.ok) {
    return { ok: false, issues: [manifestJson.issue] };
  }

  const manifest = packageManifestSchema.safeParse(manifestJson.value);
  if (!manifest.success) {
    return {
      ok: false,
      issues: manifest.error.issues.map((issue) => ({
        level: "fatal",
        code: issue.message === "必须是安全的包内相对路径。" ? "PACKAGE_PATH_UNSAFE" : "MANIFEST_SHAPE_INVALID",
        text: issue.message,
        path: [packageManifestPath, ...issue.path].join("."),
      })),
    };
  }

  const pagesJson = readPackageJsonFile(vfs, manifest.data.pages);
  if (!pagesJson.ok) {
    return { ok: false, issues: [pagesJson.issue] };
  }

  const pagesWithLayouts = loadPageLayoutFilesFromVfs(vfs, pagesJson.value);
  if (!pagesWithLayouts.ok) {
    return { ok: false, issues: [pagesWithLayouts.issue] };
  }

  const modulesJson = readPackageJsonFile(vfs, manifest.data.modules);
  if (!modulesJson.ok) {
    return { ok: false, issues: [modulesJson.issue] };
  }

  const dependenciesJson = manifest.data.dependencies ? readPackageJsonFile(vfs, manifest.data.dependencies) : undefined;
  if (dependenciesJson && !dependenciesJson.ok) {
    return { ok: false, issues: [dependenciesJson.issue] };
  }
  const shell = manifest.data.shell ? loadTemplateFilesFromVfs(vfs, manifest.data.shell) : undefined;
  if (shell && !shell.ok) return { ok: false, issues: [shell.issue] };
  const skins = loadSkinFilesFromVfs(vfs, manifest.data.skins ?? []);
  if (!skins.ok) return { ok: false, issues: [skins.issue] };

  const guideJson = manifest.data.characterCreationGuide
    ? readPackageJsonFile(vfs, manifest.data.characterCreationGuide)
    : undefined;
  if (guideJson && !guideJson.ok) {
    return { ok: false, issues: [guideJson.issue] };
  }
  const questionnaire = manifest.data.questionnaireCharacterCreation
    ? loadQuestionnaireFileFromVfs(vfs, manifest.data.questionnaireCharacterCreation)
    : undefined;
  if (questionnaire && !questionnaire.ok) return { ok: false, issues: [questionnaire.issue] };
  const resourceFormatAdaptersJson = manifest.data.resourceFormatAdapters
    ? readPackageJsonFile(vfs, manifest.data.resourceFormatAdapters)
    : undefined;
  if (resourceFormatAdaptersJson && !resourceFormatAdaptersJson.ok) return { ok: false, issues: [resourceFormatAdaptersJson.issue] };
  const characterFormatAdaptersJson = manifest.data.characterFormatAdapters
    ? readPackageJsonFile(vfs, manifest.data.characterFormatAdapters)
    : undefined;
  if (characterFormatAdaptersJson && !characterFormatAdaptersJson.ok) return { ok: false, issues: [characterFormatAdaptersJson.issue] };
  const characterTextExportsJson = manifest.data.characterTextExports
    ? readPackageJsonFile(vfs, manifest.data.characterTextExports)
    : undefined;
  if (characterTextExportsJson && !characterTextExportsJson.ok) return { ok: false, issues: [characterTextExportsJson.issue] };
  const resourceFormatAdapters = resourceFormatAdaptersJson
    ? loadFormatAdapterScriptFilesFromVfs(vfs, resourceFormatAdaptersJson.value, false)
    : undefined;
  if (resourceFormatAdapters && !resourceFormatAdapters.ok) return { ok: false, issues: [resourceFormatAdapters.issue] };
  const characterFormatAdapters = characterFormatAdaptersJson
    ? loadFormatAdapterScriptFilesFromVfs(vfs, characterFormatAdaptersJson.value, true)
    : undefined;
  if (characterFormatAdapters && !characterFormatAdapters.ok) return { ok: false, issues: [characterFormatAdapters.issue] };

  const resourceLibraries = loadResourceLibraryFilesFromVfs(vfs, manifest.data.resourceLibraries ?? []);
  if (!resourceLibraries.ok) {
    return { ok: false, issues: [resourceLibraries.issue] };
  }

  const validationChecks = loadValidationScriptFilesFromVfs(vfs, manifest.data.validationChecks ?? []);
  if (!validationChecks.ok) {
    return { ok: false, issues: [validationChecks.issue] };
  }

  const packageAssets = resolvePackageAssets(vfs);
  const effectivePackageAssets = [...packageAssets, ...(overrides.packageAssets ?? [])];
  const normalized = await normalizeManifestPackage(
    manifest.data,
    pagesWithLayouts.value,
    modulesJson.value,
    overrides.resourceLibraries ?? resourceLibraries.value,
    dependenciesJson?.value,
    validationChecks.value,
    guideJson?.value,
    questionnaire?.value,
    resourceFormatAdapters?.value,
    characterFormatAdapters?.value,
    characterTextExportsJson?.value,
    shell?.value,
    skins.value,
    effectivePackageAssets,
    buildPackageSourceMap(manifest.data, pagesJson.value),
  );
  if (!normalized.ok) {
    return normalized;
  }

  return {
    ...normalized,
    packageAssets: effectivePackageAssets,
  };
}

async function normalizeManifestPackage(
  manifest: z.infer<typeof packageManifestSchema>,
  pages: unknown,
  modules: unknown,
  resourceLibraries: Array<ResourceLibraryReference & { entries: unknown }> = [],
  dependencies?: unknown,
  validationChecks?: Array<{ ID: string; 脚本: string; scriptContent: string }>,
  characterCreationGuide?: unknown,
  questionnaireCharacterCreation?: unknown,
  resourceFormatAdapters?: unknown,
  characterFormatAdapters?: unknown,
  characterTextExports?: unknown,
  shell?: unknown,
  skins?: Array<{ ID: string; 名称: string; cssContent: string; 推荐框架配色: "light" | "dark" }>,
  packageAssets: RuntimePackageAsset[] = [],
  sourceMap: PackageSourceMap = {},
): Promise<PackageValidationResult> {
  const { validateSystemPackage } = await import("../domain/systemPackage/validator");
  return validateSystemPackage({
    manifest: {
      ID: manifest.ID,
      名称: manifest.名称,
      版本: manifest.版本,
      schemaVersion: manifest.schemaVersion,
      ...(manifest.加载展示 ? { 加载展示: manifest.加载展示 } : {}),
    },
    ...(skins && skins.length > 0 ? { skins } : {}),
    ...(manifest.defaultSkin ? { defaultSkin: manifest.defaultSkin } : {}),
    pages,
    shell,
    modules,
    assets: packageAssets.map(({ 路径, 类型 }) => ({ 路径, 类型 })),
    resourceLibraries,
    dependencies,
    validationChecks,
    characterCreationGuide,
    questionnaireCharacterCreation,
    resourceFormatAdapters,
    characterFormatAdapters,
    characterTextExports,
  }, sourceMap, {
    unusedAssetWarningRefs: new Set(packageAssets
      .filter((asset) => asset.sourceType !== "resourceExtension")
      .map((asset) => asset.路径)),
  });
}

function buildPackageSourceMap(manifest: z.infer<typeof packageManifestSchema>, pages: unknown): PackageSourceMap {
  const sourceMap: PackageSourceMap = {
    manifest: packageManifestPath,
    pages: manifest.pages,
    modules: manifest.modules,
    ...(manifest.dependencies ? { dependencies: manifest.dependencies } : {}),
    ...(manifest.characterCreationGuide ? { characterCreationGuide: manifest.characterCreationGuide } : {}),
    ...(manifest.questionnaireCharacterCreation ? { questionnaireCharacterCreation: manifest.questionnaireCharacterCreation.html } : {}),
    ...(manifest.resourceFormatAdapters ? { resourceFormatAdapters: manifest.resourceFormatAdapters } : {}),
    ...(manifest.characterFormatAdapters ? { characterFormatAdapters: manifest.characterFormatAdapters } : {}),
    ...(manifest.characterTextExports ? { characterTextExports: manifest.characterTextExports } : {}),
    ...(manifest.shell ? { shell: manifest.shell.html } : {}),
  };
  manifest.resourceLibraries?.forEach((library) => {
    sourceMap[`resourceLibraries.${library.ID}`] = library.路径;
  });
  manifest.validationChecks?.forEach((check, index) => {
    sourceMap[`validationChecks.${index}`] = check.脚本;
  });
  manifest.skins?.forEach((skin) => {
    sourceMap[`skins.${skin.ID}.css`] = skin.css;
    if (skin.layoutOverrides?.shell) sourceMap[`skins.${skin.ID}.layoutOverrides.shell.html`] = skin.layoutOverrides.shell.html;
    skin.layoutOverrides?.pages?.forEach((page) => {
      sourceMap[`skins.${skin.ID}.layoutOverrides.pages.${page.ID}.html`] = page.html;
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
  reference: { ID: string; 名称: string; html: string },
) {
  const html = vfs.readText(reference.html);
  if (!html.ok) return html;
  return { ok: true as const, value: { ID: reference.ID, 名称: reference.名称, htmlContent: html.value } };
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

function loadResourceLibraryFilesFromVfs(vfs: PackageVirtualFileSystem, libraries: ResourceLibraryReference[]) {
  const normalizedLibraries = [];

  for (const library of libraries) {
    const entries = readPackageJsonFile(vfs, library.路径);
    if (!entries.ok) {
      return { ok: false as const, issue: entries.issue };
    }

    normalizedLibraries.push({ ...library, entries: entries.value });
  }

  return { ok: true as const, value: normalizedLibraries };
}

function loadValidationScriptFilesFromVfs(
  vfs: PackageVirtualFileSystem,
  checks: NonNullable<z.infer<typeof packageManifestSchema>["validationChecks"]>,
) {
  const normalizedChecks = [];

  for (const check of checks) {
    const script = vfs.readText(check.脚本);
    if (!script.ok) {
      return { ok: false as const, issue: script.issue };
    }

    normalizedChecks.push({ ...check, 脚本: script.path, scriptContent: script.value });
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
  skins: NonNullable<z.infer<typeof packageManifestSchema>["skins"]>,
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
      pages.push({ ID: page.ID, htmlContent: html.value });
    }
    normalizedSkins.push({
      ID: skin.ID,
      名称: skin.名称,
      cssContent: css.value,
      推荐框架配色: skin.推荐框架配色,
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
