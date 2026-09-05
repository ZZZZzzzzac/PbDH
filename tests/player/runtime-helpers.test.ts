import { describe, expect, it } from "vitest";

import type { CharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { ensureCardState } from "../../apps/player/src/sheet-runtime/store/runtimeHelpers.ts";

describe("Player Runtime 状态规范化", () => {
  it("清除旧装备模板遗留的孤立冒号，同时保留有效文本", () => {
    const data = {
      character: {
        values: {
          "primary-weapon-description": "：",
          "armor-description": " : ",
          "secondary-weapon-description": "招架：受到攻击时触发。",
        },
      },
      cards: { instances: [] },
    } as unknown as CharacterData;

    expect(ensureCardState(data)?.character.values).toMatchObject({
      "primary-weapon-description": "",
      "armor-description": "",
      "secondary-weapon-description": "招架：受到攻击时触发。",
    });
  });
});
