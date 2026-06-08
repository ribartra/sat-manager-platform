export function logApiEvent(event: string, metadata: Record<string, unknown> = {}) {
  console.info(JSON.stringify({
    level: "info",
    event,
    at: new Date().toISOString(),
    ...metadata,
  }));
}
