"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UserValidationActions({
  userId,
  currentStatus,
  active,
  isSelf,
}: {
  userId: string;
  currentStatus: string;
  active: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);

  async function updateStatus(validationStatus: "PENDING" | "APPROVED" | "REJECTED") {
    setLoadingStatus(validationStatus);
    await fetch(`/api/admin/users/${userId}/validation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ validationStatus }),
    });
    setLoadingStatus(null);
    router.refresh();
  }

  async function toggleActive() {
    setLoadingStatus("ACTIVE");
    const response = await fetch(`/api/admin/users/${userId}/toggle-active`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setLoadingStatus(null);
    if (!response.ok) window.alert(data.error || "Could not update access.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="secondary" size="sm" onClick={toggleActive} disabled={Boolean(loadingStatus) || isSelf}>
        {loadingStatus === "ACTIVE" ? "Saving..." : active ? "Disable" : "Enable"}
      </Button>
      {currentStatus !== "APPROVED" && (
        <Button size="sm" onClick={() => updateStatus("APPROVED")} disabled={Boolean(loadingStatus)}>
          {loadingStatus === "APPROVED" ? "Saving..." : "Approve"}
        </Button>
      )}
      {currentStatus !== "REJECTED" && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => updateStatus("REJECTED")}
          disabled={Boolean(loadingStatus) || isSelf}
        >
          {loadingStatus === "REJECTED" ? "Saving..." : "Reject"}
        </Button>
      )}
      {currentStatus !== "PENDING" && (
        <Button variant="secondary" size="sm" onClick={() => updateStatus("PENDING")} disabled={Boolean(loadingStatus) || isSelf}>
          {loadingStatus === "PENDING" ? "Saving..." : "Mark pending"}
        </Button>
      )}
    </div>
  );
}
