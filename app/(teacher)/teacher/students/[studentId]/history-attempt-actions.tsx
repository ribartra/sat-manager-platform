"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineError } from "@/components/sat/alert";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

/**
 * History row actions (moved here from the attempt page's "Teacher actions" card): "Don't count"
 * keeps the try in the history, crossed out, but out of scores and reports; practice tries also take
 * a comment for the student. Retrying needs no teacher action: students start a new try themselves.
 */
export function HistoryAttemptActions({
  attemptId,
  kind,
  status,
  initialComment,
}: {
  attemptId: string;
  kind: "practice" | "test";
  status: string;
  initialComment?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"invalidate" | "comment" | null>(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState(initialComment ?? "");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = kind === "test" ? `/api/full-practice-tests/attempts/${attemptId}` : `/api/attempts/${attemptId}`;
  const canInvalidate = status === "SUBMITTED";

  function close() {
    setOpen(null);
    setError(null);
  }

  async function submit() {
    setWorking(true);
    setError(null);
    try {
      if (open === "invalidate") {
        await apiFetch(`${base}/invalidate`, { method: "POST", json: { reason }, fallback: "The result could not be excluded." });
        setReason("");
        notify.success("This try no longer counts.");
      } else {
        await apiFetch(`/api/attempts/${attemptId}/comment`, { method: "POST", json: { comment }, fallback: "The comment could not be saved." });
        notify.success(comment.trim() ? "Comment saved." : "Comment removed.");
      }
      setOpen(null);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  if (!canInvalidate && kind !== "practice") return null;
  return (
    <span className="flex items-center justify-end gap-1">
      {kind === "practice" ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen("comment")}
          title={initialComment ? "Edit the comment for the student" : "Add a comment for the student"}
          aria-label={initialComment ? "Edit comment" : "Add comment"}
        >
          <MessageSquare size={14} aria-hidden />
          {initialComment ? <span className="ml-1">Comment</span> : null}
        </Button>
      ) : null}
      {canInvalidate ? (
        <Button variant="ghost" size="sm" className="text-[var(--sat-bad)]" onClick={() => setOpen("invalidate")} title="Keep it in the history but don't count it">
          Don&apos;t count
        </Button>
      ) : null}

      <Dialog open={open !== null} onOpenChange={(next) => !next && !working && close()}>
        <DialogContent className="max-w-md">
          {open === "invalidate" ? (
            <DialogHeader>
              <DialogTitle>Don&apos;t count this result?</DialogTitle>
              <DialogDescription>
                It stays in the history, crossed out, but won&apos;t count toward scores or reports. The student can still start a new try.
              </DialogDescription>
            </DialogHeader>
          ) : open === "comment" ? (
            <DialogHeader>
              <DialogTitle>Comment for the student</DialogTitle>
              <DialogDescription>The student sees it on this try&apos;s results. Leave it empty to remove it.</DialogDescription>
            </DialogHeader>
          ) : null}
          {open === "invalidate" ? (
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (optional, visible to admins)" rows={2} />
          ) : (
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment for the student" rows={3} />
          )}
          <InlineError className="text-xs">{error}</InlineError>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={close} disabled={working}>
              Cancel
            </Button>
            <Button variant={open === "invalidate" ? "danger" : "primary"} size="sm" onClick={() => void submit()} disabled={working}>
              {working ? "Working..." : open === "invalidate" ? "Don't count" : "Save comment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
