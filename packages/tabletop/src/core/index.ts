export type TabletopCapability =
  | "place"
  | "move"
  | "uniform-scale"
  | "rotate"
  | "flip"
  | "layer"
  | "arrange"
  | "clear"
  | "duplicate"
  | "delete"
  | "replace"
  | "edit-instance-data"
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
    mode: "text" | "split" | "image";
    fixedRatio: boolean;
  };
  data: Record<string, unknown>;
  labels: string[];
  replacements: Array<{ replacementId: string; targetResourceId: string }>;
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
  canvas: { width: number; height: number };
  instances: TabletopInstance[];
  assets: TabletopAsset[];
};

export type TemplateStateCommandDefinition = {
  id: string;
  capability: "adjust-decimal-string" | "set-string";
  field: string;
  values?: readonly string[];
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
  | { type: "move-many"; moves: Array<{ instanceId: string; position: { x: number; y: number } }> }
  | { type: "uniform-scale"; instanceId: string; scale: number }
  | { type: "rotate-quarter"; instanceId: string; quarterTurns: number }
  | { type: "flip"; instanceId: string }
  | { type: "layer"; instanceId: string; action: "front" | "forward" | "backward" | "back" }
  | { type: "arrange"; placements: Array<{ instanceId: string; position: { x: number; y: number }; layer: number; rotation?: number }> }
  | { type: "clear" }
  | { type: "duplicate"; instanceId: string; newInstanceId: string; offset?: { x: number; y: number } }
  | { type: "delete"; instanceId: string }
  | { type: "delete-many"; instanceIds: string[] }
  | {
      type: "replace";
      instanceId: string;
      newInstanceId: string;
      replacementId: string;
      resource: TabletopInstanceResourceCopy;
      state: Record<string, string>;
      assets?: TabletopAsset[];
    }
  | { type: "edit-instance-data"; instanceId: string; path: string[]; value: unknown }
  | { type: "replace-instance-data"; instanceId: string; data: Record<string, unknown> }
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
  "move-many": "move",
  "uniform-scale": "uniform-scale",
  "rotate-quarter": "rotate",
  flip: "flip",
  layer: "layer",
  arrange: "arrange",
  clear: "clear",
  duplicate: "duplicate",
  delete: "delete",
  "delete-many": "delete",
  replace: "replace",
  "edit-instance-data": "edit-instance-data",
  "replace-instance-data": "edit-instance-data",
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

export function nextTabletopLayer(instances: ReadonlyArray<{ layer: number }>): number {
  return instances.reduce((maximum, instance) => Math.max(maximum, instance.layer), -1) + 1;
}

function cloneDocument(document: TabletopDocumentModel): TabletopDocumentModel {
  return structuredClone(document);
}

function pruneAssets(document: TabletopDocumentModel): void {
  const referenced = new Set(document.instances.flatMap((instance) => Object.values(instance.resource.media)));
  document.assets = document.assets.filter((asset) => referenced.has(asset.id));
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

export type TemplateStateCommandResult =
  | { state: Record<string, string>; diagnostic: null }
  | { state: Record<string, string>; diagnostic: TabletopDiagnostic };

export function executeTemplateStateCommand(
  state: Readonly<Record<string, string>>,
  definition: TemplateStateCommandDefinition | undefined,
  commandId: string,
  value: string,
): TemplateStateCommandResult {
  if (!definition) {
    return {
      state: { ...state },
      diagnostic: diagnostic("tabletop.template-command.unsupported", "/command/commandId", { commandId }),
    };
  }
  if (definition.values && !definition.values.includes(value)) {
    return {
      state: { ...state },
      diagnostic: diagnostic("tabletop.state.value-not-allowed", "/command/value", { commandId, value }),
    };
  }
  const nextValue = definition.capability === "set-string"
    ? value
    : addDecimalStrings(state[definition.field] ?? "", value);
  if (nextValue === undefined) {
    return {
      state: { ...state },
      diagnostic: diagnostic("tabletop.state.invalid-decimal", `/state/${definition.field}`, {
        current: state[definition.field],
        delta: value,
      }),
    };
  }
  return {
    state: { ...state, [definition.field]: nextValue },
    diagnostic: null,
  };
}

export function createTabletopDocument(id: string, name: string): TabletopDocumentModel {
  return { id, name, canvas: { width: 2400, height: 1600 }, instances: [], assets: [] };
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
      layer: nextTabletopLayer(document.instances),
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

  if (command.type === "clear") {
    return { document: { ...cloneDocument(document), instances: [], assets: [] }, diagnostics: [] };
  }

  if (command.type === "arrange") {
    if (command.placements.length === 0) {
      return fail(document, "tabletop.arrange.empty", "/command/placements");
    }
    const seen = new Set<string>();
    for (const [index, placement] of command.placements.entries()) {
      if (seen.has(placement.instanceId)) {
        return fail(document, "tabletop.arrange.instance-duplicate", `/command/placements/${index}/instanceId`, {
          instanceId: placement.instanceId,
        });
      }
      seen.add(placement.instanceId);
      if (!document.instances.some((instance) => instance.id === placement.instanceId)) {
        return fail(document, "tabletop.instance.not-found", `/instances/${placement.instanceId}`, {
          instanceId: placement.instanceId,
        });
      }
      if (!validPosition(placement.position) || !Number.isSafeInteger(placement.layer) || placement.layer < 0
        || (placement.rotation !== undefined && !Number.isFinite(placement.rotation))) {
        return fail(document, "tabletop.arrange.placement-invalid", `/command/placements/${index}`);
      }
    }
    const next = cloneDocument(document);
    for (const placement of command.placements) {
      const instance = next.instances.find((candidate) => candidate.id === placement.instanceId)!;
      instance.position = structuredClone(placement.position);
      instance.layer = placement.layer;
      if (placement.rotation !== undefined) instance.rotation = normalizeQuarterRotation(placement.rotation);
    }
    return { document: next, diagnostics: [] };
  }

  if (command.type === "delete-many") {
    if (command.instanceIds.length === 0) return fail(document, "tabletop.delete-many.empty", "/command/instanceIds");
    const ids = new Set(command.instanceIds);
    if (ids.size !== command.instanceIds.length) return fail(document, "tabletop.delete-many.instance-duplicate", "/command/instanceIds");
    const missing = command.instanceIds.find((id) => !document.instances.some((instance) => instance.id === id));
    if (missing) return fail(document, "tabletop.instance.not-found", `/instances/${missing}`, { instanceId: missing });
    const next = cloneDocument(document);
    next.instances = next.instances.filter((instance) => !ids.has(instance.id));
    pruneAssets(next);
    return { document: next, diagnostics: [] };
  }

  if (command.type === "move-many") {
    if (command.moves.length === 0) {
      return fail(document, "tabletop.move-many.empty", "/command/moves");
    }
    const seen = new Set<string>();
    for (const [index, move] of command.moves.entries()) {
      if (seen.has(move.instanceId)) {
        return fail(document, "tabletop.move-many.instance-duplicate", `/command/moves/${index}/instanceId`, {
          instanceId: move.instanceId,
        });
      }
      seen.add(move.instanceId);
      if (!document.instances.some((instance) => instance.id === move.instanceId)) {
        return fail(document, "tabletop.instance.not-found", `/instances/${move.instanceId}`, {
          instanceId: move.instanceId,
        });
      }
      if (!validPosition(move.position)) {
        return fail(document, "tabletop.position.invalid", `/command/moves/${index}/position`);
      }
    }
    const next = cloneDocument(document);
    for (const move of command.moves) {
      next.instances.find((instance) => instance.id === move.instanceId)!.position = structuredClone(move.position);
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
  if (command.type === "rotate-quarter" && !Number.isSafeInteger(command.quarterTurns)) {
    return fail(document, "tabletop.rotation.invalid", "/command/quarterTurns", { quarterTurns: command.quarterTurns });
  }
  if (command.type === "move" && !validPosition(command.position)) {
    return fail(document, "tabletop.position.invalid", "/command/position");
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
      layer: nextTabletopLayer(document.instances),
    });
    return { document: next, diagnostics: [] };
  }

  if (command.type === "replace") {
    if (document.instances.some((instance) => instance.id === command.newInstanceId)) {
      return fail(document, "tabletop.instance-id.duplicate", "/command/newInstanceId", {
        instanceId: command.newInstanceId,
      });
    }
    const sourceInstance = document.instances[instanceIndex]!;
    if (!sourceInstance.resource.source) {
      return fail(document, "tabletop.replacement.source-missing", `/instances/${command.instanceId}/resource/source`);
    }
    const replacement = sourceInstance.resource.replacements.find(
      (candidate) => candidate.replacementId === command.replacementId,
    );
    if (!replacement) {
      return fail(document, "tabletop.replacement.unsupported", "/command/replacementId", {
        replacementId: command.replacementId,
      });
    }
    if (!command.resource.source
      || command.resource.source.packageId !== sourceInstance.resource.source.packageId
      || command.resource.source.resourceId !== replacement.targetResourceId) {
      return fail(document, "tabletop.replacement.target-mismatch", "/command/resource/source", {
        expectedPackageId: sourceInstance.resource.source.packageId,
        expectedResourceId: replacement.targetResourceId,
      });
    }
    const next = cloneDocument(document);
    next.instances[instanceIndex] = {
      id: command.newInstanceId,
      resource: structuredClone(command.resource),
      state: structuredClone(command.state),
      position: structuredClone(sourceInstance.position),
      layer: sourceInstance.layer,
      rotation: sourceInstance.rotation,
      flipped: false,
      scale: sourceInstance.scale,
    };
    for (const asset of command.assets ?? []) {
      if (!next.assets.some((candidate) => candidate.id === asset.id)) {
        next.assets.push(structuredClone(asset));
      }
    }
    pruneAssets(next);
    return { document: next, diagnostics: [] };
  }

  if (command.type === "delete") {
    const next = cloneDocument(document);
    next.instances.splice(instanceIndex, 1);
    pruneAssets(next);
    return { document: next, diagnostics: [] };
  }

  if (command.type === "template-state") {
    const sourceInstance = document.instances[instanceIndex]!;
    const definition = options.templateCommands?.(sourceInstance)
      .find((candidate) => candidate.id === command.commandId);
    const stateResult = executeTemplateStateCommand(
      sourceInstance.state,
      definition,
      command.commandId,
      command.value,
    );
    if (stateResult.diagnostic) {
      const params = definition
        ? stateResult.diagnostic.params
        : {
            ...stateResult.diagnostic.params,
            templateId: sourceInstance.resource.template.id,
            templateVersion: sourceInstance.resource.template.version,
          };
      const location = stateResult.diagnostic.code === "tabletop.state.invalid-decimal"
        ? `/instances/${command.instanceId}/state/${definition!.field}`
        : stateResult.diagnostic.location;
      return fail(document, stateResult.diagnostic.code, location, params);
    }
    const next = cloneDocument(document);
    next.instances[instanceIndex]!.state = stateResult.state;
    return { document: next, diagnostics: [] };
  }

  if (command.type === "rotate-quarter") {
    const next = cloneDocument(document);
    next.instances[instanceIndex]!.rotation = normalizeQuarterRotation(
      next.instances[instanceIndex]!.rotation + command.quarterTurns * 90,
    );
    return { document: next, diagnostics: [] };
  }

  if (command.type === "flip") {
    const next = cloneDocument(document);
    next.instances[instanceIndex]!.flipped = toggleTabletopFlipped(next.instances[instanceIndex]!.flipped);
    return { document: next, diagnostics: [] };
  }

  if (command.type === "layer") {
    const ordered = document.instances
      .map((instance, index) => ({ instance, index }))
      .sort((left, right) => left.instance.layer - right.instance.layer || left.index - right.index);
    const currentIndex = ordered.findIndex(({ instance }) => instance.id === command.instanceId);
    const targetIndex = command.action === "front"
      ? ordered.length - 1
      : command.action === "back"
        ? 0
        : command.action === "forward"
          ? Math.min(ordered.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
    const [entry] = ordered.splice(currentIndex, 1);
    ordered.splice(targetIndex, 0, entry!);
    const next = cloneDocument(document);
    ordered.forEach(({ instance }, layer) => {
      next.instances.find((candidate) => candidate.id === instance.id)!.layer = layer;
    });
    return { document: next, diagnostics: [] };
  }

  if (command.type === "edit-instance-data") {
    if (command.path.length === 0) {
      return fail(document, "tabletop.instance-data.path-empty", "/command/path");
    }
    const next = cloneDocument(document);
    let parent: unknown = next.instances[instanceIndex]!.resource.data;
    for (const segment of command.path.slice(0, -1)) {
      parent = Array.isArray(parent)
        ? parent[Number(segment)]
        : parent && typeof parent === "object"
          ? (parent as Record<string, unknown>)[segment]
          : undefined;
    }
    const leaf = command.path.at(-1)!;
    if (Array.isArray(parent)) parent[Number(leaf)] = command.value;
    else (parent as Record<string, unknown>)[leaf] = command.value;
    return { document: next, diagnostics: [] };
  }

  if (command.type === "replace-instance-data") {
    const next = cloneDocument(document);
    next.instances[instanceIndex]!.resource.data = structuredClone(command.data);
    return { document: next, diagnostics: [] };
  }

  const next = cloneDocument(document);
  const instance = next.instances[instanceIndex]!;
  if (command.type === "move") instance.position = structuredClone(command.position);
  if (command.type === "uniform-scale") instance.scale = command.scale;
  return { document: next, diagnostics: [] };
}

function validPosition(position: { x: number; y: number }): boolean {
  return Number.isFinite(position.x) && Number.isFinite(position.y);
}

export function normalizeQuarterRotation(rotation: number): number {
  return ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
}

export function toggleTabletopFlipped(flipped: boolean): boolean {
  return !flipped;
}

export function clampTabletopPosition(
  instance: Pick<TabletopInstance, "resource" | "scale"> & Partial<Pick<TabletopInstance, "rotation">>,
  bounds: {
    width: number;
    height: number;
    minimumVisible?: number;
    containment?: "partial" | "full";
    pixelsPerUnit?: number;
  },
  position: { x: number; y: number },
): { x: number; y: number } {
  const visible = bounds.minimumVisible ?? 40;
  const pixelsPerUnit = bounds.pixelsPerUnit ?? 1;
  const canonicalWidth = 63;
  const canonicalHeight = 88;
  const width = canonicalWidth * pixelsPerUnit * instance.scale;
  const height = canonicalHeight * pixelsPerUnit * instance.scale;
  const rotation = normalizeQuarterRotation(instance.rotation ?? 0);
  const extents = rotation === 90
    ? { left: -height, top: 0, right: 0, bottom: width }
    : rotation === 180
      ? { left: -width, top: -height, right: 0, bottom: 0 }
      : rotation === 270
        ? { left: 0, top: -width, right: height, bottom: 0 }
        : { left: 0, top: 0, right: width, bottom: height };
  const clampAxis = (value: number, lower: number, upper: number) => lower <= upper
    ? Math.min(upper, Math.max(lower, value))
    : (lower + upper) / 2;
  const full = bounds.containment === "full";
  const minimumX = (full ? 0 : visible) - extents.left;
  const maximumX = bounds.width - (full ? 0 : visible) - extents.right;
  const minimumY = (full ? 0 : visible) - extents.top;
  const maximumY = bounds.height - (full ? 0 : visible) - extents.bottom;
  return {
    x: clampAxis(position.x, minimumX, maximumX),
    y: clampAxis(position.y, minimumY, maximumY),
  };
}
