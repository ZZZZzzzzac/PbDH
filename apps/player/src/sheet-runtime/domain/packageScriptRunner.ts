import { cloneAndFreeze, executePackageScriptInContext } from "./packageScript";

export const packageScriptTimeoutMs = 3000;

export function executePackageScriptInWorker(
  scriptContent: string,
  input: unknown,
  scriptLabel: string,
  timeoutMs = packageScriptTimeoutMs,
): Promise<unknown> {
  // Vitest's jsdom environment has no Worker implementation. Production
  // builds never take this branch; it only keeps script contracts unit-testable.
  if (typeof Worker === "undefined" && import.meta.env.MODE === "test") {
    return executePackageScriptInContext(scriptContent, cloneAndFreeze(input), scriptLabel);
  }
  if (typeof Worker === "undefined") throw new Error(`Web Worker 不可用，${scriptLabel} 必须在隔离 Worker 中执行。`);
  const worker = new Worker(new URL("./packageScriptWorker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error(`${scriptLabel} timed out.`));
    }, timeoutMs);
    worker.onmessage = (event: MessageEvent<{ ok: true; value: unknown } | { ok: false; error: string }>) => {
      clearTimeout(timeout);
      worker.terminate();
      if (event.data.ok) resolve(event.data.value);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event: ErrorEvent) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage({ scriptContent, scriptLabel, input });
  });
}
