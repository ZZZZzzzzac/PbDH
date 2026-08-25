import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  commitResourcePackageInstall,
  commitResourcePackageRemoval,
  planResourcePackageInstall,
  type InstalledResourcePackage,
  type ResourceLibrary,
} from "../../apps/player/src/resources/resource-library.ts";
import type {
  ResourcePackageCandidate,
  ResourcePackageLogicalDocument,
  SystemPackageDocument,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

const system = readJson<SystemPackageDocument>(
  "contracts/conformance/system-package/1.0.0-alpha.1/valid/daggerheart/system.json",
);
const baseDocument = readJson<ResourcePackageLogicalDocument>(
  "contracts/conformance/resource-package/1.0.0-alpha.1/valid/daggerheart-core-primary-weapon.json",
);
const adversaryDocument = readJson<ResourcePackageLogicalDocument>(
  "contracts/conformance/resource-package/1.0.0-alpha.1/valid/minotaur-wrecker.json",
);

function candidate(document = structuredClone(baseDocument)): ResourcePackageCandidate {
  return { document, media: new Map() };
}

function installed(document = structuredClone(baseDocument)): InstalledResourcePackage {
  return { document, media: new Map(), routes: [] };
}

describe("Player Resource Library", () => {
  test("plans a new package without mutating the library", () => {
    const library: ResourceLibrary = new Map();
    const plan = planResourcePackageInstall({ currentSystem: system, library, candidate: candidate() });

    expect(plan.kind).toBe("insert");
    expect(library.size).toBe(0);
  });

  test("recognizes the same package snapshot as a no-op", () => {
    const current = installed();
    const library: ResourceLibrary = new Map([[current.document.package.id, current]]);

    expect(planResourcePackageInstall({ currentSystem: system, library, candidate: candidate() }))
      .toEqual({ kind: "no-op", existing: current });
  });

  test("requires an explicit update when the same package ID has a different snapshot", () => {
    const current = installed();
    const incoming = structuredClone(baseDocument);
    incoming.package.version = "1.1.0";
    incoming.snapshotDigest = "sha256:incoming";
    const library: ResourceLibrary = new Map([[current.document.package.id, current]]);

    const plan = planResourcePackageInstall({ currentSystem: system, library, candidate: candidate(incoming) });

    expect(plan.kind).toBe("update");
    expect(library.get(current.document.package.id)).toBe(current);
  });

  test("commits a whole package into a new map and keeps the previous library immutable", () => {
    const current = installed();
    const incoming = structuredClone(baseDocument);
    incoming.package.version = "1.1.0";
    incoming.snapshotDigest = "sha256:incoming";
    const library: ResourceLibrary = new Map([[current.document.package.id, current]]);
    const plan = planResourcePackageInstall({ currentSystem: system, library, candidate: candidate(incoming) });
    if (plan.kind === "no-op") throw new Error("expected update plan");

    const next = commitResourcePackageInstall(library, plan);

    expect(next).not.toBe(library);
    expect(library.get(current.document.package.id)?.document.package.version)
      .toBe(baseDocument.package.version);
    expect(next.get(current.document.package.id)?.document.package.version).toBe("1.1.0");
  });

  test("removes a whole package from a new map and keeps the previous library immutable", () => {
    const current = installed();
    const library: ResourceLibrary = new Map([[current.document.package.id, current]]);

    const next = commitResourcePackageRemoval(library, current.document.package.id);

    expect(next).not.toBe(library);
    expect(next.has(current.document.package.id)).toBe(false);
    expect(library.has(current.document.package.id)).toBe(true);
  });

  test("routes every resource independently when a package contains multiple Templates", () => {
    const incoming = structuredClone(baseDocument);
    incoming.resources.push(structuredClone(adversaryDocument.resources[0]!));

    const plan = planResourcePackageInstall({
      currentSystem: system,
      library: new Map(),
      candidate: candidate(incoming),
    });

    expect(plan.kind).toBe("insert");
    if (plan.kind !== "insert") return;
    expect(plan.routes).toMatchObject([
      { destination: "native", nativeEntry: { id: "weapons", label: "武器" } },
      { destination: "other-resources", reason: "template-incompatible" },
    ]);
  });

  test("routes an adversary to other resources because Daggerheart Core has no native adversary entry", () => {
    const plan = planResourcePackageInstall({
      currentSystem: system,
      library: new Map(),
      candidate: candidate(adversaryDocument),
    });

    expect(plan.kind).toBe("insert");
    if (plan.kind !== "insert") return;
    expect(plan.routes).toMatchObject([
      { destination: "other-resources", reason: "template-incompatible" },
    ]);
  });
});
