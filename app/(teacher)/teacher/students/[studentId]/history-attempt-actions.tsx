"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineError } from "@/components/sat/alert";
import { InvalidateAttemptButton } from "@/components/sat/invalidate-attempt-button";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

/**
 * History row actions: "Invalidate" (same reason dialog as the attempt pages) and, for practice
 * tries, a comment for the student. Retrying needs no teacher action: students start new tries.
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
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState(initialComment ?? "");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveComment() {
    setWorking(true);
    setError(null);
    try {
      await apiFetch(`/api/attempts/${attemptId}/comment`, { method: "POST", json: { comment }, fallback: "The comment could not be saved." });
      notify.success(comment.trim() ? "Comment saved." : "Comment removed.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <span className="flex items-center justify-end gap-1">
      {kind === "practice" ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          title={initialComment ? "Edit the comment for the student" : "Add a comment for the student"}
          aria-label={initialComment ? "Edit comment" : "Add comment"}
        >
          <MessageSquare size={14} aria-hidden />
          {initialComment ? <span className="ml-1">Comment</span> : null}
        </Button>
      ) : null}
      <InvalidateAttemptButton attemptId={attemptId} kind={kind} status={status} compact />

      {kind === "practice" ? (
        <Dialog open={open} onOpenChange={(next) => !working && setOpen(next)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Comment for the student</DialogTitle>
              <DialogDescription>The student sees it on this try&apos;s results. Leave it empty to remove it.</DialogDescription>
            </DialogHeader>
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment for the student" rows={3} />
            <InlineError className="text-xs">{error}</InlineError>
            <DialogFooter>
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={working}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void saveComment()} disabled={working}>
                {working ? "Working..." : "Save comment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </span>
  );
}
