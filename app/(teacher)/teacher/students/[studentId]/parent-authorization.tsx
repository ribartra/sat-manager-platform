"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InlineError } from "@/components/sat/alert";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

export type ParentAuthorizationView =
  | { status: "authorized"; label: string }
  | { status: "waiting"; parentEmail: string; label: string }
  | { status: "none" };

/** Parent line on the student page: who authorized, a pending request, or "Ask parent to authorize". */
export function ParentAuthorization({ studentId, studentName, state }: { studentId: string; studentName: string; state: ParentAuthorizationView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function request(json: Record<string, unknown>) {
    setSending(true);
    setError("");
    try {
      const data = await apiFetch<{ parentEmail: string }>(`/api/students/${studentId}/parent-authorization`, {
        method: "POST",
        json,
        fallback: "Could not send the request.",
      });
      notify.success("Request sent", `We emailed ${data.parentEmail}. ${studentName} can keep practicing meanwhile.`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (open) setError(errorMessage(err));
      else notify.error(err);
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void request({ parentName, parentEmail });
  }

  if (state.status === "authorized") {
    return (
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-green-700">
        <ShieldCheck size={12} /> {state.label}
      </p>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
      <span>{state.status === "waiting" ? state.label : "Parent: not authorized yet."}</span>
      {state.status === "waiting" ? (
        <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs" disabled={sending} onClick={() => void request({ resend: true })}>
          {sending ? "Sending…" : "Resend"}
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(""); }}>
        <DialogTrigger asChild>
          <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs">
            {state.status === "waiting" ? "Change parent" : "Ask parent to authorize"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ask parent to authorize</DialogTitle>
            <DialogDescription>
              We email the parent or guardian a link to authorize {studentName}&apos;s account. {studentName} keeps
              practicing while they decide. Once they accept, they can also receive progress reports.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Parent name</label>
              <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Parent email <span className="text-red-500">*</span>
              </label>
              <Input type="email" required value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
            </div>
            <InlineError>{error}</InlineError>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={sending || !parentEmail.trim()} disabledReason={!parentEmail.trim() ? "Enter the parent's email." : null}>
                {sending ? "Sending…" : "Send request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
