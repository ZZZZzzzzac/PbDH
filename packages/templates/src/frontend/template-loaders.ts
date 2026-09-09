import { manifestEntryFor } from "./template-frontend-manifest.ts";
import type { TrustedTemplateRenderer } from "./template-frontend-registry.ts";
import type { TemplateAuthoringCapability } from "./types.ts";
import { loadTemplateCore } from "../core/lazy.ts";
import type { TemplateCoreCapability } from "../core/types.ts";

export type TemplateLoadSnapshot<T> =
  | { status: "idle" | "loading" }
  | { status: "ready"; value: T | undefined }
  | { status: "error"; error: unknown };

function createVersionLoader<T>(resolve: (id: string, version: string) => (() => Promise<T | undefined>) | undefined) {
  const idle: TemplateLoadSnapshot<T> = { status: "idle" };
  const records = new Map<string, { snapshot: TemplateLoadSnapshot<T>; promise?: Promise<T | undefined> }>();
  const listeners = new Map<string, Set<() => void>>();
  const key = (id: string, version: string) => `${id}@${version}`;
  const notify = (key: string) => listeners.get(key)?.forEach((listener) => listener());
  return {
    read(id: string, version: string) { return records.get(key(id, version))?.snapshot ?? idle; },
    subscribe(id: string, version: string, listener: () => void) {
      const entryKey = key(id, version);
      const callbacks = listeners.get(entryKey) ?? new Set();
      callbacks.add(listener);
      listeners.set(entryKey, callbacks);
      return () => {
        callbacks.delete(listener);
        if (!callbacks.size) listeners.delete(entryKey);
      };
    },
    load(id: string, version: string): Promise<T | undefined> {
      const entryKey = key(id, version);
      const previous = records.get(entryKey);
      if (previous?.promise) return previous.promise;
      const record: { snapshot: TemplateLoadSnapshot<T>; promise?: Promise<T | undefined> } = { snapshot: { status: "loading" } };
      records.set(entryKey, record);
      record.promise = Promise.resolve().then(() => resolve(id, version)?.()).then((value) => {
        record.snapshot = { status: "ready", value };
        notify(entryKey);
        return value;
      }, (error) => {
        record.promise = undefined;
        record.snapshot = { status: "error", error };
        notify(entryKey);
        throw error;
      });
      notify(entryKey);
      return record.promise;
    },
  };
}

export const coreLoader = createVersionLoader<TemplateCoreCapability<any>>((id, version) => () => loadTemplateCore(id, version));
export const rendererLoader = createVersionLoader<TrustedTemplateRenderer>((id, version) => {
  const entry = manifestEntryFor(id, version);
  if (!entry) return undefined;
  return async () => {
    const [renderer] = await Promise.all([entry.loadRenderer(), coreLoader.load(id, version)]);
    return renderer;
  };
});
export const authoringLoader = createVersionLoader<TemplateAuthoringCapability>((id, version) => manifestEntryFor(id, version)?.loadAuthoring);
export const loadTrustedRenderer = rendererLoader.load;
export const loadTrustedAuthoring = authoringLoader.load;
