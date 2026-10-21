"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

/** Admin only (the page renders it for admins): cancel an open invitation so a new one can be sent. */
export function RevokeInviteButton({ inviteId, email }: { inviteId: string; email: string }) {
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
      await apiFetch(`/api/admin/invites/${inviteId}/revoke`, { method: "POST" });
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
