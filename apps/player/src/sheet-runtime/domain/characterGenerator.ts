import type { CharacterData } from "./characterData";
import type { SystemPackage } from "./systemPackage";

// 可信预置系统按需注入生成器；通用存档流程不解释具体游戏规则。
export interface GeneratedCharacter {
  name: string;
  data: CharacterData;
}

export type CharacterGenerator = (systemPackage: SystemPackage) => GeneratedCharacter | Promise<GeneratedCharacter>;
