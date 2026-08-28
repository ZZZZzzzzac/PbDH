import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  classifyResourcePackageVersionChange,
  createResourcePackageVersionBaseline,
  resourcePackageVersionMeetsMinimum,
  type ResourcePackageLogicalDocument,
} from "../../packages/contract-runtime/src/index.ts";

type FixtureOperation =
  | { op: "add" | "replace"; path: string; value: unknown }
  | { op: "copy"; from: string; path: string }
  | { op: "remove" | "reverse"; path: string };

type FixtureCase = {
  name: string;
  source?: string;
  previous?: FixtureOperation[];
  current: FixtureOperation[];
  expected: { level: string; minimumVersion: string; reasonCodes: string[] };
};

const fixturePath = path.resolve(
  "contracts/conformance/resource-package-version/1.0.0/cases.json",
);
const fixtureDirectory = path.dirname(fixturePath);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  defaultSource: string;
  cases: FixtureCase[];
  versionChoices: Array<{ selected: string; minimum: string; accepted: boolean }>;
};

function readDocument(source = fixture.defaultSource): ResourcePackageLogicalDocument {
  return JSON.parse(readFileSync(path.resolve(fixtureDirectory, source), "utf8")) as ResourcePackageLogicalDocument;
}

function pointerParts(pointer: string): string[] {
  return pointer.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function valueAt(document: unknown, pointer: string): unknown {
  return pointerParts(pointer).reduce<unknown>((value, part) =>
    Array.isArray(value) ? value[Number(part)] : (value as Record<string, unknown>)[part], document);
}

function applyOperation(document: ResourcePackageLogicalDocument, operation: FixtureOperation): void {
  if (operation.op === "copy") {
    applyOperation(document, { op: "add", path: operation.path, value: structuredClone(valueAt(document, operation.from)) });
    return;
  }
  if (operation.op === "reverse") {
    (valueAt(document, operation.path) as unknown[]).reverse();
    return;
  }
  const parts = pointerParts(operation.path);
  const key = parts.pop()!;
  const parent = parts.reduce<unknown>((value, part) =>
    Array.isArray(value) ? value[Number(part)] : (value as Record<string, unknown>)[part], document);
  if (operation.op === "remove") {
    if (Array.isArray(parent)) parent.splice(Number(key), 1);
    else delete (parent as Record<string, unknown>)[key];
    return;
  }
  if (operation.op !== "add" && operation.op !== "replace") {
    throw new Error(`Unsupported fixture operation: ${operation.op}`);
  }
  if (Array.isArray(parent)) {
    if (key === "-") parent.push(structuredClone(operation.value));
    else parent[Number(key)] = structuredClone(operation.value);
  } else {
    (parent as Record<string, unknown>)[key] = structuredClone(operation.value);
  }
}

describe("Resource Package Structural SemVer Classifier", () => {
  test.each(fixture.cases)("classifies $name through shared conformance", async (fixtureCase) => {
    const previous = readDocument(fixtureCase.source);
    fixtureCase.previous?.forEach((operation) => applyOperation(previous, operation));
    const current = structuredClone(previous);
    fixtureCase.current.forEach((operation) => applyOperation(current, operation));

    const result = await classifyResourcePackageVersionChange(
      await createResourcePackageVersionBaseline(previous),
      current,
    );

    expect(result.level).toBe(fixtureCase.expected.level);
    expect(result.minimumVersion).toBe(fixtureCase.expected.minimumVersion);
    expect(result.reasons.map((reason) => reason.code)).toEqual(fixtureCase.expected.reasonCodes);
  });

  test.each(fixture.versionChoices)(
    "checks $selected against $minimum through shared conformance",
    ({ selected, minimum, accepted }) => {
      expect(resourcePackageVersionMeetsMinimum(selected, minimum)).toBe(accepted);
    },
  );

  test("rejects comparison across Package IDs", async () => {
    const previous = readDocument();
    const current = structuredClone(previous);
    current.package.id = "01a0132c-4eef-7703-94ac-ec8d1a660099";
    await expect(classifyResourcePackageVersionChange(
      await createResourcePackageVersionBaseline(previous),
      current,
    )).rejects.toThrow("same Package ID");
  });
});
