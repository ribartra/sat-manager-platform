"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Edit, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuestionActions({ questionId, status, usedCount }: { questionId: string; status: string; usedCount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const canDelete = usedCount === 0;

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
    await request(nextStatus, `/api/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  async function duplicate() {
    const data = await request("duplicate", `/api/questions/${questionId}/duplicate`, { method: "POST" });
    if (data?.question?.id) router.push(`/teacher/questions/${data.question.id}/edit`);
  }

  async function remove() {
    if (!canDelete) return;
    if (!window.confirm("Delete this unused question? This cannot be undone.")) return;
    await request("delete", `/api/questions/${questionId}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/teacher/questions/${questionId}/edit`}>
          <Edit size={14} />
          Edit
        </Link>
      </Button>
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
      <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={!canDelete || Boolean(loading)} title={canDelete ? "Delete question" : "Archive questions that are already used."}>
        <Trash2 size={14} />
        Delete
      </Button>
    </div>
  );
}
