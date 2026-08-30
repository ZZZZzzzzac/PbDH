export type MarketRoute =
  | { page: "discovery" }
  | { page: "author"; accountId: string }
  | { page: "detail"; publicationId: string; resourceId?: string };

export function readMarketRoute(source: string | URL): MarketRoute {
  const url = new URL(source);
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
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

export function marketRouteUrl(route: MarketRoute, origin: string): URL {
  if (route.page === "discovery") return new URL("/market", origin);
  if (route.page === "author") {
    return new URL(`/market/authors/${encodeURIComponent(route.accountId)}`, origin);
  }
  const publication = encodeURIComponent(route.publicationId);
  const resource = route.resourceId
    ? `/resources/${encodeURIComponent(route.resourceId)}`
    : "";
  return new URL(`/market/publications/${publication}${resource}`, origin);
}
