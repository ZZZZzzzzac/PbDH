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
    width: string;
    height: string;
    unit: "mm";
    mode: "text" | "split" | "image";
    fixedRatio: boolean;
  };
  rendererRevision: string;
  tabletop: {
    stateSchema: Record<string, unknown>;
    defaultState: (data: TData) => Record<string, string>;
    commands: readonly TabletopCommand[];
    replacements: readonly unknown[];
  };
  upgradeFrom: null | {
    version: string;
    upgrade: (data: unknown) => TData;
  };
};

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
