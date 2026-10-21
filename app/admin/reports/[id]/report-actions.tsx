"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

export function ReportActions({ id, status, emailed }: { id: string; status: string; emailed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"status" | "email" | null>(null);

  async function setStatus(next: "OPEN" | "RESOLVED") {
    setBusy("status");
    try {
      await apiFetch(`/api/admin/issue-reports/${id}`, { method: "PATCH", json: { status: next } });
      notify.success(next === "RESOLVED" ? "Marked as resolved." : "Reopened.");
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    setBusy("email");
    try {
      await apiFetch(`/api/admin/issue-reports/${id}`, { method: "POST" });
      notify.success("Email sent.");
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" onClick={resend} disabled={busy !== null}>
        {busy === "email" ? "Sending…" : emailed ? "Send email again" : "Send email"}
      </Button>
      {status === "RESOLVED" ? (
        <Button type="button" variant="secondary" onClick={() => setStatus("OPEN")} disabled={busy !== null}>Reopen</Button>
      ) : (
        <Button type="button" onClick={() => setStatus("RESOLVED")} disabled={busy !== null}>
          {busy === "status" ? "Saving…" : "Mark resolved"}
        </Button>
      )}
    </div>
  );
}
