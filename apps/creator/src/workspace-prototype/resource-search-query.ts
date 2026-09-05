export type ResourceSearchTarget = {
  template: { id: string };
  data: unknown;
};

export type ResourceSearchQuery = {
  text: string;
  filters: ReadonlyMap<string, readonly string[]>;
};

const tagPattern = /\[([^:\[\]]+):([^\[\]]+)\]/gu;

function normalized(value: unknown): string {
  return String(value).trim().toLocaleLowerCase();
}

function comparableValues(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(comparableValues);
  if (typeof value === "object") return Object.values(value).flatMap(comparableValues);
  return [String(value).trim()].filter(Boolean);
}

function dataFields(data: unknown): Array<[string, unknown]> {
  return data && typeof data === "object" && !Array.isArray(data)
    ? Object.entries(data)
    : [];
}

export function parseResourceSearchQuery(source: string): ResourceSearchQuery {
  const filters = new Map<string, string[]>();
  const text = source.replace(tagPattern, (_tag, rawKey: string, rawValue: string) => {
    const key = rawKey.trim();
    const value = rawValue.trim();
    if (!key || !value) return _tag;
    const canonicalKey = [...filters.keys()].find((candidate) => normalized(candidate) === normalized(key)) ?? key;
    const existing = filters.get(canonicalKey) ?? [];
    if (!existing.some((candidate) => normalized(candidate) === normalized(value))) existing.push(value);
    filters.set(canonicalKey, existing);
    return " ";
  }).replace(/\s+/gu, " ").trim();
  return { text, filters };
}

export function matchesResourceSearchQuery(
  target: ResourceSearchTarget,
  searchable: string,
  query: ResourceSearchQuery,
): boolean {
  if (query.text && !normalized(searchable).includes(normalized(query.text))) return false;
  for (const [requestedKey, requestedValues] of query.filters) {
    const field = dataFields(target.data).find(([key]) => normalized(key) === normalized(requestedKey));
    const actualValues = normalized(requestedKey) === "模板"
      ? [normalized(target.template.id)]
      : field
        ? comparableValues(field[1]).map(normalized)
        : [];
    if (!requestedValues.some((value) => actualValues.some((actual) => actual.includes(normalized(value))))) return false;
  }
  return true;
}

export function resourceSearchFieldValues(
  targets: readonly ResourceSearchTarget[],
  inputFields: ReadonlySet<string>,
): ReadonlyMap<string, readonly string[]> {
  const fields = new Map<string, Set<string>>([["模板", new Set(targets.map((target) => String(target.template.id).trim()).filter(Boolean))]]);
  for (const target of targets) {
    for (const [key, value] of dataFields(target.data)) {
      if (!inputFields.has(key)) continue;
      const values = comparableValues(value).map((candidate) => String(candidate).trim()).filter(Boolean);
      if (values.length === 0) continue;
      const field = fields.get(key) ?? new Set<string>();
      for (const candidate of values) field.add(candidate);
      fields.set(key, field);
    }
  }
  return new Map([...fields].map(([key, values]) => [key, [...values].sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true, sensitivity: "base" }))]));
}
