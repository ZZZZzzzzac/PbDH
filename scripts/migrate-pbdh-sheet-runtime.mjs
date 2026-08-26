import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceRepository = process.env.PBDH_SHEET_SOURCE ?? "D:\\Fish\\TRPG\\PbDH_sheet";
const expectedCommit = "0e44fa69b12209c172e4189e273615ba3a4d07a6";
const sourceRoot = path.join(sourceRepository, "src");
const targetRoot = path.resolve("apps/player/src/sheet-runtime");
const sourceSystemPackageRoot = path.join(
  sourceRepository,
  "public",
  "system-packages",
  "daggerheart-core",
);
const targetSystemPackageRoot = path.resolve(
  "apps/player/system-package-sources/daggerheart-core",
);
const sourceDirectories = ["domain", "export", "loaders", "rendering", "store", "styles"];
const excludedFiles = new Set([
  "rendering/app/AppTopBar.tsx",
  "rendering/moduleRegistry.testSupport.tsx",
  "rendering/playerImageProcessor.ts",
]);

const actualCommit = execFileSync(
  "git",
  [
    "-c",
    `safe.directory=${sourceRepository.replaceAll("\\", "/")}`,
    "-C",
    sourceRepository,
    "rev-parse",
    "HEAD",
  ],
  { encoding: "utf8" },
).trim();

if (actualCommit !== expectedCommit) {
  throw new Error(`PbDH_sheet commit changed: expected ${expectedCommit}, received ${actualCommit}`);
}

const copied = [];

for (const directory of sourceDirectories) {
  await copyDirectory(path.join(sourceRoot, directory), path.join(targetRoot, directory), directory);
}
await copyFile(path.join(sourceRoot, "utils.ts"), path.join(targetRoot, "utils.ts"), "utils.ts");
await copyDirectory(
  sourceSystemPackageRoot,
  targetSystemPackageRoot,
  "public/system-packages/daggerheart-core",
);

await writeFile(
  path.join(targetRoot, "migration-manifest.json"),
  `${JSON.stringify({
    sourceRepository: "PbDH_sheet",
    sourceCommit: expectedCommit,
    copiedPaths: copied.sort(),
  }, null, 2)}\n`,
  "utf8",
);

async function copyDirectory(sourceDirectory, targetDirectory, relativeDirectory) {
  await mkdir(targetDirectory, { recursive: true });
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name);
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath, relativePath);
      continue;
    }
    if (!entry.isFile() || excludedFiles.has(relativePath) || /\.test\.[cm]?[jt]sx?$/u.test(entry.name)) continue;
    await copyFile(sourcePath, targetPath, relativePath);
  }
}

async function copyFile(sourcePath, targetPath, relativePath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  try {
    await access(targetPath);
    copied.push(relativePath.replaceAll("\\", "/"));
    return;
  } catch {
    // 固定来源只补充尚未迁移的文件；迁移后的实现由新仓库拥有。
  }
  await writeFile(targetPath, await readFile(sourcePath));
  copied.push(relativePath.replaceAll("\\", "/"));
}
