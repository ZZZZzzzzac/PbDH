import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const temporaryResourceRoot = await mkdtemp(path.join(tmpdir(), "pbdh-daggerheart-core-"));
const source = argument("--source") ?? process.argv.slice(2).find((value) => !value.startsWith("--"));
const checkOnly = process.argv.includes("--check");

try {
  const extractArguments = [
    "--import",
    "tsx",
    path.resolve("scripts/extract-daggerheart-srd2-resources.ts"),
    "--output-root",
    temporaryResourceRoot,
    ...(source ? ["--source", source] : []),
  ];
  const extracted = await run(process.execPath, extractArguments, { windowsHide: true });
  if (extracted.stdout.trim()) process.stdout.write(extracted.stdout);
  if (extracted.stderr.trim()) process.stderr.write(extracted.stderr);
  if (checkOnly) process.exitCode = 0;

  if (!checkOnly) {
    const generated = await run(process.execPath, [
      "--import",
      "tsx",
      path.resolve("scripts/generate-daggerheart-core-system-package.ts"),
      "--resource-root",
      temporaryResourceRoot,
    ], { windowsHide: true });
    if (generated.stdout.trim()) process.stdout.write(generated.stdout);
    if (generated.stderr.trim()) process.stderr.write(generated.stderr);
  }
} finally {
  await rm(temporaryResourceRoot, { recursive: true, force: true });
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
