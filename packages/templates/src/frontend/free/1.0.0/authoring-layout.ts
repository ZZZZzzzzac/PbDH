import type { AuthoringLayout } from "../../types.ts";

export const freeAuthoringLayout: AuthoringLayout = {
  templateId: "自由",
  templateVersion: "1.0.0",
  sections: [
    {
      id: "identity",
      label: "自由资源",
      fields: [
        { path: "名称", label: "名称", control: "text" },
        { path: "类型", label: "类型", control: "text" },
        { path: "简介", label: "简介", control: "textarea" },
      ],
    },
    {
      id: "content",
      label: "内容",
      fields: [],
      repeats: [{
        path: "内容",
        label: "内容块",
        itemFields: [
          { path: "标题", label: "标题", control: "text" },
          { path: "正文", label: "正文", control: "textarea" },
        ],
      }],
    },
  ],
};
