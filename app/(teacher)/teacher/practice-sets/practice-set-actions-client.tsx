"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PracticeSetActions({
  practiceSetId,
  assignmentCount,
}: {
  practiceSetId: string;
  assignmentCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const canDelete = assignmentCount === 0;

  async function remove() {
    if (!canDelete) return;
    if (!window.confirm("Delete this unused Practice Set? This cannot be undone.")) return;
    setLoading(true);
    const response = await fetch(`/api/practice-sets/${practiceSetId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      window.alert(data.errors?.join("\n") || data.error || "Action failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
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
        disabled={!canDelete || loading}
        title={canDelete ? "Delete Practice Set" : "Archive sets with assignments."}
      >
        <Trash2 size={14} />
        Delete
      </Button>
    </div>
  );
}
