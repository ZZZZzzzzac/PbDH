import type { AnySchema, ErrorObject, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";

export {
  computeResourcePackageSnapshotDigest,
  LEGACY_RESOURCE_PACKAGE_VERSION,
  RESOURCE_PACKAGE_VERSION,
  validateResourcePackageSemantics,
} from "./resource-package.ts";
export type {
  ResourcePresentation,
  ResourcePackageLogicalDocument,
  ResourcePackageMedia,
} from "./resource-package.ts";
export {
  loadPbres,
  loadResourcePackageDirectory,
  writePbres,
  writeResourcePackageDirectory,
} from "./portable-archive.ts";
export {
  TABLETOP_DOCUMENT_VERSION,
  validateTabletopDocumentSemantics,
} from "./tabletop-document.ts";
export type {
  TabletopAsset,
  TabletopDocument,
  TabletopMedia,
  TabletopResourceCopy,
} from "./tabletop-document.ts";
export { loadPbtab, writePbtab } from "./tabletop-archive.ts";
export type {
  PbtabLoadResult,
  TabletopDocumentCandidate,
  TabletopDocumentCandidateValidator,
} from "./tabletop-archive.ts";
export {
  compareSemVer,
  isSemVerInRange,
  parseSemVer,
} from "./semver.ts";
export {
  loadPbsys,
  loadSystemPackageDirectory,
  planEmbeddedResourceAdmission,
  validateSystemPackageSemantics,
  writePbsys,
  writeSystemPackageDirectory,
} from "./system-package.ts";
export type {
  EmbeddedResourceAdmission,
  NormalizedSystemPackage,
  SystemPackageDocument,
  SystemPackageLoadResult,
} from "./system-package.ts";
export type {
  PortableArchiveResult,
  PortableDirectoryEntry,
  ResourcePackageCandidate,
  ResourcePackageCandidateValidator,
} from "./portable-archive.ts";

export type ContractFamilyId =
  | "resource-package"
  | "system-package"
  | "character-save"
  | "tabletop-document"
  | "backend-api";

export type ContractVersionState = "development" | "published" | "deprecated";
export type ContractMode = "development" | "production";

export type ContractCatalog = {
  catalogVersion: 1;
  families: Array<{
    id: ContractFamilyId;
    versions: Array<{
      version: string;
      state: ContractVersionState;
      schema: string;
    }>;
  }>;
};

export type ContractDiagnostic = {
  code: string;
  severity: "error" | "warning" | "info";
  family: string;
  version: string;
  location: string;
  params: Record<string, unknown>;
};

export type ContractValidationRequest = {
  family: string;
  version: string;
  mode: ContractMode;
  candidate: unknown;
};

type CatalogVersion = ContractCatalog["families"][number]["versions"][number];

function escapePointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function appendPointer(pointer: string, segment: string): string {
  return `${pointer}/${escapePointerSegment(segment)}`;
}

function diagnostic(
  request: ContractValidationRequest,
  code: string,
  location = "",
  params: Record<string, unknown> = {},
): ContractDiagnostic {
  return {
    code,
    severity: "error",
    family: request.family,
    version: request.version,
    location,
    params,
  };
}

function mapSchemaError(
  request: ContractValidationRequest,
  error: ErrorObject,
): ContractDiagnostic {
  switch (error.keyword) {
    case "type":
      return diagnostic(
        request,
        "contract.schema.type",
        error.instancePath,
        { expected: error.params.type },
      );
    case "required":
      return diagnostic(
        request,
        "contract.schema.required",
        appendPointer(error.instancePath, error.params.missingProperty),
        { property: error.params.missingProperty },
      );
    case "additionalProperties":
      return diagnostic(
        request,
        "contract.schema.additional-property",
        appendPointer(error.instancePath, error.params.additionalProperty),
        { property: error.params.additionalProperty },
      );
    case "const":
      return diagnostic(
        request,
        "contract.schema.const",
        error.instancePath,
        { expected: error.params.allowedValue },
      );
    case "minLength":
      return diagnostic(
        request,
        "contract.schema.min-length",
        error.instancePath,
        { limit: error.params.limit },
      );
    default:
      return diagnostic(
        request,
        "contract.schema.invalid",
        error.instancePath,
        { keyword: error.keyword },
      );
  }
}

function compareText(left: string, right: string): number {
  const leftCodePoints = Array.from(left, (character) => character.codePointAt(0)!);
  const rightCodePoints = Array.from(right, (character) => character.codePointAt(0)!);
  const length = Math.min(leftCodePoints.length, rightCodePoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftCodePoints[index]! - rightCodePoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftCodePoints.length - rightCodePoints.length;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => compareText(left, right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sortDiagnostics(diagnostics: ContractDiagnostic[]): ContractDiagnostic[] {
  return diagnostics.sort((left, right) => {
    const locationOrder = compareText(left.location, right.location);
    if (locationOrder !== 0) return locationOrder;
    const codeOrder = compareText(left.code, right.code);
    if (codeOrder !== 0) return codeOrder;
    return compareText(stableStringify(left.params), stableStringify(right.params));
  });
}

export class ContractRuntime {
  readonly #catalog: ContractCatalog;
  readonly #versions = new Map<string, CatalogVersion>();
  readonly #validators = new Map<string, ValidateFunction>();

  constructor(catalog: ContractCatalog, schemas: Record<string, AnySchema>) {
    this.#catalog = catalog;
    const ajv = new Ajv2020({ allErrors: true, strict: true });

    for (const family of catalog.families) {
      for (const version of family.versions) {
        const key = `${family.id}@${version.version}`;
        if (this.#versions.has(key)) throw new Error(`Duplicate Contract version: ${key}`);
        const schema = schemas[version.schema];
        if (!schema) throw new Error(`Missing Contract schema: ${version.schema}`);
        this.#versions.set(key, version);
        this.#validators.set(key, ajv.compile(schema));
      }
    }
  }

  getVersionState(family: string, version: string): ContractVersionState | undefined {
    return this.#versions.get(`${family}@${version}`)?.state;
  }

  validate(request: ContractValidationRequest): ContractDiagnostic[] {
    if (!this.#catalog.families.some((family) => family.id === request.family)) {
      return [diagnostic(request, "contract.family.unknown")];
    }

    const key = `${request.family}@${request.version}`;
    const version = this.#versions.get(key);
    if (!version) return [diagnostic(request, "contract.version.unsupported")];
    if (request.mode === "production" && version.state === "development") {
      return [diagnostic(request, "contract.version.development-not-allowed")];
    }

    const validator = this.#validators.get(key);
    if (!validator) throw new Error(`Missing compiled Contract validator: ${key}`);
    if (validator(request.candidate)) return [];
    return sortDiagnostics(
      (validator.errors ?? []).map((error) => mapSchemaError(request, error)),
    );
  }
}
