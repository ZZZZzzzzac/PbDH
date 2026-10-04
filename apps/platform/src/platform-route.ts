import type { PlatformPage } from "@pbdh/platform-ui";

export type PlatformLocation = {
  page: PlatformPage;
  href: string;
  playerSystemPackage?: string;
};

const platformPages = new Set<PlatformPage>(["player", "creator", "gm", "market"]);

export function normalizeBasePath(basePath: string): string {
  const normalized = `/${basePath.split("/").filter(Boolean).join("/")}/`;
  return normalized === "//" ? "/" : normalized;
}

export function readPlatformLocation(
  source: string | URL,
  basePath = "/",
): PlatformLocation {
  const url = new URL(source);
  const normalizedBase = normalizeBasePath(basePath);
  const baseWithoutTrailingSlash = normalizedBase.slice(0, -1);
  const applicationPath = url.pathname === baseWithoutTrailingSlash
    ? "/"
    : url.pathname.startsWith(normalizedBase)
      ? `/${url.pathname.slice(normalizedBase.length)}`
      : url.pathname;
  const segments = applicationPath.split("/").filter(Boolean);
  const segment = segments[0];
  // 无路径段的入口不指定系统包：由 Player 按「上次使用的系统包 → 默认包」决定，
  // 否则每次从根路径进入都会先加载一遍匕首之心。
  if (segments.length === 0) return { page: "player", href: url.href };
  const page = platformPages.has(segment as PlatformPage)
    ? segment as PlatformPage
    : "creator";
  return { page, href: url.href,
    ...(page === "player" && segments.length === 2 ? { playerSystemPackage: segments[1] } : {}),
  };
}

export function platformPageUrl(
  page: PlatformPage,
  origin: string,
  basePath = "/",
): URL {
  return new URL(`${normalizeBasePath(basePath)}${page}`, origin);
}

// Player 页指向某个系统包的直达地址。段名用预置的 directory，与 Player 解析直达链接的
// 匹配方式一致（它按 preset.directory 找包），这样写回去的地址刷新后仍解析到同一个包。
export function playerSystemPackageUrl(
  directory: string,
  origin: string,
  basePath = "/",
): URL {
  return new URL(`${normalizeBasePath(basePath)}player/${encodeURIComponent(directory)}`, origin);
}

// iframe 的接入设置属于当前入口，页面导航不应把它变成普通 Player。
// 只带这三个参数，资源市场的一次性交接数据仍按原流程消费。
export function preserveSealChatEntry(target: URL, entryHref: string): URL {
  const next = new URL(target.href), entry = new URL(entryHref);
  if (next.origin !== entry.origin || entry.searchParams.get("sealchat") !== "1") return next;
  for (const key of ["sealchat", "hostOrigin", "sdkUrl"]) {
    const value = entry.searchParams.get(key);
    if (value === null) next.searchParams.delete(key);
    else next.searchParams.set(key, value);
  }
  return next;
}
