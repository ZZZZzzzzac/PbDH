import type {
  CharacterDiagnostic,
  CharacterExportResult,
  CharacterFormatId,
  CharacterImportResult,
  CharacterJsonObject,
  CharacterJsonValue,
} from "./types.ts";

export const characterEncoder = new TextEncoder();
export const characterDecoder = new TextDecoder("utf-8", { fatal: true });

export function characterObject(value: unknown): CharacterJsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) && characterJsonValue(value)
    ? value as CharacterJsonObject
    : undefined;
}

export function characterJsonValue(value: unknown): value is CharacterJsonValue {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(characterJsonValue);
  return Boolean(value) && typeof value === "object" && Object.values(value).every(characterJsonValue);
}

export function characterText(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

export function characterReport(
  formatId: CharacterFormatId,
  direction: "import" | "export",
  diagnostics: CharacterDiagnostic[] = [],
) {
  return { formatId, direction, diagnostics } as const;
}

export function characterImportFailure(formatId: CharacterFormatId, code: string, message: string): CharacterImportResult {
  return { ok: false, report: characterReport(formatId, "import", [{ code, severity: "error", message }]) };
}

export function characterExportFailure(
  formatId: CharacterFormatId,
  code: string,
  message: string,
  path?: string,
): CharacterExportResult {
  return { ok: false, report: characterReport(formatId, "export", [{ code, severity: "error", message, path }]) };
}

export function characterJsonArtifact(value: CharacterJsonValue, fileName: string) {
  return {
    bytes: characterEncoder.encode(`${JSON.stringify(value, null, 2)}\n`),
    fileName,
    mediaType: "application/json",
  };
}

export function characterStem(name: string): string {
  return name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-").replace(/[ .]+$/u, "") || "character";
}
