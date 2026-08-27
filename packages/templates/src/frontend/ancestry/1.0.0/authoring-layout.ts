import type { AuthoringLayout } from "../../types.ts";

export const ancestryAuthoringLayout: AuthoringLayout = {
  templateId: "种族",
  templateVersion: "1.0.0",
  sections: [
    { id: "identity", label: "基本信息", fields: [
      { path: "名称", label: "名称", control: "text" },
      { path: "简介", label: "简介", control: "textarea" },
    ] },
    { id: "features", label: "种族特性", fields: [], repeats: [{
      path: "特性", label: "特性", itemFields: [
        { path: "名称", label: "名称", control: "text" },
        { path: "描述", label: "描述", control: "textarea" },
      ],
    }] },
  ],
};
