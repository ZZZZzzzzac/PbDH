import { deepFreeze, executePackageScriptInContext } from "./packageScript";

interface PackageScriptWorkerRequest {
  scriptContent: string;
  scriptLabel: string;
  input: unknown;
}

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<PackageScriptWorkerRequest>) => Promise<void>) | null;
  postMessage(message: unknown): void;
};

workerScope.onmessage = async (event: MessageEvent<PackageScriptWorkerRequest>) => {
  const { scriptContent, scriptLabel, input } = event.data;
  try {
    blockAmbientCapabilities();
    const value = await executePackageScriptInContext(scriptContent, deepFreeze(input), scriptLabel);
    workerScope.postMessage({ ok: true, value });
  } catch (error) {
    workerScope.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};

function blockAmbientCapabilities() {
  for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "BroadcastChannel", "indexedDB", "caches", "importScripts"]) {
    try { Object.defineProperty(workerScope, name, { value: undefined, configurable: false, writable: false }); } catch { /* Capability is absent or already non-configurable. */ }
  }
}
