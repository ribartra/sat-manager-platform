"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

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

  const confirm = useConfirm();

  async function run(key: string, url: string, json?: unknown, fallback?: string) {
    setLoadingStatus(key);
    try {
      await apiFetch(url, { method: "POST", json, fallback });
    } catch (error) {
      notify.error(error);
    } finally {
      setLoadingStatus(null);
      router.refresh();
    }
  }

  const updateStatus = (validationStatus: "PENDING" | "APPROVED" | "REJECTED") =>
    run(validationStatus, `/api/admin/users/${userId}/validation`, { validationStatus }, "Could not update the validation status.");

  const toggleActive = () => run("ACTIVE", `/api/admin/users/${userId}/toggle-active`, undefined, "Could not update access.");

  // Erasure on request (RNF-12): typed-email confirmation, personal data removed, history kept.
  async function anonymize() {
    const ok = await confirm({
      title: "Anonymize this account?",
      description:
        "Name, email, phone, birth date, avatar and personal notes are removed and the account is disabled. Attempts and scores stay, without the name. This cannot be undone.",
      tone: "danger",
      confirmLabel: "Anonymize",
      requireText: email,
    });
    if (!ok) return;
    await run("ANONYMIZE", `/api/admin/users/${userId}/anonymize`, { confirmEmail: email }, "Could not anonymize the account.");
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
