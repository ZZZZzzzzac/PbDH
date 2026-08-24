const systemId = "01a0132c-4eef-7703-94ac-ec8d1a660001";

export const catalogOptions = {
  templateIds: [
    { value: "敌人", label: "敌人" },
    { value: "武器", label: "武器" },
  ],
  systems: [{ value: systemId, label: "Daggerheart Core" }],
  languages: [{ value: "中文", label: "中文" }],
  categories: [
    { value: "敌人", label: "敌人" },
    { value: "武器", label: "武器" },
    { value: "装备", label: "装备" },
    { value: "遭遇", label: "遭遇" },
  ],
} as const;
