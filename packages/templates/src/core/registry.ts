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

  upgradeTargets(id: string, fromVersion: string): readonly string[] {
    let version = fromVersion;
    const targets: string[] = [];
    const visited = new Set<string>();
    while (true) {
      if (visited.has(version)) throw new Error(`Template upgrade cycle: ${id}@${version}`);
      visited.add(version);
      const candidates = [...this.#templates.values()].flatMap((template) => template.id === id
        ? (template.upgrades ?? []).filter((upgrade) => upgrade.fromVersion === version).map(() => template)
        : []);
      if (candidates.length === 0) return targets;
      if (candidates.length !== 1) throw new Error(`Ambiguous Template upgrade: ${id}@${version}`);
      version = candidates[0]!.version;
      targets.push(version);
    }
  }

  upgradeData(id: string, fromVersion: string, toVersion: string, data: Record<string, unknown>): Record<string, unknown> {
    let version = fromVersion;
    let upgraded = structuredClone(data);
    const visited = new Set<string>();
    while (version !== toVersion) {
      if (visited.has(version)) throw new Error(`Template upgrade cycle: ${id}@${version}`);
      visited.add(version);
      const candidates = [...this.#templates.values()].flatMap((template) => template.id === id
        ? (template.upgrades ?? [])
            .filter((upgrade) => upgrade.fromVersion === version)
            .map((upgrade) => ({ template, upgrade }))
        : []);
      if (candidates.length !== 1) throw new Error(`Missing unambiguous Template upgrade: ${id}@${version} -> ${toVersion}`);
      const next = candidates[0]!;
      upgraded = next.upgrade.upgradeData(upgraded);
      version = next.template.version;
    }
    return upgraded;
  }
}
