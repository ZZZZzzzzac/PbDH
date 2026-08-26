import { type CharacterCreationGuide, characterCreationGuideSchema } from "../characterCreationGuide";
import { normalizeResourceLibraries } from "../resourceLibrary";
import { isPlainObject } from "../../utils";
import { collectBaseValidationIssues } from "./baseValidation";
import { collectCardValidationIssues } from "./cardValidation";
import {
  dependencyRuleSchema,
  sheetModuleSchema,
  supportedModuleTypes,
  systemPackageEnvelopeSchema,
  type DependencyRule,
  type PackageIssue,
  type PackageIssueEntity,
  type PackageSourceMap,
  type PackageValidationResult,
  type SheetModule,
  type SystemPackage,
} from "./contract";
import { collectDependencyValidationIssues } from "./dependencyValidation";
import { collectGuideValidationIssues } from "./guideValidation";
import { collectModuleValidationIssues } from "./moduleValidation";
import { collectPresentationValidationIssues } from "./presentationValidation";
import { collectScriptValidationIssues } from "./scriptValidation";
import { collectCharacterTextExportValidationIssues } from "./characterTextExportValidation";
import { createValidationContext } from "./validationContext";

type DependencyParseResult =
  | { ok: true; dependencies: DependencyRule[] }
  | { ok: false; issues: PackageIssue[] };

type GuideParseResult =
  | { ok: true; guide?: CharacterCreationGuide }
  | { ok: false; issues: PackageIssue[] };

function parseCharacterCreationGuide(input: unknown): GuideParseResult {
  if (input === undefined) {
    return { ok: true };
  }

  const parsed = characterCreationGuideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        level: "error",
        code: "INVALID_CHARACTER_CREATION_GUIDE",
        text: issue.message,
        path: ["characterCreationGuide", ...issue.path].join("."),
      })),
    };
  }

  return { ok: true, guide: parsed.data };
}
function parseDependencyRules(inputs: unknown[]): DependencyParseResult {
  const dependencies: DependencyRule[] = [];
  const issues: PackageIssue[] = [];

  inputs.forEach((input, index) => {
    const unsupportedIssue = detectUnsupportedDependencySource(input, index);
    if (unsupportedIssue) {
      issues.push(unsupportedIssue);
      return;
    }

    const parsedDependency = dependencyRuleSchema.safeParse(input);
    if (!parsedDependency.success) {
      issues.push(
        ...parsedDependency.error.issues.map((issue) => ({
          level: "fatal" as const,
          code: "PACKAGE_SHAPE_INVALID",
          text: issue.message,
          path: ["dependencies", index, ...issue.path].join("."),
        })),
      );
      return;
    }

    dependencies.push(parsedDependency.data);
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, dependencies };
}

function detectUnsupportedDependencySource(input: unknown, index: number): PackageIssue | undefined {
  if (!isPlainObject(input)) {
    return undefined;
  }

  const trigger = isPlainObject(input.触发) ? input.触发 : undefined;
  if (isUnsupportedCounterType(trigger?.类型)) {
    return {
      level: "error",
      code: "UNSUPPORTED_DEPENDENCY_TRIGGER",
      text: "Dependency Logic v1 不支持 countableResource/counter 触发源。",
      path: `dependencies.${index}.触发.类型`,
    };
  }

  if (Array.isArray(input.sources)) {
    const sourceIndex = input.sources.findIndex((source) => isPlainObject(source) && isUnsupportedCounterType(source.类型));
    if (sourceIndex !== -1) {
      return {
        level: "error",
        code: "UNSUPPORTED_DEPENDENCY_SOURCE_MODULE",
        text: "Dependency Logic v1 不支持 countableResource/counter 触发源。",
        path: `dependencies.${index}.sources.${sourceIndex}.类型`,
      };
    }
  }

  return undefined;
}

function isUnsupportedCounterType(value: unknown): boolean {
  return value === "counter" || value === "counterChanged";
}

export function validateSystemPackage(input: unknown, sourceMap: PackageSourceMap = {}): PackageValidationResult {
  const result = validateSystemPackageCore(input);
  return { ...result, issues: result.issues.map((issue) => normalizePackageIssue(issue, sourceMap)) };
}

function validateSystemPackageCore(input: unknown): PackageValidationResult {
  const parsed = systemPackageEnvelopeSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        level: "fatal",
        code: "PACKAGE_SHAPE_INVALID",
        text: issue.message,
        path: issue.path.join("."),
      })),
    };
  }

  const moduleParseIssues: PackageIssue[] = [];
  const modules: SheetModule[] = [];

  parsed.data.modules.forEach((moduleInput, index) => {
    const moduleType = typeof moduleInput === "object" && moduleInput !== null && "类型" in moduleInput ? (moduleInput as { 类型?: unknown }).类型 : undefined;

    if (typeof moduleType === "string" && !supportedModuleTypes.has(moduleType)) {
      moduleParseIssues.push({
        level: "error",
        code: "UNSUPPORTED_MODULE_TYPE",
        text: `不支持的 Sheet Module 类型：${moduleType}`,
        path: `modules.${index}.类型`,
      });
      return;
    }

    if (moduleType === "cardTable" && isPlainObject(moduleInput) && "状态背景色" in moduleInput) {
      moduleParseIssues.push({
        level: "fatal",
        code: "PACKAGE_SHAPE_INVALID",
        text: "Card Table 的 `状态背景色` 已移除；请改用 `状态外观` 定义描边颜色和徽标。",
        path: `modules.${index}.状态背景色`,
      });
      return;
    }

    if (moduleType === "countableResource" && isPlainObject(moduleInput) && "标识字号" in moduleInput) {
      moduleParseIssues.push({
        level: "fatal",
        code: "PACKAGE_SHAPE_INVALID",
        text: "Countable Resource 的 `标识字号` 已移除；请改用 `标记尺寸`。",
        path: `modules.${index}.标识字号`,
      });
      return;
    }

    const parsedModule = sheetModuleSchema.safeParse(moduleInput);
    if (!parsedModule.success) {
      moduleParseIssues.push(
        ...parsedModule.error.issues.map((issue) => ({
          level: "fatal" as const,
          code: "PACKAGE_SHAPE_INVALID",
          text: issue.message,
          path: ["modules", index, ...issue.path].join("."),
        })),
      );
      return;
    }

    modules.push(parsedModule.data);
  });

  if (moduleParseIssues.length > 0) {
    return { ok: false, issues: moduleParseIssues };
  }

  const parsedDependencies = parseDependencyRules(parsed.data.dependencies ?? []);
  if (!parsedDependencies.ok) {
    return { ok: false, issues: parsedDependencies.issues };
  }

  const parsedGuide = parseCharacterCreationGuide(parsed.data.characterCreationGuide);
  if (!parsedGuide.ok) {
    return { ok: false, issues: parsedGuide.issues };
  }

  const normalizedResourceLibraries = normalizeResourceLibraries(parsed.data.resourceLibraries ?? []);
  if (!normalizedResourceLibraries.ok) {
    return { ok: false, issues: normalizedResourceLibraries.issues };
  }

  const {
    assets: rawAssets,
    resourceLibraries: _rawResourceLibraries,
    dependencies: _rawDependencies,
    characterCreationGuide: _rawGuide,
    ...packageData
  } = parsed.data;
  const systemPackage: SystemPackage = {
    ...packageData,
    modules,
    ...(rawAssets && rawAssets.length > 0 ? { assets: rawAssets } : {}),
    ...(parsedDependencies.dependencies.length > 0 ? { dependencies: parsedDependencies.dependencies } : {}),
    ...(normalizedResourceLibraries.resourceLibraries.length > 0 ? { resourceLibraries: normalizedResourceLibraries.resourceLibraries } : {}),
    ...(parsedGuide.guide ? { characterCreationGuide: parsedGuide.guide } : {}),
  };
  const issues: PackageIssue[] = [];

  const context = createValidationContext(systemPackage, issues);
  collectBaseValidationIssues(context);
  collectModuleValidationIssues(context);
  collectGuideValidationIssues(context);
  collectDependencyValidationIssues(context);
  collectCardValidationIssues(context);
  collectPresentationValidationIssues(context);
  collectScriptValidationIssues(context);
  collectCharacterTextExportValidationIssues(context);

  if (issues.some((issue) => issue.level === "error" || issue.level === "fatal")) {
    return { ok: false, issues };
  }

  return { ok: true, package: systemPackage, issues };
}

function normalizePackageIssue(issue: PackageIssue, sourceMap: PackageSourceMap): PackageIssue {
  const pointer = issue.location?.pointer ?? parseDiagnosticPointer(issue.path);
  const file = issue.location?.file ?? resolveSourceFile(pointer, sourceMap);
  const entities = issue.entities ?? inferDiagnosticEntities(pointer);
  return {
    ...issue,
    location: pointer.length > 0 || file || issue.location?.line !== undefined
      ? { ...issue.location, pointer, ...(file ? { file } : {}) }
      : undefined,
    ...(entities.length > 0 ? { entities } : {}),
  };
}

function parseDiagnosticPointer(path?: string): Array<string | number> {
  if (!path) return [];
  return path.split(".").filter(Boolean).map((part) => /^\d+$/.test(part) ? Number(part) : part);
}

function resolveSourceFile(pointer: Array<string | number>, sourceMap: PackageSourceMap): string | undefined {
  for (let length = pointer.length; length > 0; length -= 1) {
    const key = pointer.slice(0, length).join(".");
    if (sourceMap[key]) return sourceMap[key];
  }
  return undefined;
}

function inferDiagnosticEntities(pointer: Array<string | number>): PackageIssueEntity[] {
  const [root, identity] = pointer;
  const definitions: Record<string, PackageIssueEntity["kind"]> = {
    manifest: "manifest", pages: "page", modules: "module", assets: "asset",
    resourceLibraries: "resourceLibrary", dependencies: "dependency",
    validationChecks: "validationCheck", characterCreationGuide: "guideStep",
    questionnaireCharacterCreation: "questionnaire",
    characterTextExports: "manifest",
  };
  const kind = typeof root === "string" ? definitions[root] : undefined;
  if (!kind) return [];
  return [{ kind, ...(typeof identity === "number" ? { index: identity } : typeof identity === "string" ? { id: identity } : {}) }];
}
