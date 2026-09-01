import { professionTemplate, type ProfessionData } from "../../../core/index.ts";
import { createReferenceCardRenderer, referenceCardStyles } from "../../reference-card/renderer-factory.tsx";

export const professionRendererStyles = referenceCardStyles;
export const professionRendererRevision = createReferenceCardRenderer<ProfessionData>({
  revision: "profession-card-r1", templateId: "职业", templateVersion: "1.0.0",
  defaultState: (data) => professionTemplate.tabletop.defaultState(data),
  model: (data) => ({
    title: data.名称 || "未命名职业", kicker: data.类型 || "职业", meta: [...data.领域, data.施法属性].filter(Boolean), summary: data.描述,
    stats: [{ label: "生命", value: data.生命点 }, { label: "闪避", value: data.闪避值 }],
    sections: [
      { title: "希望特性", body: data.希望特性 }, { title: "职业特性", body: data.职业特性 },
      { title: "职业物品", body: data.职业物品 },
      { title: "推荐初始属性", body: data.推荐初始属性.flatMap((entry) => Object.entries(entry).map(([name, score]) => `${name} ${score}`)).join("\n") },
      { title: "推荐初始装备", body: [...data.推荐初始武器, data.推荐初始护甲].filter(Boolean).join("\n") },
      { title: "背景问题", body: data.背景问题.join("\n") }, { title: "关系问题", body: data.关系问题.join("\n") },
    ],
  }),
});
