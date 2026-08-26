export type TabletopCapability =
  | "place"
  | "move"
  | "uniform-scale"
  | "duplicate"
  | "delete"
  | "edit-instance-resource"
  | "template-state-command";

export type TabletopCapabilitySet = ReadonlySet<TabletopCapability>;

export type TabletopDiagnostic = {
  code: string;
  severity: "error";
  location: string;
  params: Record<string, unknown>;
};

export type TabletopInstanceResourceCopy = {
  source: {
    packageId: string;
    resourceId: string;
  } | null;
  template: {
    id: string;
    version: string;
  };
  presentation: {
    width: string;
    height: string;
    unit: "mm";
    mode: "text" | "split" | "image";
    fixedRatio: boolean;
  };
  data: Record<string, unknown>;
  labels: string[];
  media: Record<string, string>;
};

export type TabletopAsset = {
  id: string;
  mediaType: "image/webp";
  byteLength: string;
  width: string;
  height: string;
};

export type TabletopInstance = {
  id: string;
  resource: TabletopInstanceResourceCopy;
  state: Record<string, string>;
  position: { x: number; y: number };
  layer: number;
  rotation: number;
  flipped: boolean;
  scale: number;
};

export type TabletopDocumentModel = {
  id: string;
  name: string;
  instances: TabletopInstance[];
  assets: TabletopAsset[];
};

export type TemplateStateCommandDefinition = {
  id: string;
  capability: "adjust-decimal-string" | "set-string";
  field: string;
};

export type TabletopCommand =
  | {
      type: "place";
      instanceId: string;
      resource: TabletopInstanceResourceCopy;
      state: Record<string, string>;
      position: { x: number; y: number };
      assets?: TabletopAsset[];
    }
  | { type: "move"; instanceId: string; position: { x: number; y: number } }
  | { type: "uniform-scale"; instanceId: string; scale: number }
  | { type: "duplicate"; instanceId: string; newInstanceId: string; offset?: { x: number; y: number } }
  | { type: "delete"; instanceId: string }
  | {
      type: "replace-instance-resource";
      instanceId: string;
      resource: Omit<TabletopInstanceResourceCopy, "source" | "template">;
    }
  | { type: "template-state"; instanceId: string; commandId: string; value: string };

export type ExecuteTabletopCommandOptions = {
  capabilities: TabletopCapabilitySet;
  templateCommands?: (instance: TabletopInstance) => readonly TemplateStateCommandDefinition[];
};

export type TabletopCommandResult = {
  document: TabletopDocumentModel;
  diagnostics: TabletopDiagnostic[];
};

const commandCapability: Record<TabletopCommand["type"], TabletopCapability> = {
  place: "place",
  move: "move",
  "uniform-scale": "uniform-scale",
  duplicate: "duplicate",
  delete: "delete",
  "replace-instance-resource": "edit-instance-resource",
  "template-state": "template-state-command",
};

function diagnostic(code: string, location: string, params: Record<string, unknown> = {}): TabletopDiagnostic {
  return { code, severity: "error", location, params };
}

function fail(
  document: TabletopDocumentModel,
  code: string,
  location: string,
  params: Record<string, unknown> = {},
): TabletopCommandResult {
  return { document, diagnostics: [diagnostic(code, location, params)] };
}

function nextLayer(document: TabletopDocumentModel): number {
  return document.instances.reduce((maximum, instance) => Math.max(maximum, instance.layer), -1) + 1;
}

function cloneDocument(document: TabletopDocumentModel): TabletopDocumentModel {
  return structuredClone(document);
}

function decimalParts(value: string): { coefficient: bigint; scale: number } | undefined {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return undefined;
  const fraction = match[3] ?? "";
  const sign = match[1] === "-" ? -1n : 1n;
  return { coefficient: sign * BigInt(`${match[2]}${fraction}`), scale: fraction.length };
}

function formatDecimal(coefficient: bigint, scale: number): string {
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, "0");
  const integer = scale === 0 ? digits : digits.slice(0, -scale);
  const fraction = scale === 0 ? "" : digits.slice(-scale).replace(/0+$/, "");
  const normalized = fraction ? `${integer}.${fraction}` : integer;
  return negative && normalized !== "0" ? `-${normalized}` : normalized;
}

function addDecimalStrings(left: string, right: string): string | undefined {
  const leftParts = decimalParts(left);
  const rightParts = decimalParts(right);
  if (!leftParts || !rightParts) return undefined;
  const scale = Math.max(leftParts.scale, rightParts.scale);
  const leftCoefficient = leftParts.coefficient * (10n ** BigInt(scale - leftParts.scale));
  const rightCoefficient = rightParts.coefficient * (10n ** BigInt(scale - rightParts.scale));
  return formatDecimal(leftCoefficient + rightCoefficient, scale);
}

export function createTabletopDocument(id: string, name: string): TabletopDocumentModel {
  return { id, name, instances: [], assets: [] };
}

export function executeTabletopCommand(
  document: TabletopDocumentModel,
  command: TabletopCommand,
  options: ExecuteTabletopCommandOptions,
): TabletopCommandResult {
  const requiredCapability = commandCapability[command.type];
  if (!options.capabilities.has(requiredCapability)) {
    return fail(document, "tabletop.capability.denied", "/command", {
      capability: requiredCapability,
      command: command.type,
    });
  }

  if (command.type === "place") {
    if (document.instances.some((instance) => instance.id === command.instanceId)) {
      return fail(document, "tabletop.instance-id.duplicate", "/command/instanceId", {
        instanceId: command.instanceId,
      });
    }
    const next = cloneDocument(document);
    next.instances.push({
      id: command.instanceId,
      resource: structuredClone(command.resource),
      state: structuredClone(command.state),
      position: structuredClone(command.position),
      layer: nextLayer(document),
      rotation: 0,
      flipped: false,
      scale: 1,
    });
    for (const asset of command.assets ?? []) {
      if (!next.assets.some((candidate) => candidate.id === asset.id)) {
        next.assets.push(structuredClone(asset));
      }
    }
    return { document: next, diagnostics: [] };
  }

  const instanceIndex = document.instances.findIndex((instance) => instance.id === command.instanceId);
  if (instanceIndex < 0) {
    return fail(document, "tabletop.instance.not-found", `/instances/${command.instanceId}`, {
      instanceId: command.instanceId,
    });
  }

  if (command.type === "uniform-scale" && (!Number.isFinite(command.scale) || command.scale <= 0)) {
    return fail(document, "tabletop.scale.invalid", "/command/scale", { scale: command.scale });
  }

  if (command.type === "duplicate") {
    if (document.instances.some((instance) => instance.id === command.newInstanceId)) {
      return fail(document, "tabletop.instance-id.duplicate", "/command/newInstanceId", {
        instanceId: command.newInstanceId,
      });
    }
    const next = cloneDocument(document);
    const source = next.instances[instanceIndex]!;
    const offset = command.offset ?? { x: 24, y: 24 };
    next.instances.push({
      ...structuredClone(source),
      id: command.newInstanceId,
      position: { x: source.position.x + offset.x, y: source.position.y + offset.y },
      layer: nextLayer(document),
    });
    return { document: next, diagnostics: [] };
  }

  if (command.type === "delete") {
    const next = cloneDocument(document);
    next.instances.splice(instanceIndex, 1);
    return { document: next, diagnostics: [] };
  }

  if (command.type === "template-state") {
    const sourceInstance = document.instances[instanceIndex]!;
    const definition = options.templateCommands?.(sourceInstance)
      .find((candidate) => candidate.id === command.commandId);
    if (!definition) {
      return fail(document, "tabletop.template-command.unsupported", "/command/commandId", {
        commandId: command.commandId,
        templateId: sourceInstance.resource.template.id,
        templateVersion: sourceInstance.resource.template.version,
      });
    }
    const nextValue = definition.capability === "set-string"
      ? command.value
      : addDecimalStrings(sourceInstance.state[definition.field] ?? "", command.value);
    if (nextValue === undefined) {
      return fail(document, "tabletop.state.invalid-decimal", `/instances/${command.instanceId}/state/${definition.field}`, {
        current: sourceInstance.state[definition.field],
        delta: command.value,
      });
    }
    const next = cloneDocument(document);
    next.instances[instanceIndex]!.state[definition.field] = nextValue;
    return { document: next, diagnostics: [] };
  }

  const next = cloneDocument(document);
  const instance = next.instances[instanceIndex]!;
  if (command.type === "move") instance.position = structuredClone(command.position);
  if (command.type === "uniform-scale") instance.scale = command.scale;
  if (command.type === "replace-instance-resource") {
    instance.resource = {
      source: instance.resource.source,
      template: instance.resource.template,
      ...structuredClone(command.resource),
    };
  }
  return { document: next, diagnostics: [] };
}
