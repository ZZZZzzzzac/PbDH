import { dhsheetCharacterAdapter } from "./dhsheet-adapter.ts";
import { pbchaCharacterAdapter } from "./pbcha-adapter.ts";
import type {
  CharacterExportResult,
  CharacterFormatAdapter,
  CharacterFormatId,
  CharacterImportResult,
  CharacterInput,
  TemporaryCharacter,
} from "./types.ts";
import { zzzCharacterAdapter } from "./zzz-adapter.ts";

export { dhsheetCharacterAdapter } from "./dhsheet-adapter.ts";
export { pbchaCharacterAdapter, temporaryPbchaProfileVersion } from "./pbcha-adapter.ts";
export type * from "./types.ts";
export { zzzCharacterAdapter } from "./zzz-adapter.ts";

export class CharacterConversionRegistry {
  readonly #adapters = new Map<CharacterFormatId, CharacterFormatAdapter>();

  constructor(adapters: readonly CharacterFormatAdapter[]) {
    for (const adapter of adapters) {
      if (this.#adapters.has(adapter.id)) throw new Error(`Duplicate character adapter: ${adapter.id}`);
      this.#adapters.set(adapter.id, adapter);
    }
  }

  import(formatId: CharacterFormatId, input: CharacterInput): CharacterImportResult {
    const adapter = this.#adapters.get(formatId);
    if (!adapter) throw new Error(`Unknown character format: ${formatId}`);
    return adapter.import(input);
  }

  export(formatId: CharacterFormatId, character: TemporaryCharacter): CharacterExportResult {
    const adapter = this.#adapters.get(formatId);
    if (!adapter) throw new Error(`Unknown character format: ${formatId}`);
    return adapter.export(character);
  }
}

export const characterConversionRegistry = new CharacterConversionRegistry([
  pbchaCharacterAdapter,
  dhsheetCharacterAdapter,
  zzzCharacterAdapter,
]);
