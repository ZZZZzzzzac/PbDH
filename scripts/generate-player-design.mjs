import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "docs/design/player-app.op");
const outputPath = path.join(root, "apps/player/src/resource-manager/design.generated.ts");
const document = JSON.parse(readFileSync(sourcePath, "utf8"));

function descendants(node) {
  return [node, ...(node.children ?? []).flatMap(descendants)];
}

function unique(nodes, name) {
  const matches = nodes.filter((node) => node.name === name);
  if (matches.length !== 1) {
    throw new Error(`Expected one node named ${JSON.stringify(name)}, found ${matches.length}`);
  }
  return matches[0];
}

function solid(node, property = "fill") {
  const paint = node[property]?.fill?.[0] ?? node[property]?.[0];
  if (!paint || paint.type !== "solid" || typeof paint.color !== "string") {
    throw new Error(`${node.name ?? node.id} needs one solid ${property}`);
  }
  return paint.color;
}

const managerPage = unique(document.pages, "10 Resource Manager");
const managerNodes = descendants(managerPage);
const manager = unique(managerNodes, "Player / Resource Manager / Creator 风格 / 大型多类型资源包");
const managerBar = unique(managerNodes, "资源管理器 / 顶栏");
const managerBody = unique(managerNodes, "资源管理器 / 主体");
const packageList = unique(managerNodes, "资源管理器 / 资源包列表");
const packageDetail = unique(managerNodes, "资源管理器 / 资源包详情");
const primaryButton = unique(managerNodes, "资源管理器 / 安装资源包");
const selectedPackage = unique(managerNodes, "资源包列表 / 荒野遭遇集");
const successState = unique(managerNodes, "资源包详情 / 离线状态");

const dialogPage = unique(document.pages, "20 Dialogs & Menus");
const dialogNodes = descendants(dialogPage);
const dialogs = unique(dialogNodes, "Player / Resource Manager / 弹窗变体 / Creator 风格");
const installDialog = unique(dialogNodes, "资源包安装确认");
const installDialogBar = unique(dialogNodes, "资源包安装确认 / 标题栏");
const installPrimary = unique(dialogNodes, "安装确认 / 安装");
const invalidState = unique(dialogNodes, "无效资源包 / 错误摘要");

if (manager.layout !== "vertical" || managerBody.layout !== "horizontal" || packageList.width !== 330) {
  throw new Error("Player Resource Manager must retain the reviewed large-package layout");
}
if (manager.width !== 1160 || manager.height !== 850 || managerBar.height !== 64) {
  throw new Error("Player Resource Manager dimensions no longer match the reviewed design");
}
if (installDialog.width !== 660 || installDialog.children.some((node) => node.name.endsWith("副标题"))) {
  throw new Error("Player dialogs must keep the reviewed compact title-only header");
}

const generated = `// 此文件由 scripts/generate-player-design.mjs 从 docs/design/player-app.op 生成，禁止手改。\n\nexport const playerResourceManagerDesign = ${JSON.stringify({
  document: "docs/design/player-app.op",
  page: managerPage.name,
  frame: manager.name,
  canvas: { background: solid(dialogs) },
  manager: {
    width: manager.width,
    height: manager.height,
    radius: manager.cornerRadius,
    background: solid(manager),
    border: solid(manager, "stroke"),
  },
  bar: { height: managerBar.height, background: solid(managerBar) },
  columns: { packageListWidth: packageList.width, detailWidth: packageDetail.width },
  panel: { background: solid(packageList), border: solid(packageList, "stroke") },
  selected: { background: solid(selectedPackage), accent: solid(selectedPackage, "stroke") },
  primary: { background: solid(primaryButton), text: solid(primaryButton.children.at(-1)) },
  success: { background: solid(successState), text: solid(successState.children[0]) },
  dialog: {
    width: installDialog.width,
    radius: installDialog.cornerRadius,
    background: solid(installDialog),
    barBackground: solid(installDialogBar),
    primaryBackground: solid(installPrimary),
    errorBackground: solid(invalidState),
    errorText: solid(invalidState.children[0]),
  },
}, null, 2)} as const;\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(outputPath, "utf8") !== generated) {
    throw new Error("Generated Player Resource Manager design is stale. Run npm run generate:design");
  }
} else {
  writeFileSync(outputPath, generated, "utf8");
}
