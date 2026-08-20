import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const documents = {
  creator: path.join(root, "docs/design/creator-app.op"),
  player: path.join(root, "docs/design/player-app.op"),
  market: path.join(root, "docs/design/market.op"),
};

function readDocument(key) {
  return JSON.parse(readFileSync(documents[key], "utf8"));
}

function descendants(node) {
  return [node, ...(node.children ?? []).flatMap(descendants)];
}

function findAll(document, predicate) {
  return document.pages.flatMap((page) => (page.children ?? []).flatMap(descendants)).filter(predicate);
}

function adaptNavigationState(rootNode, activeLabel) {
  const navigation = descendants(rootNode).find((node) => node.name === "Platform / 主页面导航");
  if (!navigation) throw new Error("Canonical Platform App Bar is missing Platform / 主页面导航");

  for (const item of navigation.children ?? []) {
    const labelNode = descendants(item).find((node) => node.type === "text" && ["玩家车卡器", "卡片工坊", "GM 桌面", "资源市场"].includes(node.content));
    const indicator = (item.children ?? []).find((node) => node.name?.endsWith("/ 当前标记"));
    if (!labelNode || !indicator) throw new Error(`${item.name} is not a complete main-page navigation item`);
    const active = labelNode.content === activeLabel;
    item.name = `主页面 / ${labelNode.content}${active ? " / 当前" : ""}`;
    labelNode.name = `主页面 / ${labelNode.content} / 文字`;
    labelNode.fontWeight = active ? 750 : 600;
    labelNode.fill = [{ type: "solid", color: active ? "#FFFDF8" : "#C8BCAE" }];
    indicator.name = `主页面 / ${labelNode.content} / 当前标记`;
    indicator.fill = [{ type: "solid", color: active ? "#D65458" : "#21150F" }];
  }
}

function remapIds(rootNode, targetRootId) {
  let serial = 0;
  function visit(node, isRoot = false) {
    node.id = isRoot ? targetRootId : `${targetRootId}-shared-${++serial}`;
    if (node.type === "text") node.locked = false;
    for (const child of node.children ?? []) visit(child);
  }
  visit(rootNode, true);
}

function buildExpected(sourceNode, targetNode, activeLabel) {
  const expected = structuredClone(sourceNode);
  expected.name = "Platform / 共用顶部应用栏";
  expected.role = "navbar";
  for (const property of ["x", "y", "width"]) {
    if (property in targetNode) expected[property] = targetNode[property];
    else delete expected[property];
  }
  adaptNavigationState(expected, activeLabel);
  remapIds(expected, targetNode.id);
  return expected;
}

function buildReplacements(document, sourceNode, targetKey) {
  const replacements = [];
  for (const page of document.pages) {
    function visit(children, ancestors) {
      for (let index = 0; index < (children ?? []).length; index += 1) {
        const node = children[index];
        if (node.name === `Platform + ${targetKey === "player" ? "Player" : "Market"} / 共用顶部应用栏` || node.name === "Platform / 共用顶部应用栏") {
          const activeLabel = targetKey === "player"
            ? "玩家车卡器"
            : ancestors.some((ancestor) => ancestor.name?.includes("Creator / Publish Package"))
              ? "卡片工坊"
              : "资源市场";
          const expected = buildExpected(sourceNode, node, activeLabel);
          replacements.push({ id: node.id, expected });
          children[index] = expected;
          continue;
        }
        visit(node.children, [...ancestors, node]);
      }
    }
    visit(page.children, []);
  }
  if (replacements.length === 0) throw new Error(`No Platform App Bar found in ${targetKey}`);
  return replacements;
}

function findObjectSpan(sourceText, nodeId) {
  const marker = `"id": "${nodeId}"`;
  const markerIndex = sourceText.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Cannot locate ${nodeId} in source text`);
  const start = sourceText.lastIndexOf("{", markerIndex);
  if (start < 0) throw new Error(`Cannot locate object start for ${nodeId}`);

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < sourceText.length; index += 1) {
    const character = sourceText[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1 };
    }
  }
  throw new Error(`Cannot locate object end for ${nodeId}`);
}

function applyRawReplacements(sourceText, replacements) {
  const eol = sourceText.includes("\r\n") ? "\r\n" : "\n";
  const edits = replacements.map(({ id: nodeId, expected }) => {
    const span = findObjectSpan(sourceText, nodeId);
    const lineStart = sourceText.lastIndexOf("\n", span.start) + 1;
    const indentation = sourceText.slice(lineStart, span.start);
    const serialized = JSON.stringify(expected, null, 2)
      .replaceAll("\n", eol)
      .replaceAll(eol, `${eol}${indentation}`);
    return { ...span, serialized };
  }).sort((left, right) => right.start - left.start);

  let result = sourceText;
  for (const edit of edits) result = `${result.slice(0, edit.start)}${edit.serialized}${result.slice(edit.end)}`;
  return result;
}

const creator = readDocument("creator");
const source = findAll(creator, (node) => node.name === "Creator / 顶部应用栏")[0];
if (!source) throw new Error("Creator canonical Platform App Bar was not found");

const requestedTarget = process.argv.find((argument) => argument.startsWith("--target="))?.split("=")[1] ?? "all";
const targets = requestedTarget === "all" ? ["player", "market"] : [requestedTarget];
if (targets.some((target) => !["player", "market"].includes(target))) {
  throw new Error("--target must be player, market, or all");
}

for (const target of targets) {
  const document = readDocument(target);
  const replacements = buildReplacements(document, source, target);
  const current = readFileSync(documents[target], "utf8");
  const expected = applyRawReplacements(current, replacements);
  if (process.argv.includes("--check")) {
    if (current !== expected) throw new Error(`${target} Platform App Bar is stale. Run npm run sync:platform-app-bar`);
  } else {
    writeFileSync(documents[target], expected, "utf8");
    console.log(`Synchronized ${replacements.length} Platform App Bar(s) in ${target}`);
  }
}
