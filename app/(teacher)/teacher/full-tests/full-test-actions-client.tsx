"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Edit, Eye, Send, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

type FullTestActionsProps = {
  testId: string;
  status: string;
  hasAssignments: boolean;
  hasAttempts: boolean;
};

export function FullTestActions({ testId, status, hasAssignments, hasAttempts }: FullTestActionsProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const canDelete = !hasAssignments && !hasAttempts;
  const canAssign = status === "PUBLISHED";

  async function request(action: string, url: string, init: RequestInit = {}) {
    setLoadingAction(action);
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    setLoadingAction(null);
    if (!response.ok) {
      window.alert(data.errors?.join("\n") || data.error || "Action failed.");
      return null;
    }
    router.refresh();
    return data;
  }

  async function changeStatus(nextStatus: string) {
    await request(nextStatus, `/api/full-practice-tests/${testId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  async function duplicate() {
    const data = await request("duplicate", `/api/full-practice-tests/${testId}/duplicate`, { method: "POST" });
    if (data?.test?.id) router.push(`/teacher/full-tests/${data.test.id}/edit`);
  }

  async function remove() {
    if (!canDelete) return;
    if (!window.confirm("Delete this draft exam? This cannot be undone.")) return;
    await request("delete", `/api/full-practice-tests/${testId}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/teacher/full-tests/${testId}`}>
          <Eye size={14} />
          View
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href={`/teacher/full-tests/${testId}/edit`}>
          <Edit size={14} />
          Edit
        </Link>
      </Button>
      {canAssign ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/teacher/full-tests/${testId}/assign`}>
            <Send size={14} />
            Assign
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" disabled title="Publish the exam before assigning.">
          <Send size={14} />
          Assign
        </Button>
      )}
      {status !== "PUBLISHED" && (
        <Button type="button" variant="ghost" size="sm" onClick={() => changeStatus("PUBLISHED")} disabled={Boolean(loadingAction)}>
          <UploadCloud size={14} />
          Publish
        </Button>
      )}
      {status !== "DRAFT" && (
        <Button type="button" variant="ghost" size="sm" onClick={() => changeStatus("DRAFT")} disabled={Boolean(loadingAction)}>
          Draft
        </Button>
      )}
      {status !== "ARCHIVED" && (
        <Button type="button" variant="ghost" size="sm" onClick={() => changeStatus("ARCHIVED")} disabled={Boolean(loadingAction)}>
          <Archive size={14} />
          Archive
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={duplicate} disabled={Boolean(loadingAction)}>
        <Copy size={14} />
        Duplicate
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={!canDelete || Boolean(loadingAction)} title={canDelete ? "Delete exam" : "Archive exams with assignments or attempts."}>
        <Trash2 size={14} />
        Delete
      </Button>
    </div>
  );
}
