import type { CharacterData } from "../../domain/characterData";
import type { CharacterSaveSummary } from "../../storage/runtimeStorage";
import type { RuntimeEnvironment } from "../runtimeEnvironment";
import type { StorageStatus } from "../runtimeTypes";

export const autosaveDelayMs = 250;

export function scheduleAutosave(
  environment: RuntimeEnvironment,
  readSnapshot: () => CharacterData | null,
  setStatus: (status: StorageStatus) => void,
): void {
  if (environment.autosaveTimer) clearTimeout(environment.autosaveTimer);

  setStatus("saving");
  environment.autosaveTimer = setTimeout(() => {
    environment.autosaveTimer = undefined;
    const snapshot = readSnapshot();
    if (!snapshot) {
      setStatus("error");
      return;
    }

    void environment.dependencies.storage
      .saveCurrentCharacterData(snapshot)
      .then(() => setStatus("saved"))
      .catch(() => setStatus("error"));
  }, autosaveDelayMs);
}

export async function flushPendingAutosave(
  environment: RuntimeEnvironment,
  snapshot: CharacterData | null,
  activeSaveId: string | null,
  characterSaves: CharacterSaveSummary[],
): Promise<void> {
  if (!environment.autosaveTimer) return;

  clearTimeout(environment.autosaveTimer);
  environment.autosaveTimer = undefined;
  if (!snapshot || !activeSaveId) return;

  const saveName = characterSaves.find((save) => save.id === activeSaveId)?.name ?? "未命名角色";
  await environment.dependencies.storage.saveCharacterSave({
    id: activeSaveId,
    packageId: snapshot.systemPackage.id,
    name: saveName,
    updatedAt: snapshot.updatedAt,
    data: { ...snapshot, character: { ...snapshot.character, id: activeSaveId } },
  });
}

export function saveCharacterDataImmediately(
  environment: RuntimeEnvironment,
  snapshot: CharacterData,
  activeSaveId: string | null,
  characterSaves: CharacterSaveSummary[],
  setStatus: (status: StorageStatus) => void,
): void {
  if (environment.autosaveTimer) {
    clearTimeout(environment.autosaveTimer);
    environment.autosaveTimer = undefined;
  }

  const saveId = activeSaveId ?? snapshot.character.id;
  const saveName = characterSaves.find((save) => save.id === saveId)?.name ?? "未命名角色";
  setStatus("saving");
  void environment.dependencies.storage.saveCharacterSave({
    id: saveId,
    packageId: snapshot.systemPackage.id,
    name: saveName,
    updatedAt: snapshot.updatedAt,
    data: { ...snapshot, character: { ...snapshot.character, id: saveId } },
  })
    .then(() => setStatus("saved"))
    .catch(() => setStatus("error"));
}
