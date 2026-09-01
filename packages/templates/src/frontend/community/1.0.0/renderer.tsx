import { communityTemplate, type CommunityData } from "../../../core/index.ts";
import { createReferenceCardRenderer, referenceCardStyles } from "../../reference-card/renderer-factory.tsx";

export const communityRendererStyles = referenceCardStyles;
export const communityRendererRevision = createReferenceCardRenderer<CommunityData>({
  revision: "community-card-r1", templateId: "社群", templateVersion: "1.0.0",
  defaultState: (data) => communityTemplate.tabletop.defaultState(data),
  model: (data) => ({ title: data.名称 || "未命名社群", kicker: data.类型 || "社群", meta: data.性格 ? [data.性格] : [], summary: data.简介, sections: [{ title: data.特性.名称 || "社群特性", body: data.特性.描述 }] }),
});
