import type { GuideStep } from "../../domain/characterCreationGuide";
import {
  getHtmlTemplateGuideRegionIds,
  getHtmlTemplateModuleReferences,
  type SystemPackage,
} from "../../domain/systemPackage";

export function resolveGuideTargetPageId(systemPackage: SystemPackage, step: GuideStep | undefined): string | null {
  const target = step?.目标;
  if (!target) return null;
  if (target.类型 === "page") return target.页面ID;

  const references = target.类型 === "module" ? getHtmlTemplateModuleReferences : getHtmlTemplateGuideRegionIds;
  const targetId = target.类型 === "module" ? target.模块ID : target.区域ID;
  if (systemPackage.shell && references(systemPackage.shell.htmlContent).includes(targetId)) return null;
  return systemPackage.pages.find((page) => references(page.layout.htmlContent).includes(targetId))?.ID ?? null;
}
