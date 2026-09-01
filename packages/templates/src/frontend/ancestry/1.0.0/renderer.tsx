import { ancestryTemplate, type AncestryData } from "../../../core/index.ts";
import { createReferenceCardRenderer, referenceCardStyles } from "../../reference-card/renderer-factory.tsx";

export const ancestryRendererStyles = referenceCardStyles;
export const ancestryRendererRevision = createReferenceCardRenderer<AncestryData>({
  revision: "ancestry-card-r1", templateId: "种族", templateVersion: "1.0.0",
  defaultState: (data) => ancestryTemplate.tabletop.defaultState(data),
  model: (data) => ({ title: data.名称 || "未命名种族", kicker: data.类型 || "种族", summary: data.简介, sections: data.特性.map((feature) => ({ title: feature.名称 || "种族特性", body: feature.描述 })) }),
});
