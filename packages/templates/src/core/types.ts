export type TemplateLifecycleState = "development" | "published" | "deprecated";

export type TemplateProjection = {
  title: string;
  summary: string;
  searchText: string;
};

export type MediaSlot = {
  id: string;
  label: string;
  required: boolean;
  accepts: readonly string[];
};

export type TabletopCommand = {
  id: string;
  capability: "adjust-decimal-string" | "set-string";
  field: string;
  values?: readonly string[];
};

export type TabletopReplacement = {
  id: string;
  label: string;
};

export type TemplateUpgrade = {
  fromVersion: string;
  upgradeData: (data: Readonly<Record<string, unknown>>) => Record<string, unknown>;
};

export type TemplateCoreCapability<TData extends Record<string, unknown>> = {
  id: string;
  version: string;
  state: TemplateLifecycleState;
  schema: Record<string, unknown>;
  defaultData: TData;
  proposeResourceId: (data: TData) => string;
  project: (data: TData) => TemplateProjection;
  mediaSlots: readonly MediaSlot[];
  defaultPresentation: {
    mode: "text" | "split" | "image";
    fixedRatio: boolean;
  };
  rendererRevision: string;
  upgrades?: readonly TemplateUpgrade[];
  tabletop: {
    stateSchema: Record<string, unknown>;
    defaultState: (data: TData) => Record<string, string>;
    commands: readonly TabletopCommand[];
    replacements: readonly TabletopReplacement[];
  };
};

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
