"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Play, Send, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { usePracticeSetMutations } from "./use-practice-set-mutations";

/**
 * Actions of a Practice Set in its editor header (same set as a Test's detail page): Preview, Assign
 * (published only), Publish / Draft / Archive, Duplicate and Delete (only when no student has it).
 */
export function PracticeSetActions({
  set,
  assignHref,
  canDelete,
  backHref,
}: {
  set: { id: string; name: string; status: string };
  /** The Assign view with this set preselected. */
  assignHref: string;
  /** False when it has assignments or attempts (the API refuses; archive it instead). */
  canDelete: boolean;
  /** Where to go after deleting (Practice › By skill on its skill). */
  backHref: string;
}) {
  const router = useRouter();
  const { busy, changeStatus, remove } = usePracticeSetMutations();
  const [duplicating, setDuplicating] = useState(false);
  const disabled = busy || duplicating;

  async function duplicate() {
    setDuplicating(true);
    try {
      const data = await apiFetch<{ practiceSet?: { id?: string } }>(`/api/practice-sets/${set.id}/duplicate`, { method: "POST", fallback: "Unable to duplicate." });
      if (data?.practiceSet?.id) router.push(`/teacher/practice-sets/${data.practiceSet.id}/edit`);
    } catch (error) {
      notify.error(error);
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button asChild variant="secondary" size="sm">
        <Link href={`/teacher/practice-sets/${set.id}/preview`}>
          <Play size={14} /> Preview
        </Link>
      </Button>
      {set.status === "PUBLISHED" ? (
        <Button asChild size="sm">
          <Link href={assignHref}>
            <Send size={14} /> Assign
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" disabledReason="Publish the set before assigning it.">
          <Send size={14} /> Assign
        </Button>
      )}
      {set.status !== "PUBLISHED" ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => changeStatus(set, "PUBLISHED")} disabled={disabled}>
          <UploadCloud size={14} /> Publish
        </Button>
      ) : null}
      {set.status !== "DRAFT" ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => changeStatus(set, "DRAFT")} disabled={disabled}>
          Draft
        </Button>
      ) : null}
      {set.status !== "ARCHIVED" ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => changeStatus(set, "ARCHIVED")} disabled={disabled}>
          <Archive size={14} /> Archive
        </Button>
      ) : null}
      <Button type="button" variant="ghost" size="sm" onClick={duplicate} disabled={disabled}>
        <Copy size={14} /> Duplicate
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => remove(set, backHref)}
        disabled={disabled}
        disabledReason={canDelete ? null : "Students already have this set. Archive it instead."}
        title={canDelete ? "Delete Practice Set" : undefined}
      >
        <Trash2 size={14} /> Delete
      </Button>
    </div>
  );
}
