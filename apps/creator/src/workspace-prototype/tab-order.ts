export type TabDropPlacement = "before" | "after";

export const creatorResourceTabOrderKey = "pbdh.creator.tabs.resources";
export const creatorActiveResourceTabKey = "pbdh.creator.tabs.active-resource";
export const gmTabletopTabOrderKey = "pbdh.creator.tabs.tabletops";
export const gmActiveTabletopTabKey = "pbdh.creator.tabs.active-tabletop";
export const tabDragThreshold = 8;

export function shouldActivateTabDrag(startX: number, currentX: number): boolean {
  return Math.abs(currentX - startX) > tabDragThreshold;
}

export function resourceTabKey(workspaceKey: string, resourceId: string): string {
  return JSON.stringify([workspaceKey, resourceId]);
}

export function readStoredTabOrder(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const candidate: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(candidate)
      ? [...new Set(candidate.filter((item): item is string => typeof item === "string" && item.length > 0))]
      : [];
  } catch {
    return [];
  }
}

export function writeStoredTabOrder(key: string, order: readonly string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(order));
}

export function readStoredActiveTab(key: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key)?.trim() ?? "";
}

export function writeStoredActiveTab(key: string, tabKey: string): void {
  if (typeof window === "undefined" || !tabKey) return;
  window.localStorage.setItem(key, tabKey);
}

export function resolveStoredActiveTab(
  storedKey: string,
  availableKeys: readonly string[],
  fallbackKey = availableKeys[0] ?? "",
): string {
  if (storedKey && availableKeys.includes(storedKey)) return storedKey;
  return availableKeys.includes(fallbackKey) ? fallbackKey : availableKeys[0] ?? "";
}

export function reconcileTabOrder(order: readonly string[], availableKeys: readonly string[]): string[] {
  const available = new Set(availableKeys);
  const retained = order.filter((key) => available.has(key));
  const retainedSet = new Set(retained);
  return [...retained, ...availableKeys.filter((key) => !retainedSet.has(key))];
}

export function moveTab(
  order: readonly string[],
  sourceKey: string,
  targetKey: string,
  placement: TabDropPlacement,
): string[] {
  if (sourceKey === targetKey || !order.includes(sourceKey) || !order.includes(targetKey)) return [...order];
  const next = order.filter((key) => key !== sourceKey);
  const targetIndex = next.indexOf(targetKey);
  next.splice(targetIndex + (placement === "after" ? 1 : 0), 0, sourceKey);
  return next;
}

export function orderTabsByKey<T>(
  items: readonly T[],
  order: readonly string[],
  keyOf: (item: T) => string,
): T[] {
  const rank = new Map(reconcileTabOrder(order, items.map(keyOf)).map((key, index) => [key, index]));
  return [...items].sort((left, right) => (rank.get(keyOf(left)) ?? 0) - (rank.get(keyOf(right)) ?? 0));
}

export function sameTabOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}
