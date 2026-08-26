import { cloneAndFreeze } from "./packageScript";
import { executePackageScriptInWorker } from "./packageScriptRunner";
import { normalizeScriptIssues, type ValidationInput, type ValidationIssue } from "./validationScript";
export type { ValidationIssue, ValidationIssueLevel, ValidationInput } from "./validationScript";

const validationWorkerTimeoutMs = 3000;

export async function runValidationChecks(input: ValidationInput): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  for (const check of input.checks) {
    const scriptInput = cloneAndFreeze({
      characterData: input.characterData,
      resourceLibraries: input.resourceLibraries,
      cardState: input.cardState,
      packageMetadata: input.packageMetadata,
    });

    try {
      const rawIssues = await executePackageScriptInWorker(check.scriptContent, scriptInput, "Validation Script", validationWorkerTimeoutMs);
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
