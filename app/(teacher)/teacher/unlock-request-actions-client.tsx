"use client";

import { BLOCKED_TEXT } from "@/components/ui/control-states";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function UnlockRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function update(status: "APPROVED" | "DENIED") {
    setLoading(status);
    await fetch(`/api/unlock-requests/${requestId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => update("APPROVED")} disabled={loading !== null} className={`text-xs font-medium text-green-700 hover:underline ${BLOCKED_TEXT}`}>
        {loading === "APPROVED" ? "Approving..." : "Approve"}
      </button>
      <button onClick={() => update("DENIED")} disabled={loading !== null} className={`text-xs font-medium text-red-700 hover:underline ${BLOCKED_TEXT}`}>
        {loading === "DENIED" ? "Denying..." : "Deny"}
      </button>
    </div>
  );
}
