import type { ComponentType } from "react";

export type TemplateAuthoringEditorProps = {
  data: Record<string, unknown>;
  onValue(path: string, value: unknown): void;
};

export type TemplateAuthoringCapability = {
  templateId: string;
  templateVersion: string;
  Editor: ComponentType<TemplateAuthoringEditorProps>;
  replacements?: "after";
};
