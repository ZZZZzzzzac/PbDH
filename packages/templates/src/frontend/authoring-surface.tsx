import type { TemplateAuthoringCapability } from "./types.ts";

export function TemplateAuthoringSurface({
  authoring,
  data,
  onValue,
  onData,
}: {
  authoring: TemplateAuthoringCapability;
  data: Record<string, unknown>;
  onValue(path: string, value: unknown): void;
  onData?(data: Record<string, unknown>): void;
}) {
  const Editor = authoring.Editor;
  return <section data-template-authoring={`${authoring.templateId}@${authoring.templateVersion}`}>
    <Editor data={data} onValue={onValue} onData={onData} />
  </section>;
}
