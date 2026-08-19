import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

const fixtureDirectory = path.join(
  process.cwd(),
  "contracts",
  "conformance",
  "tooling-smoke",
);

function readJson(fileName: string): unknown {
  return JSON.parse(readFileSync(path.join(fixtureDirectory, fileName), "utf8"));
}

describe("cross-language conformance tooling smoke fixture", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(readJson("schema.json") as AnySchema);
  const expected = readJson("expected.json") as Record<string, boolean>;

  for (const [fileName, isValid] of Object.entries(expected)) {
    test(`${fileName} => ${isValid}`, () => {
      expect(validate(readJson(fileName))).toBe(isValid);
    });
  }
});
