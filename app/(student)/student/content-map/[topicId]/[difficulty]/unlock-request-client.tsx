"use client";

import { useState } from "react";

export function UnlockRequestButton({ assignmentId, requested }: { assignmentId: string; requested: boolean }) {
  const [sent, setSent] = useState(requested);

  async function requestUnlock() {
    await fetch("/api/unlock-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId }),
    });
    setSent(true);
  }

  return (
    <button
      onClick={requestUnlock}
      disabled={sent}
      className="text-xs text-blue-600 underline disabled:text-gray-400 disabled:no-underline"
    >
      {sent ? "Unlock requested" : "Request unlock"}
    </button>
  );
}
