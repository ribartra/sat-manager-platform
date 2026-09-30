"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UserValidationActions({
  userId,
  currentStatus,
  active,
  isSelf,
  email,
}: {
  userId: string;
  currentStatus: string;
  active: boolean;
  isSelf: boolean;
  email: string;
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

  // Erasure on request (RNF-12): typed-email confirmation, personal data removed, history kept.
  async function anonymize() {
    const typed = window.prompt(
      `Anonymize this account? Name, email, phone, birth date, avatar and personal notes are removed and the account is disabled. Attempts and scores stay, without the name. This cannot be undone.\n\nType ${email} to confirm:`,
    );
    if (typed === null) return;
    setLoadingStatus("ANONYMIZE");
    const response = await fetch(`/api/admin/users/${userId}/anonymize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmEmail: typed }),
    });
    const data = await response.json().catch(() => ({}));
    setLoadingStatus(null);
    if (!response.ok) window.alert(data.error || "Could not anonymize the account.");
    router.refresh();
  }

  const anonymized = email.endsWith("@invalid.local");

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="secondary" size="sm" asChild>
        <a href={`/api/admin/users/${userId}/export`} download>Export data</a>
      </Button>
      {!isSelf && !anonymized ? (
        <Button variant="danger" size="sm" onClick={anonymize} disabled={Boolean(loadingStatus)}>
          {loadingStatus === "ANONYMIZE" ? "Saving..." : "Anonymize"}
        </Button>
      ) : null}
      <Button variant="secondary" size="sm" onClick={toggleActive} disabled={Boolean(loadingStatus)} disabledReason={isSelf ? "You cannot change your own account here." : null}>
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
          disabled={Boolean(loadingStatus)} disabledReason={isSelf ? "You cannot change your own account here." : null}
        >
          {loadingStatus === "REJECTED" ? "Saving..." : "Reject"}
        </Button>
      )}
      {currentStatus !== "PENDING" && (
        <Button variant="secondary" size="sm" onClick={() => updateStatus("PENDING")} disabled={Boolean(loadingStatus)} disabledReason={isSelf ? "You cannot change your own account here." : null}>
          {loadingStatus === "PENDING" ? "Saving..." : "Mark pending"}
        </Button>
      )}
    </div>
  );
}
