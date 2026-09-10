import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export type ResourceFormatId = "pbres" | "rinkcx" | "kid" | "dhsheet" | "zzz";
export type ResourceContainer = "json" | "zip" | "dhcb" | "pbres" | "png";
export type ResourceKind =
  | "adversary"
  | "environment"
  | "weapon"
  | "armor"
  | "item"
  | "class"
  | "subclass"
  | "ancestry"
  | "community"
  | "domain"
  | "free"
  | "opaque";

export type ConversionSeverity = "info" | "warning" | "error";
export type ConversionDiagnostic = {
  code: string;
  severity: ConversionSeverity;
  message: string;
  path?: string;
  resourceId?: string;
  details?: JsonObject;
};

export type SourceEvidence = {
  formatId: ResourceFormatId;
  upstreamRevision: string;
  path: string;
  raw: JsonValue;
};

export type TemporaryResource = {
  sourceId: string;
  kind: ResourceKind;
  name: string;
  fields: JsonObject;
  /** Template 媒体槽位到 TemporaryResourceBatch.media 键的映射。 */
  media?: Record<string, string>;
  source: SourceEvidence;
};

export type TemporaryResourceBatch = {
  name: string;
  version?: string;
  resources: TemporaryResource[];
  sourceDocument: {
    formatId: ResourceFormatId;
    upstreamRevision: string;
    container: ResourceContainer;
    raw?: JsonValue;
  };
  nativePackage?: ResourcePackageLogicalDocument;
  media: Map<string, Uint8Array>;
};

export type NormalizedResourceMedia = {
  id: `sha256:${string}`;
  mediaType: "image/webp";
  byteLength: number;
  width: number;
  height: number;
  bytes: Uint8Array;
};

export type ResourceMediaNormalizer = (input: {
  bytes: Uint8Array;
  fileName: string;
}) => Promise<NormalizedResourceMedia>;

export type ResourceInput = {
  bytes: Uint8Array;
  fileName: string;
  container?: ResourceContainer;
};

export type ResourceArtifact = {
  bytes: Uint8Array;
  fileName: string;
  container: ResourceContainer;
  mediaType: string;
};

export type ConversionReport = {
  formatId: ResourceFormatId;
  direction: "import" | "export";
  converted: number;
  failed: number;
  diagnostics: ConversionDiagnostic[];
};

export type ImportResult =
  | { ok: true; batch: TemporaryResourceBatch; report: ConversionReport }
  | { ok: false; report: ConversionReport };

export type ExportOptions = {
  container?: ResourceContainer;
  packageName?: string;
  packageVersion?: string;
  creator?: string;
  owner?: string;
  allowDecision?: (diagnostic: ConversionDiagnostic, resource: TemporaryResource) => boolean;
};

export type ExportResult =
  | { ok: true; artifact: ResourceArtifact; report: ConversionReport }
  | { ok: false; report: ConversionReport };

export interface ResourceFormatAdapter {
  readonly id: ResourceFormatId;
  readonly upstreamRevision: string;
  import(input: ResourceInput): Promise<ImportResult> | ImportResult;
  export(batch: TemporaryResourceBatch, options?: ExportOptions): Promise<ExportResult> | ExportResult;
}

export type GameResourceCandidate = {
  sourceId: string;
  template: { id: string; version: string };
  data: JsonObject;
  diagnostics: ConversionDiagnostic[];
};
