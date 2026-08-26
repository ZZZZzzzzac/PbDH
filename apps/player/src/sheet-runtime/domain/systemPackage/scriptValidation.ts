import { parse as parseJavaScript } from "acorn";
import { isPlainObject } from "../../utils";
import type { ValidationContext } from "./validationContext";

export function collectScriptValidationIssues(context: ValidationContext): void {
  const { systemPackage, issues } = context;
  // --- Validation checks syntax ---
  const adapterScripts = [
    ...(systemPackage.resourceFormatAdapters ?? []).map((adapter, index) => ({
      content: adapter.importScriptContent,
      id: adapter.ID,
      path: `resourceFormatAdapters.${index}.importScriptContent`,
      pointer: ["resourceFormatAdapters", index, "importScriptContent"] as Array<string | number>,
    })),
    ...(systemPackage.characterFormatAdapters ?? []).flatMap((adapter, index) => [
      {
        content: adapter.importScriptContent,
        id: adapter.ID,
        path: `characterFormatAdapters.${index}.importScriptContent`,
        pointer: ["characterFormatAdapters", index, "importScriptContent"] as Array<string | number>,
      },
      ...(adapter.exportScriptContent ? [{
        content: adapter.exportScriptContent,
        id: adapter.ID,
        path: `characterFormatAdapters.${index}.exportScriptContent`,
        pointer: ["characterFormatAdapters", index, "exportScriptContent"] as Array<string | number>,
      }] : []),
    ]),
  ];
  for (const script of adapterScripts) {
    try {
      parseJavaScript(script.content, { ecmaVersion: "latest", sourceType: "script", locations: true });
    } catch (error) {
      const location = getJavaScriptErrorLocation(error);
      issues.push({
        level: "error",
        code: "FORMAT_ADAPTER_SCRIPT_SYNTAX_INVALID",
        text: `Format Adapter Script JavaScript 语法错误：${script.id}${location ? `（${location.line}:${location.column}）` : ""}`,
        path: script.path,
        location: { pointer: script.pointer, line: location?.line, column: location?.column },
        evidence: [{ label: "parserMessage", value: getErrorMessage(error) }],
      });
    }
  }

  for (const [checkIndex, check] of (systemPackage.validationChecks ?? []).entries()) {
    try {
      parseJavaScript(check.scriptContent, { ecmaVersion: "latest", sourceType: "script", locations: true });
    } catch (error) {
      const location = getJavaScriptErrorLocation(error);
      issues.push({
        level: "error",
        code: "VALIDATION_SCRIPT_SYNTAX_INVALID",
        text: `Validation Script JavaScript 语法错误：${check.ID}${location ? `（${location.line}:${location.column}）` : ""}`,
        path: `validationChecks.${checkIndex}.scriptContent`,
        location: { pointer: ["validationChecks", checkIndex, "scriptContent"], line: location?.line, column: location?.column },
        evidence: [{ label: "parserMessage", value: getErrorMessage(error) }],
      });
    }
  }

}

function getJavaScriptErrorLocation(error: unknown): { line: number; column: number } | undefined {
  if (!isPlainObject(error) || !isPlainObject(error.loc)) return undefined;
  return typeof error.loc.line === "number" && typeof error.loc.column === "number"
    ? { line: error.loc.line, column: error.loc.column }
    : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
