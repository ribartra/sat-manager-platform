"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

export function PracticeSetActions({
  practiceSetId,
  assignmentCount,
}: {
  practiceSetId: string;
  assignmentCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();
  const canDelete = assignmentCount === 0;

  async function remove() {
    if (!canDelete) return;
    const ok = await confirm({ title: "Delete this Practice Set?", description: "It is not used by any assignment. This cannot be undone.", tone: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    setLoading(true);
    try {
      await apiFetch(`/api/practice-sets/${practiceSetId}`, { method: "DELETE", fallback: "Could not delete the Practice Set." });
    } catch (error) {
      notify.error(error);
      return;
    } finally {
      setLoading(false);
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/teacher/practice-sets/${practiceSetId}/preview`}>
          <Play size={14} />
          Preview
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href={`/teacher/practice-sets/${practiceSetId}/edit`}>
          <Edit size={14} />
          Edit
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={remove}
        disabled={loading}
        disabledReason={canDelete ? null : "Students already have this set. Archive it instead."}
        title={canDelete ? "Delete Practice Set" : undefined}
      >
        <Trash2 size={14} />
        Delete
      </Button>
    </div>
  );
}
