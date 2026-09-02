import { subclassTemplate, type SubclassData } from "../../../core/index.ts";
import { createReferenceCardRenderer, referenceCardStyles } from "../../reference-card/renderer-factory.tsx";

export const subclassRendererStyles = referenceCardStyles;
export const subclassRendererRevision = createReferenceCardRenderer<SubclassData>({
  revision: "subclass-card-r1", templateId: "子职业", templateVersion: "1.0.0",
  defaultState: (data) => subclassTemplate.tabletop.defaultState(data),
  model: (data) => ({ title: data.名称 || "未命名子职业", originalTitle: data.原文, kicker: data.类型 || "子职业", meta: [data.主职, data.等级, data.施法属性].filter(Boolean), sections: [{ title: "能力", body: data.描述 }], flavor: data.风味描述 }),
});
