"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineError } from "@/components/sat/alert";
import { errorMessage, readApiError } from "@/lib/api-client";

type AttemptAction = "reopen" | "invalidate";

const COPY: Record<AttemptAction, { title: string; confirm: string; body: string }> = {
  invalidate: {
    title: "Don't count this result?",
    confirm: "Don't count",
    body: "It stays in the history, crossed out, but won't count toward scores or reports. The student can't continue it.",
  },
  reopen: {
    title: "Let the student retry?",
    confirm: "Start over",
    body: "This result won't count (it stays crossed out in the history), and the student can start again from the beginning.",
  },
};

export function AttemptActions({
  attemptId,
  initialComment,
  kind = "practice",
  status,
}: {
  attemptId: string;
  initialComment?: string | null;
  kind?: "practice" | "fpt";
  status?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<AttemptAction | null>(null);
  const [pending, setPending] = useState<AttemptAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState(initialComment ?? "");
  const [actionReason, setActionReason] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const base = kind === "fpt" ? `/api/full-practice-tests/attempts/${attemptId}` : `/api/attempts/${attemptId}`;
  const invalidated = status === "INVALIDATED";

  async function run(action: AttemptAction) {
    setLoading(action);
    setError(null);
    const response = await fetch(`${base}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: actionReason }),
    });
    setLoading(null);
    setPending(null);
    if (!response.ok) {
      setError(errorMessage(await readApiError(response, "The action could not be completed.")));
      return;
    }
    setActionReason("");
    router.refresh();
  }

  async function saveComment() {
    setSavingComment(true);
    await fetch(`/api/attempts/${attemptId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    setSavingComment(false);
    router.refresh();
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      {invalidated ? (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          This result doesn&apos;t count. It&apos;s kept for reference only.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPending("reopen")}
              disabled={loading !== null}
              title="This result won't count and the student starts again"
            >
              {loading === "reopen" ? "Working..." : "Let student retry"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setPending("invalidate")}
              disabled={loading !== null}
              title="Keep it in the history but don't count it"
            >
              {loading === "invalidate" ? "Working..." : "Don't count"}
            </Button>
          </div>
          <Textarea
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
            placeholder="Reason (optional, visible to admins)"
            rows={2}
          />
        </>
      )}
      <InlineError className="text-xs">{error}</InlineError>
      {kind === "practice" ? (
        <>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Add a comment for the student"
            rows={3}
          />
          <Button variant="secondary" size="sm" onClick={saveComment} disabled={savingComment}>
            {savingComment ? "Saving comment..." : "Save comment"}
          </Button>
        </>
      ) : null}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-md">
          {pending ? (
            <>
              <DialogHeader>
                <DialogTitle>{COPY[pending].title}</DialogTitle>
                <DialogDescription>{COPY[pending].body}</DialogDescription>
              </DialogHeader>
              {actionReason.trim() ? (
                <p className="text-sm text-gray-600">
                  Reason: <span className="text-gray-900">{actionReason.trim()}</span>
                </p>
              ) : (
                <p className="text-xs text-gray-500">No reason added. You can add one before confirming.</p>
              )}
              <DialogFooter>
                <Button variant="secondary" size="sm" onClick={() => setPending(null)} disabled={loading !== null}>
                  Cancel
                </Button>
                <Button
                  variant={pending === "invalidate" ? "danger" : "primary"}
                  size="sm"
                  onClick={() => void run(pending)}
                  disabled={loading !== null}
                >
                  {loading ? "Working..." : COPY[pending].confirm}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
