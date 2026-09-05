import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import {
  computeResourcePackageSnapshotDigest,
  loadPbres,
  loadResourcePackageDirectory,
  parseSemVer,
  writePbres,
  writeResourcePackageDirectory,
  type PortableDirectoryEntry,
  type ResourcePackageLogicalDocument,
} from "../packages/contract-runtime/src/index.ts";
import { validateResourcePackageCandidate } from "../apps/creator/src/workspace-prototype/resource-package-validator.ts";

export type PbresVersionBump = "major" | "minor" | "patch" | "none";

export type PackPbresWorkspaceResult = {
  document: ResourcePackageLogicalDocument;
  outputPath: string;
};

export async function unpackPbresToWorkspace(sourcePath: string, workspacePath: string): Promise<void> {
  const source = path.resolve(sourcePath);
  const workspace = path.resolve(workspacePath);
  await assertPathDoesNotExist(workspace, "解包目录已存在");

  const loaded = await loadPbres(
    new Uint8Array(await readFile(source)),
    validateResourcePackageCandidate,
  );
  if (!loaded.candidate) throw diagnosticsError("PBRES 校验失败", loaded.diagnostics);

  await mkdir(workspace, { recursive: true });
  for (const entry of writeResourcePackageDirectory(
    loaded.candidate.document,
    loaded.candidate.media,
  )) {
    const target = resolvePortablePath(workspace, entry.path);
    if (entry.kind === "directory") {
      await mkdir(target, { recursive: true });
      continue;
    }
    if (!entry.bytes) throw new Error(`缺少文件内容：${entry.path}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, entry.bytes);
  }
}

export async function packPbresWorkspace(input: {
  workspacePath: string;
  outputPath: string;
  bump?: PbresVersionBump;
  overwrite?: boolean;
}): Promise<PackPbresWorkspaceResult> {
  const workspace = path.resolve(input.workspacePath);
  const output = path.resolve(input.outputPath);
  const workspaceInfo = await stat(workspace).catch(() => undefined);
  if (!workspaceInfo?.isDirectory()) throw new Error(`解包目录不存在：${workspace}`);
  if (!input.overwrite) await assertPathDoesNotExist(output, "输出文件已存在；若要覆盖请传 --force");

  const entries = await readPortableDirectory(workspace);
  const bump = input.bump ?? "patch";
  const loaded = await loadResourcePackageDirectory(entries, async (document, media) => {
    document.package.version = bumpVersion(document.package.version, bump);
    document.snapshotDigest = await computeResourcePackageSnapshotDigest(document, media);
    return validateResourcePackageCandidate(document, media);
  });
  if (!loaded.candidate) throw diagnosticsError("解包目录校验失败", loaded.diagnostics);

  const bytes = writePbres(loaded.candidate.document, loaded.candidate.media);
  const roundTrip = await loadPbres(bytes, validateResourcePackageCandidate);
  if (!roundTrip.candidate) throw diagnosticsError("重新封包后的回读校验失败", roundTrip.diagnostics);

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, bytes);
  await updateWorkspacePackageJson(workspace, loaded.candidate.document);
  return { document: loaded.candidate.document, outputPath: output };
}

export function bumpVersion(version: string, bump: PbresVersionBump): string {
  if (bump === "none") return version;
  const parsed = parseSemVer(version);
  if (!parsed) throw new Error(`资源包版本不是有效 SemVer：${version}`);
  if (bump === "major") return `${parsed.major + 1}.0.0`;
  if (bump === "minor") return `${parsed.major}.${parsed.minor + 1}.0`;
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

async function readPortableDirectory(root: string): Promise<PortableDirectoryEntry[]> {
  const entries: PortableDirectoryEntry[] = [];
  await visit(root, "");
  return entries;

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true });
    if (children.length === 0 && relativeDirectory) {
      entries.push({ path: `${relativeDirectory.replaceAll(path.sep, "/")}/`, kind: "directory" });
      return;
    }
    for (const child of children) {
      const absolute = path.join(directory, child.name);
      const relative = path.posix.join(relativeDirectory.replaceAll(path.sep, "/"), child.name);
      if (child.isSymbolicLink()) {
        entries.push({ path: relative, kind: "symlink" });
      } else if (child.isDirectory()) {
        await visit(absolute, relative);
      } else if (child.isFile()) {
        entries.push({ path: relative, kind: "file", bytes: new Uint8Array(await readFile(absolute)) });
      } else {
        entries.push({ path: relative, kind: "device" });
      }
    }
  }
}

async function updateWorkspacePackageJson(
  workspace: string,
  document: ResourcePackageLogicalDocument,
): Promise<void> {
  const { resources: _resources, ...root } = document;
  await writeFile(
    path.join(workspace, "package.json"),
    `${JSON.stringify(root, null, 2)}\n`,
    "utf8",
  );
}

function resolvePortablePath(root: string, portablePath: string): string {
  const target = path.resolve(root, ...portablePath.replace(/\/$/, "").split("/"));
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`归档路径越出解包目录：${portablePath}`);
  }
  return target;
}

async function assertPathDoesNotExist(target: string, message: string): Promise<void> {
  try {
    await stat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${message}：${target}`);
}

function diagnosticsError(prefix: string, diagnostics: Array<{
  code: string;
  location: string;
  params?: Record<string, unknown>;
}>): Error {
  const details = diagnostics.map((item) =>
    `${item.code}${item.location ? ` ${item.location}` : ""}${item.params ? ` ${JSON.stringify(item.params)}` : ""}`,
  ).join("\n");
  return new Error(`${prefix}${details ? `：\n${details}` : ""}`);
}
