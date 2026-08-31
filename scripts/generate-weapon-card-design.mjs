import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "docs/design/creator-app.op");
const outputPath = path.join(
  root,
  "packages/templates/src/frontend/weapon/1.0.0/design.generated.ts",
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

const designUnit = (value) => `${Number((value / 4).toFixed(3))}px`;
const cssFont = (node) => `${node.fontWeight ?? 400} ${designUnit(number(node, "fontSize"))}/${node.lineHeight ?? 1.2} ${JSON.stringify(node.fontFamily ?? "Noto Sans SC")}, sans-serif`;
const padding = (values) => values.map(designUnit).join(" ");

const page = unique(document.pages, "30 Components");
const pageNodes = descendants(page);
const surface = unique(pageNodes, "#28 / Canonical Card Surface");
const surfaceNodes = descendants(surface);
const card = unique(surfaceNodes, "weapon-card-r1 / Canonical");

if (card.role !== "card" || card.layout !== "vertical" || card.clipContent !== true) {
  throw new Error("weapon-card-r1 / Canonical must remain a clipped vertical card");
}

const header = child(card, "卡面 / 武器标题");
const meta = child(header, "标题 / 类型与位阶");
const typeText = child(meta, "标题 / 类型");
const tierText = child(meta, "标题 / 位阶");
const title = child(header, "标题 / 名称");
const summary = child(header, "标题 / 规则摘要");
const body = child(card, "卡面 / 武器规则");
const stats = child(body, "规则 / 核心数据");
const stat = child(stats, "核心数据 / 属性");
const statValue = child(stat, "核心数据 / 属性 / 数值");
const statLabel = child(stat, "核心数据 / 属性 / 标签");
const details = child(body, "规则 / 伤害与负荷");
const detail = child(details, "规则 / 伤害类型");
const detailLabel = child(detail, "伤害类型 / 标签");
const detailValue = child(detail, "伤害类型 / 数值");
const description = child(body, "规则 / 描述");
const descriptionTitle = child(description, "描述 / 标题");
const descriptionLine = child(description, "描述 / 分隔线");
const descriptionBody = child(description, "描述 / 正文");
const footer = child(body, "卡面 / 页脚");

const expectedStatNames = ["核心数据 / 属性", "核心数据 / 距离", "核心数据 / 伤害"];
if (JSON.stringify(stats.children.map((node) => node.name)) !== JSON.stringify(expectedStatNames)) {
  throw new Error(`Weapon stat cells must be ${expectedStatNames.join(", ")}`);
}
const expectedDetailNames = ["规则 / 伤害类型", "规则 / 负荷"];
if (JSON.stringify(details.children.map((node) => node.name)) !== JSON.stringify(expectedDetailNames)) {
  throw new Error(`Weapon detail cells must be ${expectedDetailNames.join(", ")}`);
}

const css = `
.weapon-card {
  --weapon-ink: ${solid(descriptionBody)};
  --weapon-bone: ${solid(card)};
  --weapon-oxblood: ${solid(detail)};
  box-sizing: border-box;
  width: ${designUnit(number(card, "width"))};
  height: ${designUnit(number(card, "height"))};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--weapon-bone);
  color: var(--weapon-ink);
  font-family: ${JSON.stringify(title.fontFamily)}, sans-serif;
  border: ${designUnit(number(card.stroke, "thickness"))} solid ${solid(card, "stroke")};
}
.weapon-card.is-fluid { height: auto; min-height: ${designUnit(number(card, "height"))}; overflow: visible; }
.weapon-art { box-sizing: border-box; width: 100%; height: 42px; flex: none; overflow: hidden; display: grid; place-items: center; background: ${solid(header)}; }
.weapon-art img { width: 100%; height: 100%; object-fit: cover; }
.weapon-art.is-image-only { height: 100%; }
.weapon-image-missing { color: ${solid(typeText)}; font: ${cssFont(summary)}; }
.weapon-card.is-split .weapon-body { height: 67px; }
.weapon-header { box-sizing: border-box; height: ${designUnit(number(header, "height"))}; display: flex; flex-direction: column; gap: ${designUnit(number(header, "gap"))}; padding: ${padding(header.padding)}; background: ${solid(header)}; }
.weapon-meta { height: ${designUnit(number(meta, "height"))}; display: flex; align-items: center; justify-content: space-between; }
.weapon-type { width: ${designUnit(number(typeText, "width"))}; color: ${solid(typeText)}; font: ${cssFont(typeText)}; }
.weapon-tier { width: ${designUnit(number(tierText, "width"))}; color: ${solid(tierText)}; font: ${cssFont(tierText)}; text-align: ${tierText.textAlign}; }
.weapon-title { width: 100%; margin: 0; color: ${solid(title)}; font: ${cssFont(title)}; }
.weapon-summary { width: 100%; margin: 0; color: ${solid(summary)}; font: ${cssFont(summary)}; }
.weapon-body { box-sizing: border-box; height: ${designUnit(number(body, "height"))}; display: flex; flex-direction: column; gap: ${designUnit(number(body, "gap"))}; padding: ${padding(body.padding)}; }
.weapon-stats { height: ${designUnit(number(stats, "height"))}; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: ${designUnit(number(stats, "gap"))}; }
.weapon-stat { box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: ${designUnit(number(stat, "gap"))}; padding: ${padding(stat.padding)}; background: ${solid(stat)}; border: ${designUnit(number(stat.stroke, "thickness"))} solid ${solid(stat, "stroke")}; }
.weapon-stat b { width: 100%; color: ${solid(statValue)}; font: ${cssFont(statValue)}; text-align: ${statValue.textAlign}; }
.weapon-stat span { width: 100%; color: ${solid(statLabel)}; font: ${cssFont(statLabel)}; text-align: ${statLabel.textAlign}; }
.weapon-details { height: ${designUnit(number(details, "height"))}; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${designUnit(number(details, "gap"))}; }
.weapon-detail { box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; padding: ${padding(detail.padding)}; background: ${solid(detail)}; }
.weapon-detail span { color: ${solid(detailLabel)}; font: ${cssFont(detailLabel)}; }
.weapon-detail b { color: ${solid(detailValue)}; font: ${cssFont(detailValue)}; text-align: ${detailValue.textAlign}; }
.weapon-description { box-sizing: border-box; min-height: 0; flex: 1; display: flex; flex-direction: column; gap: ${designUnit(number(description, "gap"))}; padding: ${padding(description.padding)}; overflow: hidden; background: ${solid(description)}; border: ${designUnit(number(description.stroke, "thickness"))} solid ${solid(description, "stroke")}; }
.weapon-description h2 { margin: 0; color: ${solid(descriptionTitle)}; font: ${cssFont(descriptionTitle)}; }
.weapon-description hr { width: 100%; height: ${designUnit(number(descriptionLine.stroke, "thickness"))}; margin: 0; border: 0; background: ${solid(descriptionLine, "stroke")}; }
.weapon-description p { margin: 0; color: ${solid(descriptionBody)}; font: ${cssFont(descriptionBody)}; }
.weapon-footer { margin: 0; color: ${solid(footer)}; font: ${cssFont(footer)}; text-align: ${footer.textAlign}; }
.weapon-card.is-fluid .weapon-body { height: auto; }
.weapon-card.is-fluid .weapon-description { min-height: 62.5px; overflow: visible; }
`;

const generated = `// 此文件由 scripts/generate-weapon-card-design.mjs 从 docs/design/creator-app.op 生成，禁止手改。\n\nexport const weaponCardDesignSource = ${JSON.stringify({
  document: "docs/design/creator-app.op",
  page: page.name,
  surface: surface.name,
  component: card.name,
  presentation: {
    width: designUnit(number(card, "width")),
    height: designUnit(number(card, "height")),
  },
  statNames: expectedStatNames,
  detailNames: expectedDetailNames,
}, null, 2)} as const;\n\nexport const weaponRendererStyles = ${JSON.stringify(css.trim())};\n`;

if (process.argv.includes("--check")) {
  const current = readFileSync(outputPath, "utf8").replaceAll("\r\n", "\n");
  if (current !== generated) {
    throw new Error("Generated weapon card design is stale. Run npm run generate:design");
  }
} else {
  writeFileSync(outputPath, generated, "utf8");
}
