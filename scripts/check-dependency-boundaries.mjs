import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  findDependencyCycles,
  validateImport,
  validateSource,
  workspaceDirectoriesFromManifest,
} from "./dependency-boundaries-core.mjs";

const root = process.cwd();
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

async function collectSourceFiles(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const relativePath = path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) files.push(...await collectSourceFiles(relativePath));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(relativePath);
  }
  return files;
}

function extractImports(source) {
  const imports = [];
  const pattern = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of source.matchAll(pattern)) imports.push(match[1] ?? match[2] ?? match[3]);
  return imports;
}

async function readWorkspaceGraph() {
  const rootManifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const workspaceDirectories = workspaceDirectoriesFromManifest(rootManifest);
  const manifests = [];
  for (const directory of workspaceDirectories) {
    const manifest = JSON.parse(await readFile(path.join(root, directory, "package.json"), "utf8"));
    manifests.push({ directory, manifest });
  }

  const workspaceNames = new Set(manifests.map(({ manifest }) => manifest.name));
  const graph = new Map();
  for (const { manifest } of manifests) {
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
      ...manifest.optionalDependencies,
    };
    graph.set(
      manifest.name,
      new Set(Object.keys(dependencies).filter((name) => workspaceNames.has(name))),
    );
  }
  return { graph, manifests };
}

const sourceFiles = [
  ...await collectSourceFiles("apps"),
  ...await collectSourceFiles("packages"),
];
const failures = [];

for (const sourceFile of sourceFiles) {
  const source = await readFile(path.join(root, sourceFile), "utf8");
  for (const violation of validateSource(sourceFile, source)) {
    failures.push(`${sourceFile}: ${violation}`);
  }
  for (const specifier of extractImports(source)) {
    for (const violation of validateImport(sourceFile, specifier)) {
      failures.push(`${sourceFile}: ${specifier}: ${violation}`);
    }
  }
}

const { graph, manifests } = await readWorkspaceGraph();
for (const { directory, manifest } of manifests) {
  for (const dependency of graph.get(manifest.name) ?? []) {
    for (const violation of validateImport(`${directory}/package.json`, dependency)) {
      failures.push(`${directory}/package.json: ${dependency}: ${violation}`);
    }
  }
}
for (const cycle of findDependencyCycles(graph)) {
  failures.push(`workspace dependency cycle: ${cycle.join(" -> ")}`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Dependency boundaries OK (${sourceFiles.length} source files, ${graph.size} workspaces).`);
