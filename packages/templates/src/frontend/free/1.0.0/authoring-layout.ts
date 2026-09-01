import type { AuthoringLayout } from "../../types.ts";

export const freeAuthoringLayout: AuthoringLayout = {
  templateId: "自由",
  templateVersion: "1.0.0",
  sections: [
    {
      id: "identity",
      label: "自由资源",
      columns: 2,
      fields: [
        { path: "名称", label: "名称", control: "text" },
        { path: "类型", label: "类型", control: "text" },
      ],
    },
    {
      id: "content",
      label: "内容",
      columns: 1,
      fields: [],
      repeats: [{
        path: "内容",
        label: "内容块",
        itemFields: [
          { path: "标题", label: "标题", control: "text" },
          { path: "正文", label: "正文", control: "textarea", span: 2 },
        ],
        columns: 2,
        itemDefaults: { 标题: "新内容", 正文: "" },
      }],
    },
  ],
};
