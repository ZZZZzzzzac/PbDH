import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync, execFileSync } from "node:child_process";
import path from "node:path";
import { readDhSheetNativeCards, buildDhSheetSourceLabelProbe } from "./dhsheet-native-catalog.mjs";

// 对方源码只读；临时桥接制品写入本项目，正式回归仍由根 verify 执行。
const args = process.argv.slice(2);
const sourceArg = args[args.indexOf("--source") + 1];
if (!args.includes("--source") || !sourceArg) throw new Error("需要 --source <dhsheet 源码目录>，可选 --character <PBCHA 文件>");
const source = path.resolve(sourceArg);
const output = path.resolve(".scratch/dhsheet-interop");
await mkdir(output, { recursive: true });
const bridge = path.join(output, "upstream-import.cjs");
await build({
  stdin: {
    contents: `import { readFileSync } from 'node:fs';
import { validateJSONCharacterData } from ${JSON.stringify(path.join(source, "lib/character-data-validator.ts"))};
console.log = (...values) => console.error(...values);
process.stdout.write(JSON.stringify(validateJSONCharacterData(readFileSync(0, 'utf8'))));`,
    resolveDir: source, loader: "ts",
  },
  bundle: true, platform: "node", format: "cjs", outfile: bridge,
  alias: { "@": source }, nodePaths: [path.resolve("node_modules"), path.join(output, "deps/node_modules")],
});
const revision = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const nativeCardsPath = path.join(output, "native-cards.json");
await writeFile(nativeCardsPath, JSON.stringify(await readDhSheetNativeCards(source, output)));
const sourceLabelProbe = await buildDhSheetSourceLabelProbe(source, output, nativeCardsPath);
await writeFile(path.join(output, "upstream.json"), JSON.stringify({ source, revision }, null, 2));
const character = args.includes("--character") ? path.resolve(args[args.indexOf("--character") + 1]) : "";
const reference = args.includes("--reference") ? path.resolve(args[args.indexOf("--reference") + 1]) : "";
const original = args.includes("--original") ? path.resolve(args[args.indexOf("--original") + 1]) : "";
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/player/dhsheet-interop.test.ts"], {
  stdio: "inherit", env: { ...process.env, PBDH_DHSHEET_BRIDGE: bridge, PBDH_INTEROP_CHARACTER: character, PBDH_DHSHEET_NATIVE_CARDS: nativeCardsPath, PBDH_DHSHEET_SOURCE_LABELS: sourceLabelProbe, PBDH_DHSHEET_REFERENCE: reference, PBDH_DHSHEET_ORIGINAL: original, PBDH_WRITE_INTEROP_SAMPLES: "1" },
});
process.exitCode = result.status ?? 1;
