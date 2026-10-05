"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { BLOCKED_TEXT } from "@/components/ui/control-states";
import { cn } from "@/lib/utils";

/**
 * Restart an exam the student already started: the open attempt is invalidated (kept in the history,
 * not counted) and the assignment goes back to Pending, so the next start takes a fresh snapshot with
 * the current exam content. Same lifecycle as "Reopen attempt" on the attempt page.
 */
export function RestartExamButton({ attemptId, examName }: { attemptId: string; examName: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function restart() {
    const ok = await confirm({
      title: `Restart ${examName}?`,
      description:
        "The attempt in progress is invalidated (kept in the history, crossed out, not counted) and the exam goes back to Pending. The student starts again from the beginning with the current version of the exam.",
      confirmLabel: "Restart exam",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch(`/api/full-practice-tests/attempts/${attemptId}/reopen`, {
        method: "POST",
        json: { reason: "Restarted from the student page (exam back to Pending)" },
      });
      notify.success("Exam restarted", "The student will start a new attempt.");
      router.refresh();
    } catch (error) {
      notify.error(error, "The exam could not be restarted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void restart()}
      disabled={busy}
      className={cn("shrink-0 text-xs font-medium text-red-600 hover:underline", BLOCKED_TEXT)}
    >
      {busy ? "Restarting…" : "Restart"}
    </button>
  );
}
