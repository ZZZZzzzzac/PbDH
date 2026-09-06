import type { PlatformPage } from "@pbdh/platform-ui";

export type PlatformLocation = {
  page: PlatformPage;
  href: string;
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
  const segment = applicationPath.split("/").filter(Boolean)[0];
  const page = platformPages.has(segment as PlatformPage)
    ? segment as PlatformPage
    : "creator";
  return { page, href: url.href };
}

export function platformPageUrl(
  page: PlatformPage,
  origin: string,
  basePath = "/",
): URL {
  return new URL(`${normalizeBasePath(basePath)}${page}`, origin);
}
