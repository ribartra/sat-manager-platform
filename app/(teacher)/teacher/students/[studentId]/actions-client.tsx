"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserX } from "lucide-react";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

export function StudentDetailActions({ studentId, isActive }: { studentId: string; isActive: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();

  async function toggleActive() {
    if (
      isActive &&
      !(await confirm({
        title: "Deactivate this student?",
        description: "They will not be able to sign in until reactivated. Their data and history are kept.",
        tone: "danger",
        confirmLabel: "Deactivate",
      }))
    )
      return;
    setLoading(true);
    try {
      await apiFetch(`/api/students/${studentId}/toggle-active`, { method: "POST", fallback: "Could not update the student." });
    } catch (error) {
      notify.error(error);
    } finally {
      setLoading(false);
    }
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={toggleActive}
      disabled={loading}
      title={isActive ? "Block sign-in for this student (data and history are kept). You can reactivate later." : "Allow this student to sign in again."}
      className="gap-1.5 px-2.5 text-sm"
    >
      {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
      {loading ? "…" : isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
