export type CharacterJsonValue = null | boolean | number | string | CharacterJsonValue[] | CharacterJsonObject;
export type CharacterJsonObject = { [key: string]: CharacterJsonValue };
export type CharacterFormatId = "pbcha" | "dhsheet" | "zzz";

export type CharacterDiagnostic = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  path?: string;
};

export type TemporaryCharacter = {
  name: string;
  values: CharacterJsonObject;
  cards: CharacterJsonValue[];
  sourceExtensions: Partial<Record<CharacterFormatId, CharacterJsonValue>>;
};

export type CharacterInput = { bytes: Uint8Array; fileName: string };
export type CharacterArtifact = { bytes: Uint8Array; fileName: string; mediaType: string };
export type CharacterReport = {
  formatId: CharacterFormatId;
  direction: "import" | "export";
  diagnostics: CharacterDiagnostic[];
};
export type CharacterImportResult =
  | { ok: true; character: TemporaryCharacter; report: CharacterReport }
  | { ok: false; report: CharacterReport };
export type CharacterExportResult =
  | { ok: true; artifact: CharacterArtifact; report: CharacterReport }
  | { ok: false; report: CharacterReport };

export interface CharacterFormatAdapter {
  readonly id: CharacterFormatId;
  import(input: CharacterInput): CharacterImportResult;
  export(character: TemporaryCharacter): CharacterExportResult;
}
