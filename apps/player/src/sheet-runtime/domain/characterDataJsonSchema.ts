import type { SheetModule, SystemPackage } from "./systemPackage";

type JsonSchema = Record<string, unknown>;

export function deriveCharacterDataJsonSchema(
  systemPackage: Pick<SystemPackage, "modules">,
): JsonSchema {
  const stateful = systemPackage.modules.filter(isStatefulModule);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Character Data",
    description: "由 System Package Modules 推导的只读生成物；不要手工编辑。",
    type: "object",
    required: stateful.map((module) => module.ID),
    properties: Object.fromEntries(stateful.map((module) => [module.ID, moduleStateSchema(module)])),
    additionalProperties: false,
  };
}

function isStatefulModule(module: SheetModule): boolean {
  return module.类型 === "freeText" || module.类型 === "longText"
    || module.类型 === "checkboxResource" || module.类型 === "countableResource"
    || module.类型 === "imageField" || module.类型 === "cardTable";
}

function moduleStateSchema(module: SheetModule): JsonSchema {
  if (module.类型 === "freeText" || module.类型 === "longText") return { type: "string" };
  if (module.类型 === "checkboxResource") {
    return {
      type: "object",
      required: module.选项.map((option) => option.ID),
      properties: Object.fromEntries(module.选项.map((option) => [option.ID, { type: "boolean" }])),
      additionalProperties: false,
    };
  }
  if (module.类型 === "countableResource") {
    return {
      type: "object",
      required: ["current", "max"],
      properties: {
        current: { type: "integer", minimum: module.最小值 ?? 0 },
        max: module.最大值可改
          ? { anyOf: [{ type: "integer" }, { type: "null" }] }
          : { const: module.最大值 ?? null },
      },
      additionalProperties: false,
    };
  }
  if (module.类型 === "imageField") {
    return {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          required: ["assetId"],
          properties: { assetId: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" } },
          additionalProperties: false,
        },
      ],
    };
  }
  if (module.类型 === "cardTable") {
    return {
      type: "object",
      required: ["instances"],
      properties: { instances: { type: "array", items: tabletopInstanceSchema() } },
      additionalProperties: false,
    };
  }
  return false as never;
}

function tabletopInstanceSchema(): JsonSchema {
  return {
    type: "object",
    required: ["instanceId", "resourceCopy", "state", "geometry"],
    properties: {
      instanceId: { type: "string", minLength: 1 },
      resourceCopy: {
        type: "object",
        required: ["source", "template", "presentation", "data", "labels", "media"],
        properties: {
          source: { anyOf: [{ type: "null" }, { type: "object" }] },
          template: { type: "object" },
          presentation: { type: "object" },
          data: { type: "object" },
          labels: { type: "array", items: { type: "string" } },
          media: { type: "object", additionalProperties: { type: "string" } },
        },
        additionalProperties: false,
      },
      state: { type: "object", additionalProperties: { type: "string" } },
      geometry: {
        type: "object",
        required: ["x", "y", "layer", "rotation", "scale", "flipped"],
        properties: {
          x: { type: "number" }, y: { type: "number" }, layer: { type: "integer" },
          rotation: { type: "number" }, scale: { type: "number", exclusiveMinimum: 0 }, flipped: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  };
}
