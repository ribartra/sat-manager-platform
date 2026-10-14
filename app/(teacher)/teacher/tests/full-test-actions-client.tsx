"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Edit, Eye, Play, Send, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

type FullTestActionsProps = {
  testId: string;
  status: string;
  hasAssignments: boolean;
  hasAttempts: boolean;
  /** list = View/Edit/Delete; detail = Edit + secondary lifecycle actions */
  variant?: "list" | "detail";
};

export function FullTestActions({
  testId,
  status,
  hasAssignments,
  hasAttempts,
  variant = "list",
}: FullTestActionsProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const confirm = useConfirm();
  const canDelete = !hasAssignments && !hasAttempts;
  const canAssign = status === "PUBLISHED";

  async function request(action: string, url: string, init: { method: string; json?: unknown } = { method: "POST" }) {
    setLoadingAction(action);
    let data: { test?: { id?: string } } | null = null;
    try {
      data = await apiFetch<{ test?: { id?: string } }>(url, { ...init, fallback: "Action failed." });
    } catch (error) {
      notify.error(error);
      return null;
    } finally {
      setLoadingAction(null);
    }
    router.refresh();
    return data;
  }

  async function changeStatus(nextStatus: string) {
    await request(nextStatus, `/api/full-practice-tests/${testId}`, { method: "PATCH", json: { status: nextStatus } });
  }

  async function duplicate() {
    const data = await request("duplicate", `/api/full-practice-tests/${testId}/duplicate`, { method: "POST" });
    if (data?.test?.id) router.push(`/teacher/tests/${data.test.id}/edit`);
  }

  async function remove() {
    if (!canDelete) return;
    const ok = await confirm({ title: "Delete this draft test?", description: "This cannot be undone.", tone: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    const data = await request("delete", `/api/full-practice-tests/${testId}`, { method: "DELETE" });
    if (data && variant === "detail") router.push("/teacher/tests");
  }

  if (variant === "list") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/teacher/tests/${testId}`}>
            <Eye size={14} />
            View
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/teacher/tests/${testId}/preview`}>
            <Play size={14} />
            Preview
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/teacher/tests/${testId}/edit`}>
            <Edit size={14} />
            Edit
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={remove}
          disabled={Boolean(loadingAction)}
          disabledReason={canDelete ? null : "Students already have this exam. Archive it instead."}
          title={canDelete ? "Delete test" : undefined}
        >
          <Trash2 size={14} />
          Delete
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button asChild variant="secondary" size="sm">
        <Link href={`/teacher/tests/${testId}/preview`}>
          <Play size={14} />
          Preview
        </Link>
      </Button>
      <Button asChild variant="secondary" size="sm">
        <Link href={`/teacher/tests/${testId}/edit`}>
          <Edit size={14} />
          Edit
        </Link>
      </Button>
      {canAssign ? (
        <Button asChild size="sm">
          <Link href={`/teacher/tests/${testId}/assign`}>
            <Send size={14} />
            Assign
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" disabledReason="Publish the test before assigning.">
          <Send size={14} />
          Assign
        </Button>
      )}
      {status !== "PUBLISHED" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => changeStatus("PUBLISHED")}
          disabled={Boolean(loadingAction)}
        >
          <UploadCloud size={14} />
          Publish
        </Button>
      )}
      {status !== "DRAFT" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => changeStatus("DRAFT")}
          disabled={Boolean(loadingAction)}
        >
          Draft
        </Button>
      )}
      {status !== "ARCHIVED" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => changeStatus("ARCHIVED")}
          disabled={Boolean(loadingAction)}
        >
          <Archive size={14} />
          Archive
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={duplicate} disabled={Boolean(loadingAction)}>
        <Copy size={14} />
        Duplicate
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={remove}
        disabled={Boolean(loadingAction)}
        disabledReason={canDelete ? null : "Students already have this exam. Archive it instead."}
        title={canDelete ? "Delete test" : undefined}
      >
        <Trash2 size={14} />
        Delete
      </Button>
    </div>
  );
}
