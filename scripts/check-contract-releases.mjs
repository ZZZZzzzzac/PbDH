import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractsRoot = path.join(root, "contracts");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
}

const catalog = readJson(path.join(contractsRoot, "catalog.json"));
const releaseSchema = readJson(path.join(contractsRoot, "release.schema.json"));
const validateRelease = new Ajv2020({ allErrors: true, strict: true }).compile(releaseSchema);
const errors = [];
let checked = 0;

for (const family of catalog.families) {
  for (const version of family.versions) {
    if (version.state !== "published" && version.state !== "deprecated") continue;
    checked += 1;
    const releasePath = path.join(contractsRoot, "releases", family.id, `${version.version}.json`);
    if (!existsSync(releasePath)) {
      errors.push(`${family.id}@${version.version}: missing release evidence`);
      continue;
    }

    const release = readJson(releasePath);
    if (!validateRelease(release)) {
      errors.push(`${family.id}@${version.version}: invalid release evidence ${JSON.stringify(validateRelease.errors)}`);
      continue;
    }
    if (release.family !== family.id || release.version !== version.version || release.schema !== version.schema) {
      errors.push(`${family.id}@${version.version}: release identity does not match catalog`);
    }
    const schemaPath = path.join(contractsRoot, version.schema);
    if (!existsSync(schemaPath)) {
      errors.push(`${family.id}@${version.version}: missing schema ${version.schema}`);
    } else if (sha256(schemaPath) !== release.schemaSha256) {
      errors.push(`${family.id}@${version.version}: published schema hash changed`);
    }
    for (const evidence of release.conformance) {
      if (!existsSync(path.join(contractsRoot, evidence))) {
        errors.push(`${family.id}@${version.version}: missing conformance ${evidence}`);
      }
    }
    for (const evidence of [...release.producerTests, ...release.consumerTests]) {
      if (!existsSync(path.join(root, evidence))) {
        errors.push(`${family.id}@${version.version}: missing test evidence ${evidence}`);
      }
    }
  }
}

if (errors.length) throw new Error(`Contract release checks failed:\n- ${errors.join("\n- ")}`);
console.log(`Contract releases OK (${checked} published or deprecated versions).`);
