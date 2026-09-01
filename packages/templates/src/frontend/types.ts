export type AuthoringControl = "text" | "textarea" | "string-list" | "string-map" | "single-entry-map-list";

export type AuthoringField = {
  path: string;
  label: string;
  control: AuthoringControl;
  enum?: readonly string[];
  span?: number;
  labelWidth?: number;
};

export type AuthoringRepeat = {
  path: string;
  label: string;
  itemFields: readonly AuthoringField[];
  columns: number;
  itemDefaults: Readonly<Record<string, unknown>>;
  allowClear?: boolean;
  confirmDelete?: boolean;
};

export type AuthoringSection = {
  id: string;
  label: string;
  fields: readonly AuthoringField[];
  repeats?: readonly AuthoringRepeat[];
  columns: number;
  showLabel?: boolean;
};

export type AuthoringLayout = {
  templateId: string;
  templateVersion: string;
  sections: readonly AuthoringSection[];
  replacements?: "after";
};

export type AuthoringPreviewControl =
  | {
      kind: "counter";
      label: string;
      statePath: string;
      commandId: string;
    }
  | {
      kind: "toggle";
      label: string;
      statePath: string;
      commandId: string;
      activeValue: string;
      inactiveValue: string;
    }
  | {
      kind: "text";
      label: string;
      statePath: string;
      commandId: string;
      placeholder?: string;
    };

export type TemplateAuthoringCapability = {
  layout: AuthoringLayout;
  previewControls: readonly AuthoringPreviewControl[];
};
