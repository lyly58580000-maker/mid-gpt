export function parseUserTags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((item) => String(item).trim()).filter(Boolean))].slice(0, 10);
  } catch {
    return [];
  }
}

export function serializeUserTags(tags: string[]): string | null {
  const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 10);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}
