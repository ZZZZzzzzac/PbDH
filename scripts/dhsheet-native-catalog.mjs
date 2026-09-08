import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

export async function readDhSheetNativeCards(source, output) {
  await mkdir(output, { recursive: true });
  const types = ["profession", "subclass", "ancestry", "community", "domain", "variant"];
  const contents = [
    `import pack from ${JSON.stringify(path.join(source, "data/cards/builtin-base.json"))};`,
    ...types.map((type) => `import { ${type}CardConverter } from ${JSON.stringify(path.join(source, `card/${type}-card/convert.ts`))};`),
    "console.log = (...args) => console.error(...args);",
    `const cards = [${types.map((type) => `...(pack.${type} || []).map((card) => ${type}CardConverter.toStandard(card))`).join(",")}];`,
    'process.stdout.write(JSON.stringify(cards.map((card) => ({ ...card, ruleset: "daggerheart", batchId: "SYSTEM_BUILTIN_CARDS", source: "builtin" }))));',
  ].join("\n");
  const file = path.join(output, "upstream-native-cards.cjs");
  await build({ stdin: { contents, resolveDir: source, loader: "ts" }, bundle: true, platform: "node", format: "cjs", outfile: file,
    alias: { "@": source }, nodePaths: [path.resolve("node_modules"), path.resolve(".scratch/dhsheet-interop/deps/node_modules")] });
  return JSON.parse(execFileSync(process.execPath, [file], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }));
}

export function nativeCardIdentity(card) {
  // 只复制身份和卡面元数据；规则正文继续来自角色持有的 PbDH 资源副本。
  const keys = ["id", "name", "type", "class", "level", "headerDisplay", "cardSelectDisplay", "variantSpecial", "ruleset", "batchId", "source"];
  return Object.fromEntries(keys.filter((key) => card[key] !== undefined).map((key) => [key, card[key]]));
}

export async function buildDhSheetSourceLabelProbe(source, output, nativeCardsPath) {
  const functions = [];
  for (const file of ["selectable-card.tsx", "image-card.tsx"]) {
    const text = await readFile(path.join(source, "components/ui", file), "utf8");
    const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const statement = parsed.statements.find((item) => ts.isVariableStatement(item) && item.declarationList.declarations.some((declaration) => declaration.name.getText(parsed) === "getCardSourceDisplayName"));
    if (!statement) throw new Error(`${file} 的来源显示函数已变化，请重新审计`);
    const helper = parsed.statements.find((item) => ts.isVariableStatement(item) && item.declarationList.declarations.some((declaration) => declaration.name.getText(parsed) === "hasSourceInfo"));
    functions.push(`(() => { ${helper?.getText(parsed) || ""} ${statement.getText(parsed)}; return getCardSourceDisplayName; })()`);
  }
  const file = path.join(output, "upstream-source-label.cjs");
  const contents = `import { readFileSync } from 'node:fs';
import { CardSource } from ${JSON.stringify(path.join(source, "card/card-types.ts"))};
const native = new Map(JSON.parse(readFileSync(${JSON.stringify(nativeCardsPath)}, 'utf8')).map((card) => [card.id, card]));
const getStandardCardById = (id) => native.get(id);
const getBatchName = () => undefined;
const readers = [${functions.join(",")}];
const cards = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(readers.map((reader) => cards.map(reader))));`;
  await build({ stdin: { contents, resolveDir: source, loader: "ts" }, bundle: true, platform: "node", format: "cjs", outfile: file, alias: { "@": source }, nodePaths: [path.resolve("node_modules"), path.resolve(".scratch/dhsheet-interop/deps/node_modules")] });
  return file;
}
