"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ban } from "lucide-react";
import { InlineError } from "@/components/sat/alert";
import { HEADER_ACTION_DANGER_CLASS } from "@/components/sat/header-actions";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

/** Reasons a teacher can give; "Other" needs a short explanation. Stored as the audit reason. */
export const INVALIDATE_REASONS = [
  { value: "HEALTH", label: "Health" },
  { value: "CONNECTION", label: "Connection problem" },
  { value: "OTHER", label: "Other (explain)" },
] as const;

type ReasonValue = (typeof INVALIDATE_REASONS)[number]["value"];

/**
 * The only teacher action on an attempt: invalidate it ("doesn't count"). The try stays in the
 * history, crossed out, and leaves scores and reports. Retrying never needs the teacher: the first
 * assignment is the only one; students start new tries of a practice set or Test on their own.
 * One look everywhere (page header and History rows): the header action style, in red.
 */
export function InvalidateAttemptButton({
  attemptId,
  kind,
  status,
  compact = false,
}: {
  attemptId: string;
  kind: "practice" | "test";
  status: string;
  /** Short label for table rows ("Invalidate"). */
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReasonValue | "">("");
  const [other, setOther] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status !== "SUBMITTED") return null;

  const base = kind === "test" ? `/api/full-practice-tests/attempts/${attemptId}` : `/api/attempts/${attemptId}`;
  const missing = !reason ? "Choose a reason." : reason === "OTHER" && !other.trim() ? "Explain the reason." : null;

  async function submit() {
    if (missing) return;
    setWorking(true);
    setError(null);
    const label = INVALIDATE_REASONS.find((r) => r.value === reason)!.label;
    const text = reason === "OTHER" ? `Other: ${other.trim()}` : label;
    try {
      await apiFetch(`${base}/invalidate`, { method: "POST", json: { reason: text }, fallback: "The attempt could not be invalidated." });
      notify.success("Attempt invalidated. It no longer counts.");
      setOpen(false);
      setReason("");
      setOther("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <button type="button" className={HEADER_ACTION_DANGER_CLASS} onClick={() => setOpen(true)} title="Keep it in the history but don't count it">
        <Ban size={14} aria-hidden /> {compact ? "Invalidate" : "Invalidate attempt"}
      </button>
      <Dialog open={open} onOpenChange={(next) => !working && setOpen(next)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invalidate this attempt?</DialogTitle>
            <DialogDescription>
              It stays in the history, crossed out, but won&apos;t count toward scores or reports. The student can start a new try on their own.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`invalidate-reason-${attemptId}`}>Reason</Label>
            <Select id={`invalidate-reason-${attemptId}`} value={reason} onChange={(event) => setReason(event.target.value as ReasonValue | "")}>
              <option value="">Choose a reason…</option>
              {INVALIDATE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
            {reason === "OTHER" ? (
              <Textarea value={other} onChange={(event) => setOther(event.target.value)} placeholder="What happened?" rows={2} maxLength={400} aria-label="Other reason" />
            ) : null}
          </div>
          <InlineError className="text-xs">{error}</InlineError>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={working}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => void submit()} disabled={working || Boolean(missing)} disabledReason={working ? undefined : missing ?? undefined}>
              {working ? "Working..." : "Invalidate attempt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
