import type { CharacterData } from "../sheet-runtime/domain/characterData.ts";
import type { SystemPackage } from "../sheet-runtime/domain/systemPackage.ts";
import { readCountableState } from "../sheet-runtime/rendering/moduleState.ts";
import { emptyResources, resourceFields, goldFields, readDefenses, type Resources, type ResourceId, type PlayerSnapshot } from "./adapter.ts";
import { readPlayerRollData } from "./roll.ts";
export function readPlayerSnapshot(data: CharacterData | null, pkg: SystemPackage | null): PlayerSnapshot | null {
  if (!data || !pkg) return null;
  const rawName = data.character.values["character-name"];
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : "未命名角色";
  const resources = emptyResources();
  for (const id of Object.keys(resources) as ResourceId[]) {
    const module = pkg.modules.find(m => m.ID === id);
    if (module?.类型 !== "countableResource") continue;
    const value = readCountableState(data.character.values[id], { current: module.默认值 ?? 0, max: module.最大值 ?? null });
    const cap = Object.hasOwn(resourceFields, id) ? 60 : 1_000_000;
    if (Number.isSafeInteger(value.current) && value.current >= 0 && value.current <= cap
        && (value.max === null || Number.isSafeInteger(value.max) && value.max >= value.current && value.max <= cap)) resources[id] = { ...value };
  }
  for (const id of Object.keys(goldFields) as Array<keyof typeof goldFields>) if (resources[id]) resources[id]!.max = goldFields[id].max;
  return { key: JSON.stringify([pkg.manifest.ID, data.character.id]), documentId: data.character.id, name, resources, defenses: readDefenses(data.character.values), rolls: readPlayerRollData(data.character.values) };
}
