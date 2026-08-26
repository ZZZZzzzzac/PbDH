import type {
  ExportOptions,
  ExportResult,
  ImportResult,
  ResourceFormatAdapter,
  ResourceFormatId,
  ResourceInput,
  TemporaryResourceBatch,
} from "./types.ts";

export class ResourceConversionRegistry {
  readonly #adapters = new Map<ResourceFormatId, ResourceFormatAdapter>();

  constructor(adapters: readonly ResourceFormatAdapter[]) {
    for (const adapter of adapters) {
      if (this.#adapters.has(adapter.id)) throw new Error(`Duplicate resource adapter: ${adapter.id}`);
      this.#adapters.set(adapter.id, adapter);
    }
  }

  list(): readonly ResourceFormatAdapter[] {
    return [...this.#adapters.values()];
  }

  import(formatId: ResourceFormatId, input: ResourceInput): Promise<ImportResult> {
    const adapter = this.#adapters.get(formatId);
    if (!adapter) throw new Error(`Unknown resource format: ${formatId}`);
    return Promise.resolve(adapter.import(input));
  }

  export(formatId: ResourceFormatId, batch: TemporaryResourceBatch, options?: ExportOptions): Promise<ExportResult> {
    const adapter = this.#adapters.get(formatId);
    if (!adapter) throw new Error(`Unknown resource format: ${formatId}`);
    return Promise.resolve(adapter.export(batch, options));
  }
}
