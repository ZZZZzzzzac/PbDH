import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import resourcePackageSchema from "../../contracts/resource-package/1.1.0/schema.json";

const root = process.cwd();
const legacyFixture = JSON.parse(readFileSync(path.join(
  root,
  "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json",
), "utf8")) as {
  contractVersion: string;
  package: { name: string };
  resources: Array<Record<string, unknown>>;
};
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(resourcePackageSchema as AnySchema);

function attributedCandidate() {
  const candidate = structuredClone(legacyFixture);
  candidate.contractVersion = "1.1.0";
  candidate.resources.forEach((resource) => {
    resource.attribution = { artworkCredit: "", sourceLabel: candidate.package.name };
  });
  return candidate;
}

describe("Resource Package per-card attribution", () => {
  test("requires an editable attribution record on every 1.1 resource", () => {
    const candidate = attributedCandidate();
    expect(validate(candidate), JSON.stringify(validate.errors)).toBe(true);

    delete candidate.resources[0]!.attribution;
    expect(validate(candidate)).toBe(false);
    expect(validate.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: "/resources/0", keyword: "required" }),
    ]));
  });

  test("accepts a blank artist while preserving the per-card source label", () => {
    const candidate = attributedCandidate();
    expect(candidate.resources[0]?.attribution).toEqual({
      artworkCredit: "",
      sourceLabel: candidate.package.name,
    });
    expect(validate(candidate), JSON.stringify(validate.errors)).toBe(true);
  });
});
