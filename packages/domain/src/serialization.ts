/** JSONB preserves values and array order, but does not preserve object-key order. */
export function canonicalJson(value: unknown): string {
  const ordered = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(ordered);
    if (item !== null && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, nested]) => [key, ordered(nested)]),
      );
    return item;
  };
  return JSON.stringify(ordered(value));
}
