import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { writePbres, type ResourcePackageLogicalDocument } from "../packages/contract-runtime/src/index.ts";

const root = path.resolve("contracts/conformance/resource-package/1.0.0");
const cases = JSON.parse(await readFile(path.join(root, "cases.json"), "utf8")) as Array<{
  document: string;
  media: Array<{ assetId: string; path: string }>;
}>;

for (const fileName of ["minotaur-wrecker", "daggerheart-core-primary-weapon"]) {
  const documentPath = `valid/${fileName}.json`;
  const definition = cases.find((item) => item.document === documentPath);
  if (!definition) throw new Error(`Missing conformance case for ${documentPath}`);
  const document = JSON.parse(await readFile(path.join(root, documentPath), "utf8")) as ResourcePackageLogicalDocument;
  const media = new Map<string, Uint8Array>();
  for (const item of definition.media) media.set(item.assetId, new Uint8Array(await readFile(path.join(root, item.path))));
  await writeFile(path.join(root, "valid", `${fileName}.pbres`), writePbres(document, media));
}
