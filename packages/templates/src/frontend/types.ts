export type AuthoringControl = "text" | "textarea" | "string-list" | "string-map";

export type AuthoringField = {
  path: string;
  label: string;
  control: AuthoringControl;
  enum?: readonly string[];
};

export type AuthoringRepeat = {
  path: string;
  label: string;
  itemFields: readonly AuthoringField[];
};

export type AuthoringSection = {
  id: string;
  label: string;
  fields: readonly AuthoringField[];
  repeats?: readonly AuthoringRepeat[];
};

export type AuthoringLayout = {
  templateId: string;
  templateVersion: string;
  sections: readonly AuthoringSection[];
};
