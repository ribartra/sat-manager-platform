"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

/**
 * Cancel an open invitation so a new one can be sent. Admin (students' invitations, default
 * endpoint) and the master teacher (teacher invitations, `endpoint="/api/teachers/invites/…"`).
 */
export function RevokeInviteButton({ inviteId, email, endpoint = `/api/admin/invites/${inviteId}/revoke` }: { inviteId: string; email: string; endpoint?: string }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function revoke() {
    const ok = await confirm({
      title: "Cancel this invitation?",
      description: `The link sent to ${email} will stop working, and you can send a new invitation to this email.`,
      confirmLabel: "Cancel invitation",
      cancelLabel: "Keep it",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch(endpoint, { method: "POST" });
      notify.success("Invitation cancelled");
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => void revoke()} disabled={busy}>
      <XCircle size={14} /> {busy ? "Cancelling…" : "Cancel invitation"}
    </Button>
  );
}
