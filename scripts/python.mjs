import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const configuredPython = process.env.PBDH_PYTHON;
const candidates = [
  configuredPython,
  path.join(root, ".venv", "Scripts", "python.exe"),
  path.join(root, ".venv", "bin", "python"),
  "python",
].filter(Boolean);

for (const candidate of candidates) {
  if (candidate.includes(path.sep) && !existsSync(candidate)) continue;
  const result = spawnSync(candidate, process.argv.slice(2), { stdio: "inherit" });
  if (result.error?.code === "ENOENT") continue;
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

console.error("Python not found. Create .venv or set PBDH_PYTHON.");
process.exit(1);
