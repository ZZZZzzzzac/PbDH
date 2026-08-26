export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function clampInt(value: number, min: number, max: number | null): number {
  if (value < min) {
    return min;
  }
  if (max !== null && value > max) {
    return max;
  }
  return value;
}

export function generateId(prefix: string): string {
  if (typeof crypto.randomUUID === "function") {
    return `${prefix}${crypto.randomUUID()}`;
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  const uuid = `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  return `${prefix}${uuid}`;
}

// 从部署路径中解析出第一段作为预制系统包 id，例如 base "/pbdh/" 下
// "/pbdh/tttri" -> "tttri；"/pbdh/" 或无匹配前缀时返回 null。
export function presetIdFromPathname(baseUrl: string, pathname: string): string | null {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const prefix = base.startsWith("/") ? base : `/${base}`;
  const rest = prefix === "/" ? pathname.replace(/^\/+/, "") : pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
  const segment = rest.split("/")[0];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// 构造某个预制系统包对应的部署路径；presetId 为 null 时返回 base 本身。
export function presetPathname(baseUrl: string, presetId: string | null): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const prefix = base.startsWith("/") ? base : `/${base}`;
  return presetId ? `${prefix}${encodeURIComponent(presetId)}` : prefix;
}

export function inferMimeType(path: string): string {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith(".png")) {
    return "image/png";
  }
  if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lowerPath.endsWith(".webp")) {
    return "image/webp";
  }
  if (lowerPath.endsWith(".gif")) {
    return "image/gif";
  }
  if (lowerPath.endsWith(".avif")) {
    return "image/avif";
  }
  if (lowerPath.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (lowerPath.endsWith(".json")) {
    return "application/json";
  }
  if (lowerPath.endsWith(".txt")) {
    return "text/plain";
  }
  return "application/octet-stream";
}
