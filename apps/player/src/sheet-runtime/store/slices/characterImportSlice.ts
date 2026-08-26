import type { RuntimeEnvironment } from "../runtimeEnvironment";
import type { CharacterImportSlice, RuntimeSlice } from "../runtimeTypes";
import { importCharacterSource, persistImportedCharacter } from "../workflows/characterImport";

export function createCharacterImportSlice(
  environment: RuntimeEnvironment,
): RuntimeSlice<CharacterImportSlice> {
  return (set, get) => ({
    pendingCharacterConversion: null,
    pendingCharacterFormatSelection: null,

    async importCharacterDataFromText(text) {
      await importCharacterSource(environment, text, "character.json", undefined, set, get);
    },

    async importCharacterDataFromFile(file) {
      try {
        await importCharacterSource(environment, await file.text(), file.name, undefined, set, get);
      } catch {
        set({ importError: "导入失败：无法读取人物卡文件。", importNotice: null });
      }
    },

    async selectCharacterFormatAdapter(adapterId) {
      const pending = get().pendingCharacterFormatSelection;
      if (!pending) return;
      await importCharacterSource(environment, pending.text, pending.fileName, adapterId, set, get);
    },

    async confirmCharacterConversion() {
      const pending = get().pendingCharacterConversion;
      if (!pending) return;
      await persistImportedCharacter(
        environment,
        pending.data,
        pending.suggestedSaveName ?? "导入角色",
        pending.successNotice,
        set,
        get,
      );
    },

    cancelCharacterConversion() {
      set({
        pendingCharacterConversion: null,
        pendingCharacterFormatSelection: null,
        importNotice: "已取消人物卡转换；当前 Character Save 未改变。",
      });
    },
  });
}
