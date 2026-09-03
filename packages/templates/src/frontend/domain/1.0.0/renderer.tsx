import { domainTemplate, type DomainData } from "../../../core/index.ts";
import { createReferenceCardRenderer, referenceCardStyles } from "../../reference-card/renderer-factory.tsx";

function formatLevel(value: string): string {
  const level = value.trim();
  return level && !level.endsWith("级") ? `${level}级` : level;
}

function formatRecall(value: string): string {
  return value.replaceAll("⚡", "").trim();
}

export const domainRendererStyles = `${referenceCardStyles}
.reference-card[data-template-id="领域卡"] .reference-card-body{padding-inline:16px}
.reference-card[data-template-id="领域卡"] .reference-card-stats{grid-template-columns:repeat(4,minmax(0,1fr));border-width:1px 0;background:transparent}
.reference-card[data-template-id="领域卡"] .reference-card-stat{padding:9px 4px}
.reference-card[data-template-id="领域卡"] .reference-card-stat b{font-size:17px}
.reference-card[data-template-id="领域卡"] .reference-card-stat span{font-size:9px}
.reference-card[data-template-id="领域卡"] .reference-card-flavor{flex:none;margin-top:auto}
`;
export const domainRendererRevision = createReferenceCardRenderer<DomainData>({
  revision: "domain-card-r1", templateId: "领域卡", templateVersion: "1.0.0",
  defaultState: (data) => domainTemplate.tabletop.defaultState(data),
  styles: domainRendererStyles,
  model: (data) => ({
    title: data.名称 || "未命名领域卡",
    originalTitle: data.原文,
    kicker: data.类型 || "领域卡",
    stats: [
      { label: "领域", value: data.领域 },
      { label: "等级", value: formatLevel(data.等级) },
      { label: "属性", value: data.属性 },
      { label: "回想", value: formatRecall(data.回想) },
    ],
    sections: [{ title: "能力", body: data.描述, hideTitle: true }],
    flavor: data.风味描述,
  }),
});
