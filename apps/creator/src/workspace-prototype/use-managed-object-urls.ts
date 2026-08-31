import { useCallback, useEffect, useRef, useState } from "react";

export type ObjectUrlFactory = {
  create(blob: Blob): string;
  revoke(url: string): void;
};

const browserObjectUrls: ObjectUrlFactory = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => URL.revokeObjectURL(url),
};

function webpBlob(bytes: Uint8Array): Blob {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: "image/webp" });
}

export class ManagedObjectUrlRegistry {
  readonly #factory: ObjectUrlFactory;
  readonly #urls = new Map<string, string>();

  constructor(factory: ObjectUrlFactory = browserObjectUrls) {
    this.#factory = factory;
  }

  snapshot(): Map<string, string> {
    return new Map(this.#urls);
  }

  addBytes(media: Iterable<readonly [string, Uint8Array]>): boolean {
    let changed = false;
    for (const [assetId, bytes] of media) {
      if (this.#urls.has(assetId)) continue;
      this.#urls.set(assetId, this.#factory.create(webpBlob(bytes)));
      changed = true;
    }
    return changed;
  }

  addBlob(assetId: string, blob: Blob): boolean {
    if (this.#urls.has(assetId)) return false;
    this.#urls.set(assetId, this.#factory.create(blob));
    return true;
  }

  retain(assetIds: Iterable<string>): boolean {
    const retained = new Set(assetIds);
    let changed = false;
    for (const [assetId, url] of this.#urls) {
      if (retained.has(assetId)) continue;
      this.#factory.revoke(url);
      this.#urls.delete(assetId);
      changed = true;
    }
    return changed;
  }

  dispose(): void {
    for (const url of this.#urls.values()) this.#factory.revoke(url);
    this.#urls.clear();
  }
}

export function useManagedObjectUrls() {
  const registryRef = useRef<ManagedObjectUrlRegistry | null>(null);
  registryRef.current ??= new ManagedObjectUrlRegistry();
  const registry = registryRef.current;
  const [urls, setUrls] = useState<Map<string, string>>(() => registry.snapshot());

  const addBytes = useCallback((media: Iterable<readonly [string, Uint8Array]>) => {
    if (registry.addBytes(media)) setUrls(registry.snapshot());
  }, [registry]);

  const addBlob = useCallback((assetId: string, blob: Blob) => {
    if (registry.addBlob(assetId, blob)) setUrls(registry.snapshot());
  }, [registry]);

  const retain = useCallback((assetIds: Iterable<string>) => {
    if (registry.retain(assetIds)) setUrls(registry.snapshot());
  }, [registry]);

  useEffect(() => () => registry.dispose(), [registry]);

  return { urls, addBytes, addBlob, retain };
}


export function useManagedBlobUrl(url: string): void {
  useEffect(() => () => {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  }, [url]);
}
