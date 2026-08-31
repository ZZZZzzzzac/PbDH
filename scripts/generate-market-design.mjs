import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "docs/design/market.op");
const outputPath = path.join(root, "apps/market/design.generated.ts");
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

const expectedPages = [
  "00 PRD Coverage",
  "01 User Flows",
  "10 Market Discovery & Publication",
  "11 States & Handoffs",
  "20 Dialogs & Menus",
  "30 Components",
];

if (JSON.stringify(document.pages.map((page) => page.name)) !== JSON.stringify(expectedPages)) {
  throw new Error("Market OpenPencil pages no longer match the reviewed #33 design structure");
}

const allNodes = document.pages.flatMap(descendants);
const discovery = unique(allNodes, "#33-US / Market / Discovery / Desktop");
const detail = unique(allNodes, "#33-US / Market / Publication Detail / Enemy / Available");
const publish = unique(allNodes, "#33-US / Creator / Publish Package / Ready");
const lifecycle = unique(allNodes, "#33 / Market / Lifecycle & Handoff States");
const responsive = unique(allNodes, "#33 / Market / Responsive");
const dialogs = unique(allNodes, "#33 / Market / Dialogs & Menus");
const components = unique(allNodes, "#33 / Market / Components");

for (const screen of [discovery, detail, publish]) {
  if (screen.width !== 1440 || screen.height !== 1024) {
    throw new Error(`${screen.name} must remain a 1440×1024 desktop review frame`);
  }
}

const mobileFrames = [
  unique(allNodes, "#33-US / Market / Discovery / Mobile"),
  unique(allNodes, "#33-US / Market / Publication Detail / Mobile"),
  unique(allNodes, "#33-US / Market / Acquisition Actions / Mobile"),
];
if (mobileFrames.some((node) => node.width !== 390 || node.height !== 844)) {
  throw new Error("Market mobile review frames must remain 390×844");
}

const requiredAcquisitionActions = [
  "Publication 详情 / 下载完整包",
  "Publication 详情 / 安装到玩家",
  "Publication 详情 / 导入卡片工坊",
  "Publication 详情 / 发送到桌面",
];
for (const name of requiredAcquisitionActions) unique(allNodes, name);

const menuChildren = dialogs.children ?? [];
const filterMenuIndex = menuChildren.findIndex((node) => node.name === "Market 筛选菜单 / Template / 展开");
const submenuIndex = menuChildren.findIndex((node) => node.name === "GM 交接 / 资源级联菜单 / 子菜单");
const mainMenuIndex = menuChildren.findIndex((node) => node.name === "GM 交接 / 资源级联菜单 / 主菜单");
if (filterMenuIndex < 0 || filterMenuIndex >= submenuIndex) {
  throw new Error("Market checkbox filter menu must remain above the other floating menus in OpenPencil z-order");
}
if (submenuIndex < 0 || mainMenuIndex < 0 || submenuIndex >= mainMenuIndex) {
  throw new Error("GM handoff submenu must remain above the main menu in OpenPencil z-order");
}

const discoveryNodes = descendants(discovery);
if (discovery.children?.some((node) => node.name === "Market / 搜索与筛选工具栏")) {
  throw new Error("Market discovery must not keep a duplicate top search and filter toolbar");
}
const sidebar = unique(discoveryNodes, "Market / 筛选栏");
if (sidebar.width !== 250) {
  throw new Error("Market desktop filter sidebar must remain 250px wide");
}
const desktopSearches = discoveryNodes.filter((node) => node.role === "search-bar");
if (desktopSearches.length !== 1 || desktopSearches[0].name !== "Market / 左侧 Publication 搜索") {
  throw new Error("Market desktop discovery must keep exactly one search field in the left sidebar");
}

const filterMenu = unique(allNodes, "Market 筛选菜单 / Template / 展开");
const filterCheckboxes = descendants(filterMenu).filter((node) => node.type === "checkbox");
if (filterCheckboxes.length < 4 || filterCheckboxes.filter((node) => node.checked).length < 2) {
  throw new Error("Market filter menu must demonstrate checkbox multi-select");
}

const publicationTitles = ["荒野遭遇集", "铁与誓言", "边境怪谈", "佣兵军械库"];
const publicationCards = publicationTitles.map((title) => unique(allNodes, `Publication 卡片 / ${title}`));
const publicationCardWidth = publicationCards[0].width;
for (const card of publicationCards) {
  if (card.width !== publicationCardWidth || card.height !== 270 || card.layout !== "horizontal") {
    throw new Error(`${card.name} must follow the reviewed 荒野遭遇集 card layout`);
  }
  const cover = unique(descendants(card), `${card.name} / Publication 封面`);
  const coverImage = unique(descendants(card), `${card.name} / Resource Package Asset / 封面`);
  if (Math.abs(cover.width / cover.height - 63 / 88) > 0.0001 || coverImage.objectFit !== "crop") {
    throw new Error(`${card.name} cover must keep a cropped 63:88 Resource Package Asset`);
  }
  const usableWidth = card.width - 2 * card.padding - card.gap;
  const coverShare = cover.width / usableWidth;
  if (coverShare < 0.45 || coverShare > 0.55) {
    throw new Error(`${card.name} cover and text regions must each use roughly half of the card`);
  }
}

for (const title of ["荒野遭遇集", "铁与誓言"]) {
  const card = unique(allNodes, `Market Mobile / ${title}`);
  const cover = unique(descendants(card), `Market Mobile / ${title} / Publication 封面`);
  const coverImage = unique(
    descendants(card),
    `Market Mobile / ${title} / Resource Package Asset / 封面`,
  );
  if (Math.abs(cover.width / cover.height - 63 / 88) > 0.0001 || coverImage.objectFit !== "crop") {
    throw new Error(`${card.name} cover must keep a cropped 63:88 Resource Package Asset`);
  }
}

unique(allNodes, "Creator 发布 / 上传封面");
unique(allNodes, "Publication 详情 / Publication 封面");

const textNodes = allNodes.filter((node) => node.type === "text");
const invalidText = textNodes.find((node) => node.name === "Text" || node.locked !== false || typeof node.content !== "string");
if (invalidText) {
  throw new Error(`${invalidText.id} must keep a semantic name and editable text content`);
}

const appBars = allNodes.filter((node) => node.name === "Platform / 共用顶部应用栏");
if (appBars.length < 4 || appBars.some((node) => node.height !== 56 || solid(node) !== "#1B1714")) {
  throw new Error("Market desktop screens must reuse the 56px shared Platform App Bar");
}

const generated = `// 此文件由 scripts/generate-market-design.mjs 从 docs/design/market.op 生成，禁止手改。\n\nexport const marketDesignSource = ${JSON.stringify({
  document: "docs/design/market.op",
  issue: 33,
  pages: expectedPages,
  desktop: {
    width: discovery.width,
    height: discovery.height,
    discovery: discovery.name,
    detail: detail.name,
    creatorPublish: publish.name,
  },
  mobile: {
    width: mobileFrames[0].width,
    height: mobileFrames[0].height,
    frames: mobileFrames.map((node) => node.name),
  },
  states: lifecycle.name,
  responsive: responsive.name,
  dialogs: dialogs.name,
  components: components.name,
  appBar: {
    height: appBars[0].height,
    background: solid(appBars[0]),
  },
  acquisitionActions: requiredAcquisitionActions,
  publicationCoverSource: "Resource Package Asset / 63:88 crop",
  canonicalSurfaceSource: "docs/design/creator-app.op / #28 Canonical Card Surface / single resource preview only",
}, null, 2)} as const;\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(outputPath, "utf8").replaceAll("\r\n", "\n") !== generated) {
    throw new Error("Generated Market design mapping is stale. Run npm run generate:design");
  }
} else {
  writeFileSync(outputPath, generated, "utf8");
}
