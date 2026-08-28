import type {
  ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";

export type CharacterData = Readonly<Record<string, string>>;

export type ResourceSelectionDiagnostic = {
  code: string;
  location: string;
  params: Record<string, unknown>;
};

export type ResourceSelectionResult = {
  characterData: CharacterData;
  patches: Readonly<Record<string, string>>;
  diagnostics: ResourceSelectionDiagnostic[];
};

type Resource = ResourcePackageLogicalDocument["resources"][number];
type ResourceSelectionSystem = {
  dependencies: Array<{
    trigger: { type: "resourceSelected"; sourceModuleId: string };
    actions: Array<{
      targetModuleId: string;
      content:
        | { type: "selectedResourceField"; field: string }
        | { type: "selectedResourceTemplate"; format: string };
    }>;
  }>;
};

function diagnostic(
  code: string,
  location: string,
  params: Record<string, unknown> = {},
): ResourceSelectionDiagnostic {
  return { code, location, params };
}

function resourceFields(resource: Resource): Record<string, unknown> | null {
  return resource.data && typeof resource.data === "object" && !Array.isArray(resource.data)
    ? resource.data as Record<string, unknown>
    : null;
}

function readField(
  fields: Record<string, unknown>,
  field: string,
  location: string,
  diagnostics: ResourceSelectionDiagnostic[],
): string {
  const value = fields[field];
  if (typeof value === "string") return value;
  diagnostics.push(diagnostic(
    value === undefined
      ? "player.resource-selection.field-missing"
      : "player.resource-selection.field-not-text",
    location,
    { field },
  ));
  return "";
}

function formatTemplate(
  format: string,
  fields: Record<string, unknown>,
  location: string,
  diagnostics: ResourceSelectionDiagnostic[],
): string {
  return format.replace(/\{\{([^{}]+)\}\}/gu, (_placeholder, field: string) =>
    readField(fields, field, location, diagnostics));
}

export function applyResourceSelection(input: {
  characterData: CharacterData;
  currentSystem: ResourceSelectionSystem;
  sourceModuleId: string;
  selectedResource: Resource;
}): ResourceSelectionResult {
  const dependencies = input.currentSystem.dependencies.filter((dependency) =>
    dependency.trigger.type === "resourceSelected"
    && dependency.trigger.sourceModuleId === input.sourceModuleId);
  if (dependencies.length === 0) {
    return {
      characterData: input.characterData,
      patches: {},
      diagnostics: [diagnostic(
        "player.resource-selection.dependency-missing",
        "/dependencies",
        { sourceModuleId: input.sourceModuleId },
      )],
    };
  }

  const fields = resourceFields(input.selectedResource);
  if (!fields) {
    return {
      characterData: input.characterData,
      patches: {},
      diagnostics: [diagnostic(
        "player.resource-selection.data-invalid",
        "/selectedResource/data",
      )],
    };
  }

  const diagnostics: ResourceSelectionDiagnostic[] = [];
  const patches: Record<string, string> = {};
  dependencies.forEach((dependency, dependencyIndex) => {
    dependency.actions.forEach((action, actionIndex) => {
      const location = `/dependencies/${dependencyIndex}/actions/${actionIndex}/content`;
      if (Object.hasOwn(patches, action.targetModuleId)) {
        diagnostics.push(diagnostic(
          "player.resource-selection.target-conflict",
          `/dependencies/${dependencyIndex}/actions/${actionIndex}/targetModuleId`,
          { targetModuleId: action.targetModuleId },
        ));
        return;
      }
      patches[action.targetModuleId] = action.content.type === "selectedResourceField"
        ? readField(fields, action.content.field, location, diagnostics)
        : formatTemplate(action.content.format, fields, location, diagnostics);
    });
  });

  if (diagnostics.length > 0) {
    return { characterData: input.characterData, patches: {}, diagnostics };
  }
  return {
    characterData: { ...input.characterData, ...patches },
    patches,
    diagnostics: [],
  };
}
