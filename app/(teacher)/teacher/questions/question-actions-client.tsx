"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

export function QuestionActions({ questionId, usedCount }: { questionId: string; usedCount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();
  const canDelete = usedCount === 0;

  async function remove() {
    if (!canDelete) return;
    const ok = await confirm({ title: "Delete this question?", description: "It is not used anywhere. This cannot be undone.", tone: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    setLoading(true);
    try {
      await apiFetch(`/api/questions/${questionId}`, { method: "DELETE", fallback: "Could not delete the question." });
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
        <Link href={`/teacher/questions/${questionId}/edit`}>
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
        disabledReason={canDelete ? null : "This question is already used: archive it instead."}
        title={canDelete ? "Delete question" : undefined}
      >
        <Trash2 size={14} />
        Delete
      </Button>
    </div>
  );
}
