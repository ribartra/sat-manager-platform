"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineError } from "@/components/sat/alert";
import { errorMessage, readApiError } from "@/lib/api-client";

type AttemptAction = "reopen" | "invalidate";

const COPY: Record<AttemptAction, { title: string; confirm: string; body: (subject: string) => string }> = {
  invalidate: {
    title: "Invalidate this attempt?",
    confirm: "Invalidate attempt",
    body: (subject) =>
      `The attempt stays in the history exactly as it is, shown crossed out, and no longer counts toward any score, average, report or analytics. The student cannot resume it. This applies to the whole ${subject}.`,
  },
  reopen: {
    title: "Reopen for a new attempt?",
    confirm: "Invalidate and reopen",
    body: (subject) =>
      `This attempt is invalidated (kept in the history, crossed out, not counted) and the ${subject} goes back to Pending so the student can start a brand-new attempt from the beginning.`,
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
  const subject = kind === "fpt" ? "exam" : "Practice Set";
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
          This attempt is invalidated. It is kept for reference and does not count toward any score.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPending("reopen")}
              disabled={loading !== null}
              title="Invalidate this attempt and let the student start a new one"
            >
              {loading === "reopen" ? "Reopening..." : "Reopen attempt"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setPending("invalidate")}
              disabled={loading !== null}
              title="Keep the attempt in the history but stop counting it"
            >
              {loading === "invalidate" ? "Invalidating..." : "Invalidate"}
            </Button>
          </div>
          <Textarea
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
            placeholder="Optional reason for reopen/invalidate (saved in audit log)"
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
            placeholder="Add teacher comment for the student"
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
                <DialogDescription>{COPY[pending].body(subject)}</DialogDescription>
              </DialogHeader>
              {actionReason.trim() ? (
                <p className="text-sm text-gray-600">
                  Reason: <span className="text-gray-900">{actionReason.trim()}</span>
                </p>
              ) : (
                <p className="text-xs text-gray-500">No reason given. You can add one before confirming.</p>
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
