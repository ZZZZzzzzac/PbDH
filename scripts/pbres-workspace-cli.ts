import path from "node:path";

import {
  packPbresWorkspace,
  unpackPbresToWorkspace,
  type PbresVersionBump,
} from "./pbres-workspace.ts";

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "unpack") {
    const source = required(args[0], "缺少 .pbres 路径");
    const workspace = args[1] ?? defaultWorkspacePath(source);
    await unpackPbresToWorkspace(source, workspace);
    console.log(`已解包：${path.resolve(workspace)}`);
  } else if (command === "pack") {
    const workspace = required(args[0], "缺少解包目录路径");
    const positionalOutput = args[1]?.startsWith("--") ? undefined : args[1];
    const options = positionalOutput ? args.slice(2) : args.slice(1);
    const bump = optionValue(options, "--bump") ?? "patch";
    if (!isVersionBump(bump)) throw new Error(`--bump 只接受 major、minor、patch、none：${bump}`);
    const output = positionalOutput ?? defaultOutputPath(workspace);
    const result = await packPbresWorkspace({
      workspacePath: workspace,
      outputPath: output,
      bump,
      overwrite: options.includes("--force"),
    });
    console.log(`已封包：${result.outputPath}`);
    console.log(`版本：${result.document.package.version}`);
    console.log(`摘要：${result.document.snapshotDigest}`);
  } else {
    printUsage();
    process.exitCode = command ? 1 : 0;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return required(args[index + 1], `${name} 缺少参数`);
}

function isVersionBump(value: string): value is PbresVersionBump {
  return value === "major" || value === "minor" || value === "patch" || value === "none";
}

function defaultWorkspacePath(source: string): string {
  const resolved = path.resolve(source);
  const extension = path.extname(resolved).toLowerCase() === ".pbres" ? ".pbres" : "";
  return `${resolved.slice(0, resolved.length - extension.length)}.unpacked`;
}

function defaultOutputPath(workspace: string): string {
  const resolved = path.resolve(workspace);
  const suffix = ".unpacked";
  const base = resolved.toLowerCase().endsWith(suffix)
    ? resolved.slice(0, -suffix.length)
    : resolved;
  return `${base}.repacked.pbres`;
}

function printUsage(): void {
  console.log(`用法：
  npm run pbres:unpack -- <包.pbres> [解包目录]
  npm run pbres:pack -- <解包目录> [输出.pbres] [--bump patch|minor|major|none] [--force]

默认行为：
  unpack 输出到 <包名>.unpacked
  pack 输出到 <包名>.repacked.pbres，并自动升 patch 版本`);
}
