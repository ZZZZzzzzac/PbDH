import { digestSha256, randomUUID } from "@pbdh/crypto-runtime";

export function buildPackageScriptBody(scriptContent: string, scriptLabel: string): string {
  return [
    '"use strict";',
    scriptContent,
    "const packageScript = module.exports && (module.exports.default || module.exports.run || module.exports);",
    'if (typeof packageScript !== "function") {',
    `  throw new Error(${JSON.stringify(`${scriptLabel} must assign a function to module.exports.`)});`,
    "}",
    "return packageScript(input);",
  ].join("\n");
}

export function executePackageScriptInContext(scriptContent: string, input: unknown, scriptLabel: string): Promise<unknown> {
  const module = { exports: {} as unknown };
  const exports = module.exports;
  const runner = new Function("module", "exports", "input", "crypto", buildPackageScriptBody(scriptContent, scriptLabel));
  // 只给系统包脚本注入其使用的摘要能力；不修改 Worker 全局或已发布脚本制品。
  const scriptCrypto = globalThis.crypto.subtle ? globalThis.crypto : {
    getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    randomUUID,
    subtle: { digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => {
      const name = typeof algorithm === "string" ? algorithm : algorithm.name;
      if (name.toUpperCase() !== "SHA-256") return Promise.reject(new DOMException("仅支持 SHA-256 摘要", "NotSupportedError"));
      return digestSha256(data);
    } },
  };
  return Promise.resolve(runner(module, exports, input, scriptCrypto));
}

export function cloneAndFreeze<T>(value: T): T {
  return deepFreeze(cloneData(value));
}

export function cloneData<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function deepFreeze<T>(value: T): T {
  // structuredClone has already detached binary input from application state,
  // and JavaScript cannot freeze non-empty typed arrays.
  if (ArrayBuffer.isView(value)) return value;
  if (!isRecord(value) && !Array.isArray(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if ((isRecord(child) || Array.isArray(child)) && !Object.isFrozen(child)) deepFreeze(child);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
