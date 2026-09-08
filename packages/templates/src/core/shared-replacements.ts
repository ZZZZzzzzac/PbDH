import { deepFreeze, type TemplateCoreCapability } from "./types.ts";

export const sharedTabletopReplacements = deepFreeze([
  { id: "alternate-form", label: "切换形态" },
]);

export function withSharedReplacement<T extends Record<string, unknown>>(
  previous: TemplateCoreCapability<T>,
  version: string,
  schema: TemplateCoreCapability<T>["schema"],
): TemplateCoreCapability<T> {
  return deepFreeze({
    ...previous,
    version,
    schema,
    upgrades: [{ fromVersion: previous.version, upgradeData: (data) => structuredClone(data) }],
    tabletop: { ...previous.tabletop, replacements: sharedTabletopReplacements },
  });
}
