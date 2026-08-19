import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "docs/design/creator-app.op");
const outputPath = path.join(
  root,
  "packages/templates/src/frontend/adversary/1.0.0-alpha.1/design.generated.ts",
);
const workspaceOutputPath = path.join(
  root,
  "apps/creator/src/workspace-prototype/design.generated.ts",
);
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

function child(node, name) {
  return unique(node.children ?? [], name);
}

function solid(node, property = "fill") {
  const paint = node[property]?.fill?.[0] ?? node[property]?.[0];
  if (!paint || paint.type !== "solid" || typeof paint.color !== "string") {
    throw new Error(`${node.name ?? node.id} needs one solid ${property}`);
  }
  return paint.color;
}

function number(node, property) {
  const value = node[property];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${node.name ?? node.id}.${property} must be a finite number`);
  }
  return value;
}

const mm = (value) => `${Number((value / 4).toFixed(3))}mm`;
const cssFont = (node) => `${node.fontWeight ?? 400} ${mm(number(node, "fontSize"))}/${node.lineHeight ?? 1.2} ${JSON.stringify(node.fontFamily ?? "Noto Sans SC")}, sans-serif`;
const padding = (values) => values.map(mm).join(" ");

const page = unique(document.pages, "30 Components");
const pageNodes = descendants(page);
const surface = unique(pageNodes, "#28 / Canonical Card Surface");
const surfaceNodes = descendants(surface);
const card = unique(surfaceNodes, "enemy-card-r1 / Canonical");
const weaponCard = unique(pageNodes, "weapon-card-r1 / Canonical");

if (card.role !== "card" || card.layout !== "vertical" || card.clipContent !== true) {
  throw new Error("enemy-card-r1 / Canonical must remain a clipped vertical card");
}

const art = child(card, "卡面 / 敌人插图");
const overlay = child(art, "插图 / 标题暗色渐隐");
const kicker = child(art, "标题 / 位阶和种类");
const title = child(art, "标题 / 中文名");
const originalTitle = child(art, "标题 / 英文名");
const summary = child(art, "标题 / 简介");
const body = child(card, "卡面 / 规则正文");
const brief = child(body, "规则 / 简报与核心数据");
const motives = child(brief, "规则 / 动机与经历");
const motiveText = child(motives, "动机与经历 / 动机与战术");
const experienceText = child(motives, "动机与经历 / 经历");
const stats = child(brief, "规则 / 核心数据");
const attack = child(body, "规则 / 攻击");
const state = child(body, "规则 / 状态轨道");
const featureHeader = child(body, "特性 / 分区标题");
const features = child(body, "规则 / 敌人特性");

const featureNames = features.children.map((node) => node.name);
const expectedFeatureNames = ["特性 / 蓄力", "特性 / 蛮牛冲撞", "特性 / 角撞"];
if (JSON.stringify(featureNames) !== JSON.stringify(expectedFeatureNames)) {
  throw new Error(`Feature rows must be ${expectedFeatureNames.join(", ")}`);
}

const featureRow = features.children[0];
const featureHeading = featureRow.children[0];
const featureBody = featureRow.children[1];
const featureName = featureHeading.children[0];
const featureMeta = featureHeading.children[1];
const featureHeaderText = child(featureHeader, "特性 / 分区标题 / 文字");
const featureHeaderLine = child(featureHeader, "特性 / 分区标题 / 分隔线");
const attackText = child(attack, "攻击 / 武器与范围");
const hpRow = child(state, "状态 / HP");
const stressRow = child(state, "状态 / 压力");
const hpLabel = child(hpRow, "状态 / HP / 标签底");
const hpText = child(hpLabel, "状态 / HP / 标签");
const stressLabel = child(stressRow, "状态 / 压力 / 标签底");
const stressText = child(stressLabel, "状态 / 压力 / 标签");
const hpMarkers = hpRow.children.filter((node) => node.type === "icon_font");
const stressMarkers = stressRow.children.filter((node) => node.type === "icon_font");

if (hpMarkers.length === 0 || stressMarkers.length === 0) {
  throw new Error("Canonical state tracks need HP and stress icon markers");
}

const artInnerWidth = number(card, "width") - (number(card.stroke, "thickness") * 2);
const overlayStart = Number(((number(overlay, "y") / number(art, "height")) * 100).toFixed(2));
const kickerRight = artInnerWidth - number(kicker, "x") - number(kicker, "width");
const titleRight = artInnerWidth - number(title, "x") - number(title, "width");
const statColumns = stats.children.map((node) => number(node, "width")).join("fr ") + "fr";

const css = `
.enemy-card {
  --ink: ${solid(featureBody)};
  --bone: ${solid(card)};
  --oxblood: ${solid(attack)};
  box-sizing: border-box;
  position: relative;
  width: ${mm(number(card, "width"))};
  height: ${mm(number(card, "height"))};
  overflow: hidden;
  background: var(--bone);
  color: #1D1713;
  font-family: ${JSON.stringify(summary.fontFamily)}, sans-serif;
  border: ${mm(number(card.stroke, "thickness"))} solid ${solid(card, "stroke")};
}
.enemy-card.is-fluid { height: auto; min-height: ${mm(number(card, "height"))}; overflow: visible; }
.enemy-art { position: relative; height: ${mm(number(art, "height"))}; overflow: hidden; background: ${solid(art)}; }
.enemy-art img { width: 100%; height: 100%; display: block; object-fit: cover; }
.enemy-art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent ${overlayStart}%, ${solid(overlay)} 100%); }
.enemy-art.is-text-only::after { background: none; }
.enemy-card.is-text .enemy-art { height: 32mm; background: ${solid(overlay)}; }
.enemy-card.is-text .enemy-body { height: calc(${mm(number(card, "height"))} - 32mm); }
.enemy-card.is-text .enemy-kicker { top: 5mm; }
.enemy-card.is-text .enemy-heading h1 { top: 4mm; }
.enemy-card.is-text .enemy-heading .enemy-original-title { top: 13mm; }
.enemy-card.is-text .enemy-heading .enemy-summary { top: 19mm; }
.enemy-card.is-image .enemy-art { height: 100%; }
.enemy-card.is-image .enemy-art::after { display: none; }
.enemy-image-missing { width: 100%; height: 100%; display: grid; place-items: center; color: #F8F3EA; font: 700 4mm/1.3 "Noto Sans SC", sans-serif; }
.enemy-kicker { position: absolute; z-index: 2; right: ${mm(kickerRight)}; top: ${mm(number(kicker, "y"))}; width: ${mm(number(kicker, "width"))}; color: ${solid(kicker)}; font: ${cssFont(kicker)}; text-align: ${kicker.textAlign}; }
.enemy-heading { position: absolute; z-index: 2; inset: 0; pointer-events: none; }
.enemy-heading h1 { position: absolute; left: ${mm(number(title, "x"))}; right: ${mm(titleRight)}; top: ${mm(number(title, "y"))}; margin: 0; color: ${solid(title)}; font: ${cssFont(title)}; }
.enemy-heading .enemy-original-title { position: absolute; left: ${mm(number(originalTitle, "x"))}; top: ${mm(number(originalTitle, "y"))}; margin: 0; color: ${solid(originalTitle)}; font: ${cssFont(originalTitle)}; }
.enemy-heading .enemy-summary { position: absolute; left: ${mm(number(summary, "x"))}; top: ${mm(number(summary, "y"))}; width: ${mm(number(summary, "width"))}; margin: 0; color: ${solid(summary)}; font: ${cssFont(summary)}; font-style: ${summary.fontStyle}; }
.enemy-body { box-sizing: border-box; height: ${mm(number(body, "height"))}; padding: ${padding(body.padding)}; display: flex; flex-direction: column; gap: ${mm(number(body, "gap"))}; }
.enemy-brief { height: ${mm(number(brief, "height"))}; display: flex; align-items: center; gap: ${mm(number(brief, "gap"))}; }
.enemy-motives { box-sizing: border-box; width: ${mm(number(motives, "width"))}; height: ${mm(number(motives, "height"))}; padding: ${padding(motives.padding)}; display: flex; flex-direction: column; justify-content: center; gap: ${mm(number(motives, "gap"))}; color: ${solid(motiveText)}; font: ${cssFont(motiveText)}; background: ${solid(motives)}; border: ${mm(number(motives.stroke, "thickness"))} solid ${solid(motives, "stroke")}; border-radius: ${mm(number(motives, "cornerRadius"))}; }
.enemy-motives p { margin: 0; }
.enemy-motives p + p { color: ${solid(experienceText)}; font: ${cssFont(experienceText)}; }
.enemy-stats { width: ${mm(number(stats, "width"))}; height: ${mm(number(stats, "height"))}; display: grid; grid-template-columns: ${statColumns}; }
.enemy-stat { display: grid; place-content: center; text-align: center; border: ${mm(number(stats.children[0].stroke, "thickness"))} solid ${solid(stats.children[0], "stroke")}; }
.enemy-stat b { font: ${cssFont(stats.children[0].children[0])}; color: ${solid(stats.children[0].children[0])}; }
.enemy-stat span { font: ${cssFont(stats.children[0].children[1])}; color: ${solid(stats.children[0].children[1])}; }
.enemy-attack { box-sizing: border-box; height: ${mm(number(attack, "height"))}; display: flex; align-items: center; padding: ${padding(attack.padding)}; background: ${solid(attack)}; }
.enemy-attack strong { display: block; color: ${solid(attackText)}; font: ${cssFont(attackText)}; }
.enemy-state { height: ${mm(number(state, "height"))}; display: flex; flex-direction: column; gap: ${mm(number(state, "gap"))}; }
.enemy-state-row { height: ${mm(number(hpRow, "height"))}; display: flex; align-items: center; gap: ${mm(number(hpRow, "gap"))}; }
.enemy-state-label { box-sizing: border-box; width: ${mm(number(hpLabel, "width"))}; height: ${mm(number(hpLabel, "height"))}; display: grid; place-items: center; background: ${solid(hpLabel)}; color: ${solid(hpText)}; font: ${cssFont(hpText)}; }
.enemy-state-markers { display: flex; gap: ${mm(number(hpRow, "gap"))}; color: ${solid(hpMarkers[0])}; }
.enemy-state-marker { width: ${mm(number(hpMarkers[0], "width"))}; height: ${mm(number(hpMarkers[0], "height"))}; display: grid; place-items: center; font-size: ${mm(number(hpMarkers[0], "height"))}; line-height: 1; }
.enemy-state-row.is-stress { height: ${mm(number(stressRow, "height"))}; }
.enemy-state-row.is-stress .enemy-state-label { width: ${mm(number(stressLabel, "width"))}; height: ${mm(number(stressLabel, "height"))}; color: ${solid(stressText)}; font: ${cssFont(stressText)}; }
.enemy-state-row.is-stress .enemy-state-markers { gap: ${mm(number(stressRow, "gap"))}; color: ${solid(stressMarkers[0])}; }
.enemy-state-row.is-stress .enemy-state-marker { width: ${mm(number(stressMarkers[0], "width"))}; height: ${mm(number(stressMarkers[0], "height"))}; font-size: ${mm(number(stressMarkers[0], "height") * 0.7)}; }
.enemy-feature-heading { height: ${mm(number(featureHeader, "height"))}; display: flex; align-items: center; gap: ${mm(number(featureHeader, "gap"))}; color: ${solid(featureHeaderText)}; font: ${cssFont(featureHeaderText)}; }
.enemy-feature-heading::after { content: ""; flex: 1; height: ${mm(number(featureHeaderLine, "height"))}; background: ${solid(featureHeaderLine)}; }
.enemy-features { height: ${mm(number(features, "height"))}; display: grid; grid-template-rows: ${features.children.map((node) => mm(number(node, "height"))).join(" ")}; gap: ${mm(number(features, "gap"))}; }
.enemy-feature { box-sizing: border-box; display: grid; grid-template-columns: ${mm(number(featureHeading, "width"))} ${mm(number(featureBody, "width"))}; align-items: start; gap: ${mm(number(featureRow, "gap"))}; padding: ${padding(featureRow.padding)}; overflow: hidden; background: ${solid(featureRow)}; border: ${mm(number(featureRow.stroke, "thickness"))} solid ${solid(featureRow, "stroke")}; border-radius: ${mm(number(featureRow, "cornerRadius"))}; }
.enemy-feature h2 { margin: 0; color: ${solid(featureName)}; font: ${cssFont(featureName)}; }
.enemy-feature h2 small { display: block; color: ${solid(featureMeta)}; font: ${cssFont(featureMeta)}; }
.enemy-feature h2 small span { display: block; }
.enemy-feature p { margin: 0; color: ${solid(featureBody)}; font: ${cssFont(featureBody)}; }
.enemy-card.is-fluid .enemy-body { height: auto; }
.enemy-card.is-fluid .enemy-features { height: auto; grid-template-rows: none; }
.enemy-card.is-fluid .enemy-feature { min-height: ${mm(number(featureRow, "height"))}; }
`;

const generated = `// 此文件由 scripts/generate-adversary-card-design.mjs 从 docs/design/creator-app.op 生成，禁止手改。\n\nexport const adversaryCardDesignSource = ${JSON.stringify({
  document: "docs/design/creator-app.op",
  page: page.name,
  surface: surface.name,
  component: card.name,
  presentation: {
    width: mm(number(card, "width")),
    height: mm(number(card, "height")),
  },
  featureNames,
}, null, 2)} as const;\n\nexport const adversaryRendererStyles = ${JSON.stringify(css.trim())};\n`;

const workspacePage = unique(document.pages, "10 Creator Workspace Rough");
const workspaceNodes = descendants(workspacePage);
const workspace = unique(workspaceNodes, "#30 / Creator Workspace / 敌人编辑");
const appBar = unique(workspaceNodes, "Creator / 顶部应用栏");
const tabs = unique(workspaceNodes, "编辑器 / 资源标签页");
const columns = unique(workspaceNodes, "Creator / 三栏工作区");
const resourceNav = unique(workspaceNodes, "工作区 / 资源导航");
const workspaceBody = unique(workspaceNodes, "工作区 / 内容与预览主体");
const editor = unique(workspaceNodes, "编辑器 / 内容滚动区");
const preview = unique(workspaceNodes, "预览 / Canonical Card Surface");
const appTabMarker = unique(workspaceNodes, "主页面 / 卡片工坊 / 当前标记");
const fieldGroup = unique(workspaceNodes, "字段分组 / 身份与核心数据 / 无标题");
const fieldLabel = unique(workspaceNodes, "字段名 / 名称");
const fieldInput = unique(workspaceNodes, "输入框 / 名称");
const featureEditor = unique(workspaceNodes, "特性编辑 / 蓄力 / 展开");
const featureDescription = unique(workspaceNodes, "输入框 / 特性描述 / 蓄力");
const featureMenuEditor = unique(workspaceNodes, "特性编辑 / 蛮牛冲撞 / 展开");
const featureMenuAnchor = unique(workspaceNodes, "特性更多 / 蛮牛冲撞 / 菜单打开");
const featureMenu = unique(workspaceNodes, "特性子菜单 / 蛮牛冲撞 / 展开");
const modeGroup = unique(workspaceNodes, "预览控件 / 卡面模式");
const activeMode = unique(workspaceNodes, "卡面模式 / 半图半文字 / 当前");
const fixedRatioControl = unique(workspaceNodes, "预览控件 / 固定比例 / 开启");
const fixedRatioSwitch = unique(workspaceNodes, "固定比例 / 开关 / 开启");

const weaponWorkspacePage = unique(document.pages, "12 Creator Weapon Editing");
const weaponWorkspaceNodes = descendants(weaponWorkspacePage);
const weaponWorkspace = unique(weaponWorkspaceNodes, "#37 / Creator Workspace / 主武器编辑");
const weaponColumns = unique(weaponWorkspaceNodes, "Creator / 三栏工作区");
const weaponResourceNav = unique(weaponWorkspaceNodes, "工作区 / 资源导航");
const weaponWorkspaceBody = unique(weaponWorkspaceNodes, "工作区 / 内容与预览主体");
const weaponEditor = unique(weaponWorkspaceNodes, "武器编辑器 / 固定编辑布局");
const weaponNameInput = unique(weaponWorkspaceNodes, "武器输入框 / 名称");
const weaponDescriptionInput = unique(weaponWorkspaceNodes, "武器输入框 / 描述");
const weaponPreview = unique(weaponWorkspaceNodes, "预览 / Canonical Card Surface");

if (columns.layout !== "horizontal" || resourceNav.width !== 250 || workspaceBody.layout !== "horizontal") {
  throw new Error("Creator Workspace must retain the reviewed IDE navigation and editor/preview layout");
}
if (descendants(preview).filter((node) => node.type === "ref" && node.ref === card.id).length !== 1) {
  throw new Error("Creator preview must reference the one Canonical Card Surface");
}
if (number(fieldInput, "height") !== 32 || number(fieldLabel, "fontSize") !== 12) {
  throw new Error("Creator fields must retain the reviewed compact 32px input and 12px label grid");
}
if (featureMenuEditor.height !== 102 || featureMenuAnchor.layout !== "none"
  || featureMenuAnchor.clipContent !== false || featureMenu.y !== 20) {
  throw new Error("Creator feature menu must float without changing the feature editor height");
}
if (weaponColumns.layout !== "horizontal" || weaponResourceNav.width !== resourceNav.width
  || weaponWorkspaceBody.layout !== "horizontal" || weaponEditor.layout !== "vertical"
  || weaponEditor.width !== 560) {
  throw new Error("Creator weapon editing must reuse the reviewed IDE shell and parallel preview layout");
}
if (descendants(weaponPreview).filter((node) => node.type === "ref" && node.ref === weaponCard.id).length !== 1) {
  throw new Error("Creator weapon preview must reference weapon-card-r1 / Canonical exactly once");
}

const workspaceGenerated = `// 此文件由 scripts/generate-adversary-card-design.mjs 从 docs/design/creator-app.op 生成，禁止手改.\n\nexport const creatorWorkspaceDesign = ${JSON.stringify({
  document: "docs/design/creator-app.op",
  page: workspacePage.name,
  frame: workspace.name,
  canonicalSurface: card.name,
  canvas: {
    width: workspace.width,
    height: workspace.height,
    background: solid(workspace),
  },
  appBar: {
    height: appBar.height,
    background: solid(appBar),
    border: solid(appBar, "stroke"),
  },
  tabs: {
    height: tabs.height,
    background: solid(tabs),
    border: solid(tabs, "stroke"),
  },
  columns: {
    gap: columns.gap,
    padding: columns.padding,
    resourceNavigationWidth: resourceNav.width,
    bodyGap: workspaceBody.gap,
    bodyPadding: workspaceBody.padding,
  },
  panel: {
    background: solid(resourceNav),
    border: solid(resourceNav, "stroke"),
    radius: resourceNav.cornerRadius,
  },
  editor: {
    background: solid(editor),
    gap: editor.gap,
    padding: editor.padding,
  },
  preview: {
    background: solid(preview),
    border: solid(preview, "stroke"),
    radius: preview.cornerRadius,
  },
  field: {
    height: fieldInput.height,
    fontSize: fieldLabel.fontSize,
    background: solid(fieldInput),
    border: solid(fieldInput, "stroke"),
    radius: fieldInput.cornerRadius,
    groupBackground: solid(fieldGroup),
    groupBorder: solid(fieldGroup, "stroke"),
    groupRadius: fieldGroup.cornerRadius,
  },
  feature: {
    background: solid(featureEditor),
    border: solid(featureEditor, "stroke"),
    descriptionHeight: featureDescription.height,
  },
  previewControls: {
    height: modeGroup.height,
    background: solid(modeGroup),
    border: solid(modeGroup, "stroke"),
    activeBackground: solid(activeMode),
    fixedRatioBackground: solid(fixedRatioControl),
    switchBackground: solid(fixedRatioSwitch),
  },
  accent: solid(appTabMarker),
  weapon: {
    page: weaponWorkspacePage.name,
    frame: weaponWorkspace.name,
    canonicalSurface: "weapon-card-r1 / Canonical",
    nameInputWidth: weaponNameInput.width,
    descriptionInputHeight: weaponDescriptionInput.height,
  },
}, null, 2)} as const;\n`;

if (process.argv.includes("--check")) {
  const current = readFileSync(outputPath, "utf8");
  if (current !== generated) {
    throw new Error("Generated adversary card design is stale. Run npm run generate:design");
  }
  const currentWorkspace = readFileSync(workspaceOutputPath, "utf8");
  if (currentWorkspace !== workspaceGenerated) {
    throw new Error("Generated Creator Workspace design is stale. Run npm run generate:design");
  }
} else {
  writeFileSync(outputPath, generated, "utf8");
  writeFileSync(workspaceOutputPath, workspaceGenerated, "utf8");
}
