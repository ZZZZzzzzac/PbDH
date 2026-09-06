export type MarketRoute =
  | { page: "discovery" }
  | { page: "author"; accountId: string }
  | { page: "detail"; publicationId: string; resourceId?: string };

function normalizeBasePath(basePath: string): string {
  const normalized = `/${basePath.split("/").filter(Boolean).join("/")}/`;
  return normalized === "//" ? "/" : normalized;
}

function routePathname(pathname: string, basePath: string): string {
  const normalizedBase = normalizeBasePath(basePath);
  const baseWithoutTrailingSlash = normalizedBase.slice(0, -1);
  if (pathname === baseWithoutTrailingSlash) return "/";
  if (pathname.startsWith(normalizedBase)) {
    return `/${pathname.slice(normalizedBase.length)}`;
  }
  return pathname;
}

export function readMarketRoute(source: string | URL, basePath = "/"): MarketRoute {
  const url = new URL(source);
  const segments = routePathname(url.pathname, basePath)
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  if (segments[0] === "market" && segments[1] === "authors" && segments[2]) {
    return { page: "author", accountId: segments[2] };
  }
  if (segments[0] !== "market" || segments[1] !== "publications" || !segments[2]) {
    return { page: "discovery" };
  }
  if (segments[3] === "resources" && segments[4]) {
    return { page: "detail", publicationId: segments[2], resourceId: segments[4] };
  }
  return { page: "detail", publicationId: segments[2] };
}

export function marketRouteUrl(
  route: MarketRoute,
  origin: string,
  basePath = "/",
): URL {
  const marketBase = `${normalizeBasePath(basePath)}market`;
  if (route.page === "discovery") return new URL(marketBase, origin);
  if (route.page === "author") {
    return new URL(`${marketBase}/authors/${encodeURIComponent(route.accountId)}`, origin);
  }
  const publication = encodeURIComponent(route.publicationId);
  const resource = route.resourceId
    ? `/resources/${encodeURIComponent(route.resourceId)}`
    : "";
  return new URL(`${marketBase}/publications/${publication}${resource}`, origin);
}
