export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeQuery(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
