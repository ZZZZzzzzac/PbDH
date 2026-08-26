import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import { describe, expect, test } from "vitest";

import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import {
  ContractRuntime,
  loadPbres,
  validateSystemPackageSemantics,
  type ContractCatalog,
  type SystemPackageDocument,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();
const packageRoot = path.join(
  root,
  "apps/player/public/system-packages/daggerheart-core",
);

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

const catalog = readJson<ContractCatalog>(path.join(root, "contracts/catalog.json"));
const schemas = Object.fromEntries(catalog.families.flatMap((family) =>
  family.versions.map((version) => [
    version.schema,
    readJson<AnySchema>(path.join(root, "contracts", version.schema)),
  ])));
const runtime = new ContractRuntime(catalog, schemas);

describe("migrated Daggerheart Core System Package", () => {
  test("uses valid native Resource Packages split by System Package library", async () => {
    const system = readJson<SystemPackageDocument>(path.join(packageRoot, "system.json"));
    expect(runtime.validate({
      family: "system-package",
      version: system.contractVersion,
      mode: "development",
      candidate: system,
    })).toEqual([]);
    expect(validateSystemPackageSemantics(system)).toEqual([]);
    expect(system.embeddedResources).toHaveLength(8);

    const candidates = [];
    for (const embedded of system.embeddedResources) {
      const archive = new Uint8Array(readFileSync(path.join(packageRoot, ...embedded.path.split("/"))));
      expect(archive.byteLength).toBeLessThanOrEqual(16 * 1024 * 1024);
      const loaded = await loadPbres(archive, validateResourcePackageCandidate);
      expect(loaded.diagnostics).toEqual([]);
      expect(loaded.candidate?.document.snapshotDigest).toBe(embedded.snapshotDigest);
      if (loaded.candidate) candidates.push(loaded.candidate);
    }
    expect(candidates.flatMap((candidate) => candidate.document.resources)).toHaveLength(625);
    expect(new Set(candidates.flatMap((candidate) => candidate.document.assets.map((asset) => asset.id)))).toHaveLength(280);
    expect(new Set(candidates.flatMap((candidate) => candidate.document.resources.map((resource) => resource.template.id)))).toEqual(
      new Set(["种族", "社群", "职业", "子职业", "武器", "护甲", "物品", "领域卡"]),
    );
  });

  test("keeps old Sheet resource documents out of the public runtime", () => {
    const manifest = readJson<Record<string, unknown>>(path.join(packageRoot, "manifest.json"));
    expect(manifest).not.toHaveProperty("resourceFormatAdapters");
    expect(manifest.resourceLibraries).toEqual(expect.arrayContaining([
      expect.objectContaining({ ID: "weapons", 路径: "runtime-libraries/weapons.json" }),
      expect.objectContaining({ ID: "domain-cards", 路径: "runtime-libraries/domain-cards.json" }),
    ]));
    expect(readJson(path.join(packageRoot, "runtime-libraries/weapons.json"))).toEqual([]);
    expect(() => readFileSync(path.join(packageRoot, "resources/weapons.json"))).toThrow();
  });
});
