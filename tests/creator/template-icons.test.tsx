import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  TemplateIcon,
  templateMarkClassName,
} from "../../apps/creator/src/workspace-prototype/TemplateIcon.tsx";

describe("Creator template icons", () => {
  test.each([
    ["敌人", "skull", "danger"],
    ["武器", "sword", "combat"],
    ["护甲", "shield", "combat"],
    ["种族", "dna", "identity"],
    ["社群", "users-round", "community"],
    ["职业", "briefcase-business", "vocation"],
    ["子职业", "milestone", "vocation"],
    ["领域卡", "orbit", "mystic"],
    ["环境", "trees", "nature"],
    ["物品", "backpack", "combat"],
    ["自由", "file-text", "neutral"],
  ])("maps %s to Lucide %s", (templateId, iconName, tone) => {
    const markup = renderToStaticMarkup(<TemplateIcon templateId={templateId} />);

    expect(markup).toContain(`lucide-${iconName}`);
    expect(templateMarkClassName(templateId)).toBe(`template-mark is-${tone}`);
  });

  test("uses a neutral document icon for future unknown templates", () => {
    const markup = renderToStaticMarkup(<TemplateIcon templateId="未来模板" />);

    expect(markup).toContain("lucide-file-text");
    expect(templateMarkClassName("未来模板")).toBe("template-mark is-neutral");
  });
});
