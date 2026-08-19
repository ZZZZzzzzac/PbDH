export type AuthoringControl = "text" | "textarea";

export type AuthoringField = {
  path: string;
  label: string;
  control: AuthoringControl;
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
