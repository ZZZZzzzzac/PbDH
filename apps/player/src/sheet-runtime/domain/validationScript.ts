import type { CharacterData } from "./characterData";
import type { ResourceLibrary } from "./resourceLibrary";
import type { ValidationCheck } from "./systemPackage";
import { cloneAndFreeze, executePackageScriptInContext } from "./packageScript";
import { validationScriptOutputSchema, type ValidationScriptInput } from "./packageScriptContract";

export type ValidationIssueLevel = "error" | "warning" | "info";

export interface ValidationIssue {
  level: ValidationIssueLevel;
  text: string;
  path?: string;
  code?: string;
  source: string;
}

export interface ValidationInput {
  characterData: CharacterData;
  resourceLibraries: ResourceLibrary[];
  cardState: CharacterData["cards"];
  packageMetadata: {
    id: string;
    version: string;
  };
  checks: ValidationCheck[];
}

export type ScriptInput = ValidationScriptInput;

export type RawCheckResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export function executeScriptInContext(scriptContent: string, input: ScriptInput): Promise<unknown> {
  return executePackageScriptInContext(scriptContent, input, "Validation Script");
}

export function normalizeScriptIssues(source: string, rawIssues: unknown): ValidationIssue[] {
  const parsed = validationScriptOutputSchema.safeParse(rawIssues);
  if (!parsed.success) {
    return [
      {
        level: "error",
        code: "VALIDATION_SCRIPT_OUTPUT_INVALID",
        text: "Validation Script 必须返回 issue 数组。",
        source,
      },
    ];
  }

  const issueInputs = Array.isArray(parsed.data) ? parsed.data : parsed.data.issues;
  return issueInputs.map((issue) => ({ ...issue, source }));
}

export function invalidIssue(source: string, index: number): ValidationIssue {
  return {
    level: "error",
    code: "VALIDATION_SCRIPT_ISSUE_INVALID",
    text: `Validation Script 返回了无效 issue：${index}`,
    source,
  };
}

/**
 * 与 Web Worker 版本等价的主线程实现，仅用于无真实 Worker 的测试环境。
 * 生产环境走 `runValidationChecks`（worker 隔离），不应直接调用本函数。
 */
export async function runValidationChecksInProcess(input: ValidationInput): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const scriptInput = cloneAndFreeze({
    characterData: input.characterData,
    resourceLibraries: input.resourceLibraries,
    cardState: input.cardState,
    packageMetadata: input.packageMetadata,
  });

  for (const check of input.checks) {
    try {
      const rawIssues = await executeScriptInContext(check.scriptContent, scriptInput);
      issues.push(...normalizeScriptIssues(check.ID, rawIssues));
    } catch (error) {
      issues.push({
        level: "error",
        code: "VALIDATION_SCRIPT_ERROR",
        text: `Validation Script 执行失败：${error instanceof Error ? error.message : String(error)}`,
        source: check.ID,
      });
    }
  }

  return issues;
}
