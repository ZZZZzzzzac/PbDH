import { describe, expect, it } from "vitest";

import {
  loadPagePreference,
  savePagePreference,
} from "../../apps/player/src/sheet-runtime/rendering/pagePresentation.ts";

describe("Player page preference", () => {
  it("按系统包和人物分别恢复上次页面，不写入没有人物的状态", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    savePagePreference(storage, "system-a", "character-a", "story");
    savePagePreference(storage, "system-a", "character-b", "cards");
    savePagePreference(storage, "system-b", "character-a", "main");
    savePagePreference(storage, "system-a", null, "ignored");

    expect(loadPagePreference(storage, "system-a", "character-a")).toBe("story");
    expect(loadPagePreference(storage, "system-a", "character-b")).toBe("cards");
    expect(loadPagePreference(storage, "system-b", "character-a")).toBe("main");
    expect(loadPagePreference(storage, "system-a", null)).toBeNull();
    expect(values.size).toBe(3);
  });
});
