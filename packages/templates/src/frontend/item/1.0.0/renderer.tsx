import { itemTemplate, type ItemData } from "../../../core/index.ts";
import { createReferenceCardRenderer, referenceCardStyles } from "../../reference-card/renderer-factory.tsx";

export const itemRendererStyles = referenceCardStyles;
export const itemRendererRevision = createReferenceCardRenderer<ItemData>({
  revision: "item-card-r1", templateId: "物品", templateVersion: "1.0.0",
  defaultState: (data) => itemTemplate.tabletop.defaultState(data),
  model: (data) => ({ title: data.名称 || "未命名物品", kicker: data.类型 || "物品", stats: data.掷骰 ? [{ label: "掷骰", value: data.掷骰 }] : [], sections: [{ title: "效果", body: data.描述 }], flavor: data.风味描述 }),
});
