import {
  Backpack,
  BriefcaseBusiness,
  Dna,
  FileText,
  Milestone,
  Orbit,
  Shield,
  Skull,
  Sword,
  Trees,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

type TemplateIconDefinition = {
  icon: LucideIcon;
  tone: "danger" | "combat" | "identity" | "community" | "vocation" | "mystic" | "nature" | "neutral";
};

const fallbackDefinition: TemplateIconDefinition = { icon: FileText, tone: "neutral" };

// 清晰版图标集。后续游戏风格图标应作为另一套映射加入，不覆盖这套回退方案。
const lucideTemplateIconDefinitions: Readonly<Record<string, TemplateIconDefinition>> = Object.freeze({
  敌人: { icon: Skull, tone: "danger" },
  武器: { icon: Sword, tone: "combat" },
  护甲: { icon: Shield, tone: "combat" },
  种族: { icon: Dna, tone: "identity" },
  社群: { icon: UsersRound, tone: "community" },
  职业: { icon: BriefcaseBusiness, tone: "vocation" },
  子职业: { icon: Milestone, tone: "vocation" },
  领域卡: { icon: Orbit, tone: "mystic" },
  环境: { icon: Trees, tone: "nature" },
  物品: { icon: Backpack, tone: "combat" },
  自由: { icon: FileText, tone: "neutral" },
});

export function TemplateIcon({ templateId }: { templateId: string }) {
  const Icon = (lucideTemplateIconDefinitions[templateId] ?? fallbackDefinition).icon;
  return <Icon className="icon template-icon" strokeWidth={1.8} absoluteStrokeWidth aria-hidden="true" />;
}

export function templateMarkClassName(templateId: string): string {
  const tone = (lucideTemplateIconDefinitions[templateId] ?? fallbackDefinition).tone;
  return `template-mark is-${tone}`;
}
