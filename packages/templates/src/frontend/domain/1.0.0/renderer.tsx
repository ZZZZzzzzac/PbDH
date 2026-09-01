import { domainTemplate, type DomainData } from "../../../core/index.ts";
import { createReferenceCardRenderer, referenceCardStyles } from "../../reference-card/renderer-factory.tsx";

export const domainRendererStyles = referenceCardStyles;
export const domainRendererRevision = createReferenceCardRenderer<DomainData>({
  revision: "domain-card-r1", templateId: "领域卡", templateVersion: "1.0.0",
  defaultState: (data) => domainTemplate.tabletop.defaultState(data),
  model: (data) => ({ title: data.名称 || "未命名领域卡", kicker: data.类型 || "领域卡", meta: [data.领域, data.等级 ? `${data.等级}级` : "", data.属性].filter(Boolean), stats: data.回想 ? [{ label: "回想", value: data.回想 }] : [], sections: [{ title: "能力", body: data.描述 }], flavor: data.风味描述 }),
});
