// 仓库以 LF 为唯一权威行尾（见 .gitattributes）。
// CI 与 Windows 工作区必须得到同一份字节：一旦工作区出现 CRLF，内容摘要、快照与
// 文本比对就会在平台之间漂移，表现为「本地通过、CI 摘要不一致」这类难查的失败。
// 默认只检查并列出文件；--fix 就地改回 LF，只动行尾、不改内容。
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const fix = process.argv.includes("--fix");
const root = run(["rev-parse", "--show-toplevel"]).trim();
if (!root) {
  console.log("Line endings skipped: 当前目录不是 git 工作区。");
  process.exit(0);
}

const listing = run(["ls-files", "--eol"], root);
const textFiles = [];
const violations = [];
for (const line of listing.split("\n")) {
  const [meta, file] = line.split("\t");
  if (!meta || !file) continue;
  const columns = /^(i\/\S+)\s+(w\/\S+)\s+(.*)$/.exec(meta);
  if (!columns) continue;
  const [, , worktree, attributes] = columns;
  if (attributes.includes("eol=crlf")) continue;
  if (worktree === "w/-text" || worktree === "w/none" || worktree === "w/") continue;
  textFiles.push(file);
  if (worktree === "w/lf") continue;
  violations.push(file);
}

if (violations.length === 0) {
  console.log(`Line endings OK（${textFiles.length} 个跟踪文本文件均为 LF）。`);
  process.exit(0);
}

if (!fix) {
  console.error(`发现 CRLF 行尾（应为 LF）：${violations.length} 个文件`);
  for (const file of violations.slice(0, 20)) console.error(`  ${file}`);
  if (violations.length > 20) console.error(`  …其余 ${violations.length - 20} 个`);
  console.error("修复：npm run fix:line-endings");
  process.exit(1);
}

for (const file of violations) {
  const target = path.join(root, file);
  writeFileSync(target, readFileSync(target).toString("latin1").replace(/\r\n?/gu, "\n"), "latin1");
}
console.log(`已改回 LF：${violations.length} 个文件（内容未变，仅行尾）。`);

function run(args, cwd) {
  try {
    return execFileSync("git", args, { encoding: "utf8", cwd: cwd ?? process.cwd(), stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}
