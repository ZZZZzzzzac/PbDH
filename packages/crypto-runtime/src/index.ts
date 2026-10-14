import { sha256 } from "@noble/hashes/sha2.js";

// HTTPS iframe 被 HTTP 页面嵌入时 subtle/randomUUID 不可用，getRandomValues 仍可用。
// 保持原有摘要字节与 UUID v4 格式，不安装全局 polyfill，也不伪造安全上下文。
export async function digestSha256(data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer> {
  const bytes = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice()
    : new Uint8Array(data).slice();
  if (globalThis.crypto?.subtle) return globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Uint8Array.from(sha256(bytes)).buffer;
}

export function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
