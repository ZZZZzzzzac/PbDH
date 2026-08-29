import { compareSemVer } from "@pbdh/contract-runtime";
import { z } from "zod";
import { executePackageScriptInWorker } from "./packageScriptRunner";
import type { CharacterDataMigration } from "./systemPackage";

const jsonRecordSchema = z.record(z.string(), z.unknown());

export interface CharacterDataMigrationStep {
  fromVersion: string;
  toVersion: string;
  script: string;
}

export interface CharacterDataMigrationCandidate {
  fromVersion: string;
  toVersion: string;
  characterData: Record<string, unknown>;
  steps: CharacterDataMigrationStep[];
}

export type CharacterDataMigrationResult =
  | { status: "current" }
  | { status: "ready"; candidate: CharacterDataMigrationCandidate }
  | { status: "error"; message: string };

export async function prepareCharacterDataMigration(input: {
  fromVersion: string;
  toVersion: string;
  characterData: Record<string, unknown>;
  migrations: CharacterDataMigration[];
  validateStep?: (characterData: Record<string, unknown>, version: string) => string[];
  execute?: (scriptContent: string, input: unknown, label: string) => Promise<unknown>;
}): Promise<CharacterDataMigrationResult> {
  if (input.fromVersion === input.toVersion) return { status: "current" };
  if (compareSemVer(input.fromVersion, input.toVersion) > 0) {
    return { status: "error", message: `人物数据版本 ${input.fromVersion} 高于当前版本 ${input.toVersion}，不能降级。` };
  }
  const chain = buildMigrationChain(input.fromVersion, input.toVersion, input.migrations);
  if (typeof chain === "string") return { status: "error", message: chain };

  const execute = input.execute ?? executePackageScriptInWorker;
  let characterData = structuredClone(input.characterData);
  const steps: CharacterDataMigrationStep[] = [];
  for (const migration of chain) {
    let output: unknown;
    try {
      output = await execute(migration.scriptContent, {
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
        characterData,
      }, `Character Data Migration ${migration.fromVersion} -> ${migration.toVersion}`);
    } catch (error) {
      return { status: "error", message: `人物数据升级 ${migration.fromVersion} → ${migration.toVersion} 失败：${error instanceof Error ? error.message : String(error)}` };
    }
    const parsed = jsonRecordSchema.safeParse(output);
    if (!parsed.success || !isJsonValue(parsed.data)) {
      return { status: "error", message: `人物数据升级 ${migration.fromVersion} → ${migration.toVersion} 返回了无效数据。` };
    }
    characterData = structuredClone(parsed.data);
    const validationErrors = input.validateStep?.(characterData, migration.toVersion) ?? [];
    if (validationErrors.length > 0) {
      return { status: "error", message: `人物数据升级到 ${migration.toVersion} 后校验失败：${validationErrors.join("；")}` };
    }
    steps.push({ fromVersion: migration.fromVersion, toVersion: migration.toVersion, script: migration.script });
  }
  return {
    status: "ready",
    candidate: { fromVersion: input.fromVersion, toVersion: input.toVersion, characterData, steps },
  };
}

function buildMigrationChain(
  fromVersion: string,
  toVersion: string,
  migrations: CharacterDataMigration[],
): CharacterDataMigration[] | string {
  const byFrom = new Map<string, CharacterDataMigration>();
  for (const migration of migrations) {
    if (byFrom.has(migration.fromVersion)) return `人物数据升级链在 ${migration.fromVersion} 出现分支。`;
    if (compareSemVer(migration.fromVersion, migration.toVersion) >= 0) return `人物数据升级 ${migration.fromVersion} → ${migration.toVersion} 不是向前升级。`;
    byFrom.set(migration.fromVersion, migration);
  }
  const chain: CharacterDataMigration[] = [];
  const visited = new Set<string>();
  let version = fromVersion;
  while (version !== toVersion) {
    if (visited.has(version)) return `人物数据升级链在 ${version} 形成循环。`;
    visited.add(version);
    const migration = byFrom.get(version);
    if (!migration) return `人物数据升级链缺少从 ${version} 开始的一步。`;
    if (compareSemVer(migration.toVersion, toVersion) > 0) return `人物数据升级链越过了当前版本 ${toVersion}。`;
    chain.push(migration);
    version = migration.toVersion;
  }
  return chain;
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}
