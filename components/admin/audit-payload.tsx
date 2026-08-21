"use client";

import { useState } from "react";

export function AuditPayload({
  payload,
  targetType,
  targetId,
}: {
  payload: string;
  targetType?: string | null;
  targetId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasPayload = Boolean(payload?.trim());
  const preview = hasPayload ? payload.replace(/\s+/g, " ").slice(0, 120) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-w-0">
      {(targetType || targetId) && (
        <p className="text-xs text-gray-600">
          {targetType && <span className="font-medium text-gray-800">{targetType}</span>}
          {targetId && (
            <span className="ml-1 break-all font-mono text-[11px] text-gray-500" title={targetId}>
              {targetId}
            </span>
          )}
        </p>
      )}

      {hasPayload && (
        <div className="mt-1">
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="block w-full text-left font-mono text-[11px] leading-snug text-gray-500 hover:text-gray-800"
              title="Show full payload"
            >
              <span className="line-clamp-2 break-all">{preview}{payload.length > 120 ? "…" : ""}</span>
              <span className="mt-0.5 inline-block text-[10px] font-sans font-medium text-blue-600">
                Show full payload
              </span>
            </button>
          )}

          {open && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[10px] font-medium text-blue-600 hover:underline"
                >
                  Hide payload
                </button>
                <button
                  type="button"
                  onClick={copy}
                  className="text-[10px] font-medium text-gray-600 hover:text-gray-900"
                >
                  {copied ? "Copied" : "Copy JSON"}
                </button>
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-800">
                {payload}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
