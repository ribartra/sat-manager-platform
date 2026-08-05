"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Edit, Send, ShieldAlert, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PracticeSetActions({
  practiceSetId,
  status,
  assignmentCount,
}: {
  practiceSetId: string;
  status: string;
  assignmentCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const canDelete = assignmentCount === 0;
  const canAssign = status === "PUBLISHED";

  async function request(action: string, url: string, init: RequestInit) {
    setLoading(action);
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    setLoading(null);
    if (!response.ok) {
      window.alert(data.errors?.join("\n") || data.error || "Action failed.");
      return null;
    }
    router.refresh();
    return data;
  }

  async function setStatus(nextStatus: string) {
    await request(nextStatus, `/api/practice-sets/${practiceSetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  async function duplicate() {
    const data = await request("duplicate", `/api/practice-sets/${practiceSetId}/duplicate`, { method: "POST" });
    if (data?.practiceSet?.id) router.push(`/teacher/practice-sets/${data.practiceSet.id}/edit`);
  }

  async function remove() {
    if (!canDelete) return;
    if (!window.confirm("Delete this unused Practice Set? This cannot be undone.")) return;
    await request("delete", `/api/practice-sets/${practiceSetId}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/teacher/practice-sets/${practiceSetId}/edit`}>
          <Edit size={14} />
          Edit
        </Link>
      </Button>
      {canAssign ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/teacher?assignPracticeSet=${practiceSetId}`}>
            <Send size={14} />
            Assign
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" disabled title="Publish the Practice Set before assigning.">
          <Send size={14} />
          Assign
        </Button>
      )}
      {status !== "PUBLISHED" && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setStatus("PUBLISHED")} disabled={Boolean(loading)}>
          <UploadCloud size={14} />
          Publish
        </Button>
      )}
      {status !== "DRAFT" && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setStatus("DRAFT")} disabled={Boolean(loading)}>
          Draft
        </Button>
      )}
      {status !== "BLOCKED" && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setStatus("BLOCKED")} disabled={Boolean(loading)}>
          <ShieldAlert size={14} />
          Block
        </Button>
      )}
      {status !== "ARCHIVED" && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setStatus("ARCHIVED")} disabled={Boolean(loading)}>
          <Archive size={14} />
          Archive
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={duplicate} disabled={Boolean(loading)}>
        <Copy size={14} />
        Duplicate
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={!canDelete || Boolean(loading)} title={canDelete ? "Delete Practice Set" : "Archive sets with assignments."}>
        <Trash2 size={14} />
        Delete
      </Button>
    </div>
  );
}
