export function filterCoreBookLibraries<T extends { entries: Array<{ ID: string }> }>(
  libraries: T[],
  coreResources: ReadonlyArray<{ id: string }>,
): T[] {
  const allowed = new Set(coreResources.map(({ id }) => id));
  if (allowed.size === 0 || allowed.size !== coreResources.length) {
    throw new Error("Core book resource IDs must be nonempty and unique.");
  }
  const found = new Set<string>();
  const selected = libraries.map((library) => ({
    ...library,
    entries: library.entries.filter(({ ID }) => {
      if (!allowed.has(ID)) return false;
      if (found.has(ID)) throw new Error(`Duplicate core book resource ID in source: ${ID}`);
      found.add(ID);
      return true;
    }),
  }));
  const missing = [...allowed].filter((id) => !found.has(id));
  if (missing.length) throw new Error(`Missing core book resource IDs in source: ${missing.join(", ")}`);
  return selected;
}
