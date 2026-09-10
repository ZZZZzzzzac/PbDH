import { strFromU8, unzipSync } from "fflate";

// 旧版中文打包工具未设置 UTF-8 标记；按中央目录标记区分 UTF-8 与 GBK 文件名。
export function readRinkZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50
      && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error("ZIP 目录无效。");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (count > 1000 || view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) {
    throw new Error("ZIP 文件数量过多或使用了不支持的分卷格式。");
  }
  const paths = new Map<string, string>();
  const keys = new Set<string>();
  let expanded = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error("ZIP 目录无效。");
    const flags = view.getUint16(offset + 8, true);
    const length = view.getUint16(offset + 28, true);
    const next = offset + 46 + length + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    if (next > end) throw new Error("ZIP 目录无效。");
    const name = bytes.subarray(offset + 46, offset + 46 + length);
    const utf8 = Boolean(flags & 0x800);
    const sourceName = strFromU8(name, !utf8);
    if (/\.json$/iu.test(sourceName)) {
      if (flags & 1) throw new Error("ZIP JSON 文件已加密。");
      const path = new TextDecoder(utf8 ? "utf-8" : "gb18030", { fatal: true }).decode(name).normalize("NFC");
      if (new TextEncoder().encode(path).length > 1024 || path.includes("\\")
        || path.split("/").some((segment) => !segment || segment === "." || segment === ".."
          || /[\p{Cc}:]/u.test(segment) || /[ .]$/u.test(segment)
          || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(segment))) {
        throw new Error(`ZIP 资源路径不安全：${path}`);
      }
      const key = path.toLowerCase();
      if (keys.has(key)) throw new Error(`ZIP 资源路径重复：${path}`);
      keys.add(key);
      paths.set(sourceName, path);
      expanded += view.getUint32(offset + 24, true);
      if (expanded > 64 * 1024 * 1024) throw new Error("ZIP JSON 解压后超过 64 MiB。");
    }
    offset = next;
  }
  const files = unzipSync(bytes, { filter: (entry) => paths.has(entry.name) });
  return new Map([...paths].map(([name, path]) => [path, files[name]!]));
}
