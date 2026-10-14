import { createHash } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import { digestSha256, randomUUID } from "@pbdh/crypto-runtime";
import { executePackageScriptInContext } from "../../apps/player/src/sheet-runtime/domain/packageScript.ts";

const native = globalThis.crypto;
const hex = (buffer: ArrayBuffer) => Buffer.from(buffer).toString("hex");
afterEach(() => vi.unstubAllGlobals());

test("HTTP 摘要与原生 SHA-256 一致，包括子视图、多块数据与调用后输入变化", async () => {
  vi.stubGlobal("crypto", { getRandomValues: native.getRandomValues.bind(native) });
  for (const bytes of [new Uint8Array(), new TextEncoder().encode("abc"), new TextEncoder().encode("匕首之心".repeat(1000)), new Uint8Array([9, 1, 2, 3, 9]).subarray(1, 4)]) {
    const expected = createHash("sha256").update(bytes).digest("hex");
    const actual = digestSha256(bytes);
    bytes.fill(0);
    expect(hex(await actual)).toBe(expected);
  }
  expect(globalThis.crypto.subtle).toBeUndefined();
});

test("UUID 回退使用安全随机源并保留 v4 位，不修改原生 API", () => {
  const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(255));
  vi.stubGlobal("crypto", { getRandomValues });
  expect(randomUUID()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  expect(getRandomValues).toHaveBeenCalledOnce();
  expect(globalThis.crypto.randomUUID).toBeUndefined();
});

test("有原生 WebCrypto 时优先使用，原生失败不悄悄回退", async () => {
  const digest = vi.fn().mockRejectedValue(new Error("native failure"));
  const uuid = vi.fn(() => "12345678-1234-4123-8123-123456789abc");
  vi.stubGlobal("crypto", { subtle: { digest }, randomUUID: uuid });
  await expect(digestSha256(new Uint8Array())).rejects.toThrow("native failure");
  expect(randomUUID()).toBe("12345678-1234-4123-8123-123456789abc");
  expect(uuid).toHaveBeenCalledOnce();
});

test("已发布系统包脚本在 HTTP Worker 中仍可计算 SHA-256", async () => {
  vi.stubGlobal("crypto", { getRandomValues: native.getRandomValues.bind(native) });
  const result = await executePackageScriptInContext('module.exports = async () => crypto.subtle.digest("SHA-256", new TextEncoder().encode("abc"));', {}, "test");
  expect(hex(result as ArrayBuffer)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  await expect(executePackageScriptInContext('module.exports = () => crypto.subtle.digest("SHA-1", new Uint8Array());', {}, "test"))
    .rejects.toMatchObject({ name: "NotSupportedError" });
  expect(globalThis.crypto.subtle).toBeUndefined();
});
