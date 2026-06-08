"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UserValidationActions({
  userId,
  currentStatus,
  isSelf,
}: {
  userId: string;
  currentStatus: string;
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

  return (
    <div className="flex justify-end gap-2">
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
