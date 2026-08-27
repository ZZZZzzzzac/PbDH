import type { AuthoringLayout } from "../../types.ts";

export const communityAuthoringLayout: AuthoringLayout = {
  templateId: "社群",
  templateVersion: "1.0.0",
  sections: [
    { id: "identity", label: "基本信息", fields: [
      { path: "名称", label: "名称", control: "text" },
      { path: "性格", label: "性格", control: "text" },
      { path: "简介", label: "简介", control: "textarea" },
    ] },
    { id: "feature", label: "社群特性", fields: [
      { path: "特性.名称", label: "特性名称", control: "text" },
      { path: "特性.描述", label: "特性描述", control: "textarea" },
    ] },
  ],
};
