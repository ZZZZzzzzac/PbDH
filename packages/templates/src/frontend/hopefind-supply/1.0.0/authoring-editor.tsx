import { FreeAuthoringEditor } from "../../free/1.0.0/authoring-editor";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types";
function Editor(props: TemplateAuthoringEditorProps) {
  return <><label>尺寸（宽×高，或大件）<input value={String(props.data.尺寸 ?? "1×1")} onChange={(event) => props.onValue("尺寸", event.target.value)} /></label><FreeAuthoringEditor {...props} /></>;
}
export const hopefindSupplyAuthoring: TemplateAuthoringCapability = { templateId: "寻望物资", templateVersion: "1.0.0", replacements: "after", Editor };
