import { subclassTemplate, type SubclassData } from "../../../core/index.ts";
import { createReferenceCardRenderer, referenceCardStyles } from "../../reference-card/renderer-factory.tsx";

export const subclassRendererStyles = referenceCardStyles + `
[data-template-id="子职业"] .reference-card-body{padding:14px 15px 28px;gap:10px}
[data-template-id="子职业"] .reference-card-stats{grid-template-columns:repeat(3,minmax(0,1fr));background:transparent;border-width:1px 0;border-color:#bea17b}
[data-template-id="子职业"] .reference-card-stat{padding:9px 4px;border-color:#d1b995}
[data-template-id="子职业"] .reference-card-stat b{font-size:17px;line-height:1.05}
[data-template-id="子职业"] .reference-card-stat span{margin-top:4px;font-size:9px;line-height:1;letter-spacing:.08em}
[data-template-id="子职业"] .reference-card-sections{gap:8px}
[data-template-id="子职业"] .reference-card-flavor{flex:none;margin-top:auto}
`;
export const subclassRendererRevision = createReferenceCardRenderer<SubclassData>({
  revision: "subclass-card-r2", templateId: "子职业", templateVersion: "1.0.0",
  defaultState: (data) => subclassTemplate.tabletop.defaultState(data),
  styles: subclassRendererStyles,
  model: (data) => {
    const features = Array.isArray(data.特性) ? data.特性 : [];
    return {
      title: data.名称 || "未命名子职业",
      originalTitle: data.原文,
      kicker: data.类型 || "子职业",
      stats: [
        { label: "主职", value: data.主职 },
        { label: "阶段", value: data.等级 },
        { label: "施法属性", value: data.施法属性 },
      ],
      sections: features.map((feature) => ({ title: feature.名称 || "未命名特性", originalTitle: feature.原名, body: feature.特性描述 })),
      flavor: data.风味描述,
    };
  },
});
