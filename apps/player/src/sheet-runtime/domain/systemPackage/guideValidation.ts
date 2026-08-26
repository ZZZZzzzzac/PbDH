import { getHtmlTemplateGuideRegionIds } from "./htmlTemplate";
import type { ValidationContext } from "./validationContext";

export function collectGuideValidationIssues(context: ValidationContext): void {
  const { systemPackage, issues, moduleById, pageById } = context;
  // --- Guide steps ---
  const guideRegions = [
    ...systemPackage.pages.flatMap((page) =>
      getHtmlTemplateGuideRegionIds(page.layout.htmlContent).map((id) => ({ id, path: `pages.${page.ID}.layout.html` }))),
    ...(systemPackage.shell
      ? getHtmlTemplateGuideRegionIds(systemPackage.shell.htmlContent).map((id) => ({ id, path: "shell.html" }))
      : []),
  ];
  const guideRegionIds = new Set<string>();
  for (const region of guideRegions) {
    if (guideRegionIds.has(region.id)) {
      issues.push({
        level: "error",
        code: "DUPLICATE_GUIDE_REGION_ID",
        text: `Layout Region ID 重复：${region.id}`,
        path: region.path,
      });
    }
    guideRegionIds.add(region.id);
  }

  const guideStepIds = new Set<string>();
  for (const [stepIndex, step] of (systemPackage.characterCreationGuide?.步骤 ?? []).entries()) {
    if (guideStepIds.has(step.ID)) {
      issues.push({
        level: "error",
        code: "DUPLICATE_GUIDE_STEP_ID",
        text: `Guide Step ID 重复：${step.ID}`,
        path: `characterCreationGuide.步骤.${stepIndex}.ID`,
      });
    }
    guideStepIds.add(step.ID);

    if (step.目标?.类型 === "module" && !moduleById.has(step.目标.模块ID)) {
      issues.push({
        level: "error",
        code: "MISSING_GUIDE_TARGET_MODULE",
        text: `Guide Step 引用了不存在的 Sheet Module：${step.目标.模块ID}`,
        path: `characterCreationGuide.步骤.${stepIndex}.目标.模块ID`,
      });
    }

    if (step.目标?.类型 === "page" && !pageById.has(step.目标.页面ID)) {
      issues.push({
        level: "error",
        code: "MISSING_GUIDE_TARGET_PAGE",
        text: `Guide Step 引用了不存在的页面：${step.目标.页面ID}`,
        path: `characterCreationGuide.步骤.${stepIndex}.目标.页面ID`,
      });
    }

    if (step.目标?.类型 === "region" && !guideRegionIds.has(step.目标.区域ID)) {
      issues.push({
        level: "error",
        code: "MISSING_GUIDE_TARGET_REGION",
        text: `Guide Step 引用了不存在的 Layout Region：${step.目标.区域ID}`,
        path: `characterCreationGuide.步骤.${stepIndex}.目标.区域ID`,
      });
    }
  }

}
