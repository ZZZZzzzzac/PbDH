import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", ".pytest_cache", ".scratch", ".venv", "dist", "node_modules"]);
const forbiddenFiles = [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(absolutePath);
      continue;
    }
    if (entry.name.endsWith(".op") || entry.name === "design.generated.ts") {
      forbiddenFiles.push(path.relative(root, absolutePath).replaceAll("\\", "/"));
    }
  }
}

visit(root);
if (forbiddenFiles.length > 0) {
  throw new Error(`Parallel visual sources are forbidden:\n${forbiddenFiles.join("\n")}`);
}
console.log("Visual source boundary OK (frontend JSX/HTML/CSS is authoritative).");
