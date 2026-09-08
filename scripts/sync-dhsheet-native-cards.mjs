import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { readDhSheetNativeCards, nativeCardIdentity } from "./dhsheet-native-catalog.mjs";

const source = path.resolve(process.argv[2] || "../DaggerHeart-CharacterSheet");
const cards = await readDhSheetNativeCards(source, path.resolve(".scratch/dhsheet-interop"));
if (new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error("上游原生卡 ID 不唯一");
const commit = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const target = "apps/player/public/system-packages/daggerheart-core/adapters/scripts/character-export.js";
const start = "// BEGIN DHSHEET NATIVE IDENTITIES";
const end = "// END DHSHEET NATIVE IDENTITIES";
const block = `${start}\n// 来源：dqqql/DaggerHeart-CharacterSheet ${commit}; data/cards/builtin-base.json + card/*-card/convert.ts\n// 生成：node scripts/sync-dhsheet-native-cards.mjs <上游源码目录>\nconst dhSheetNativeCards = [\n${cards.map((card) => `  ${JSON.stringify(nativeCardIdentity(card))},`).join("\n")}\n];\n${end}\n`;
const previous = await readFile(target, "utf8");
const next = previous.includes(start) ? previous.slice(0, previous.indexOf(start)) + block + previous.slice(previous.indexOf(end) + end.length).replace(/^\r?\n/u, "") : block + previous;
await writeFile(target, next);
console.log(`同步 ${cards.length} 张原生卡身份（${commit}）`);
