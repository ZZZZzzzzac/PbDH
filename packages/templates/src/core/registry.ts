import type { TemplateCoreCapability } from "./types.ts";

type AnyTemplate = TemplateCoreCapability<any>;

export class TemplateRegistry {
  readonly #templates = new Map<string, AnyTemplate>();

  constructor(templates: readonly AnyTemplate[]) {
    for (const template of templates) {
      const key = `${template.id}@${template.version}`;
      if (this.#templates.has(key)) throw new Error(`Duplicate Template version: ${key}`);
      this.#templates.set(key, template);
    }
  }

  resolve(id: string, version: string): AnyTemplate | undefined {
    return this.#templates.get(`${id}@${version}`);
  }

  list(): readonly AnyTemplate[] {
    return [...this.#templates.values()];
  }
}
