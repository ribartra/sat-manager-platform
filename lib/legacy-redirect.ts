/** Rebuilds a query string from Next searchParams (legacy URL → new URL redirects keep their filters). */
export function withQuery(path: string, query: Record<string, string | string[] | undefined>, overrides: Record<string, string | null> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  if (params.get("area") === "mocks") params.set("area", "tests");
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
