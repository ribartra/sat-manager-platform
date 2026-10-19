"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

/** Student "Retake" for a finished Test: confirm, start a new attempt, open its module intro. */
export function RetakeTestButton({ assignmentId, testName, size = "sm" }: { assignmentId: string; testName: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function retake() {
    const ok = await confirm({
      title: `Retake ${testName}?`,
      description: "A new attempt will be created. Your previous results are kept and you can still review them.",
      confirmLabel: "Start new attempt",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch(`/api/full-practice-tests/assignments/${assignmentId}/retake`, { method: "POST" });
      router.push(`/student/tests/${assignmentId}?module=rw1`);
    } catch (error) {
      notify.error(error, "The new attempt could not be started.");
      setBusy(false);
    }
  }

  return (
    <Button type="button" size={size} variant="secondary" onClick={() => void retake()} disabled={busy}>
      <RotateCcw size={14} /> {busy ? "Starting…" : "Retake"}
    </Button>
  );
}
