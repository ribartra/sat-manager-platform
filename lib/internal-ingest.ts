const ingestServiceUrl = process.env.AI_INGEST_SERVICE_URL ?? "http://localhost:8000";

function internalIngestToken() {
  const token = process.env.INTERNAL_INGEST_TOKEN;
  if (process.env.NODE_ENV === "production" && !token) {
    throw new Error("INTERNAL_INGEST_TOKEN is required in production.");
  }
  return token ?? "sat-platform-dev-internal-token-change";
}

export function ingestUrl(path: string) {
  return `${ingestServiceUrl}${path}`;
}

export function ingestAuthHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...extra,
    Authorization: `Bearer ${internalIngestToken()}`,
  };
}
