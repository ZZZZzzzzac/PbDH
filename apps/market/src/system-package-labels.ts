export const knownSystemPackageLabels: Readonly<Record<string, string>> = {
  "01a0132c-4eef-7703-94ac-ec8d1a660001": "匕首之心",
  "01a04186-51be-74e1-b94f-ec17d354dc00": "寻望之心",
  "01a05400-0000-7000-8000-000000000101": "我的车技如何？",
  "01a05400-0000-7000-8000-000000000201": "罗德岛旅记",
  "01a05400-0000-7000-8000-000000000001": "巫趣 Witchy",
};

export function systemPackageLabel(systemPackageId: string): string {
  return knownSystemPackageLabels[systemPackageId] ?? systemPackageId;
}
