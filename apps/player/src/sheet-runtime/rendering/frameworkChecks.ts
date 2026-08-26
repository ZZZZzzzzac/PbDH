import type { ValidationIssue } from "../domain/validationRunner";

export function collectFrameworkValidationIssues(root: ParentNode): ValidationIssue[] {
  return [...root.querySelectorAll<HTMLElement>('[data-text-fit="overflow"]')].flatMap((element) => {
    const longText = element.closest<HTMLElement>('[data-module-type="longText"]');
    if (longText) {
      const moduleId = longText.dataset.moduleId ?? "unknown";
      return [{
        level: "warning" as const,
        code: "TEXT_CONTENT_OVERFLOW",
        text: "Long Text 内容在最低字号下仍超出固定高度，可滚动查看或精简内容。",
        path: `character.values.${moduleId}`,
        source: "framework",
      }];
    }

    const freeText = element.closest<HTMLElement>('[data-module-type="freeText"]');
    if (freeText) {
      const moduleId = freeText.dataset.moduleId ?? "unknown";
      return [{
        level: "warning" as const,
        code: "TEXT_CONTENT_OVERFLOW",
        text: "Free Text 内容在最低字号下仍超出单行宽度，可进入编辑查看或精简内容。",
        path: `character.values.${moduleId}`,
        source: "framework",
      }];
    }

    const card = element.closest<HTMLElement>('[data-card-instance-id]');
    if (card && element.classList.contains("play-card-description")) {
      const instanceId = card.dataset.cardInstanceId ?? "unknown";
      const name = card.getAttribute("aria-label") ?? instanceId;
      return [{
        level: "warning" as const,
        code: "TEXT_CONTENT_OVERFLOW",
        text: `Card ${name}的描述在最低字号下仍被截断，可打开详情查看或精简内容。`,
        path: `cards.instances.${instanceId}`,
        source: "framework",
      }];
    }

    return [];
  });
}
