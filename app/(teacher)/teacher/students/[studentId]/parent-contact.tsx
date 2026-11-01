"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InlineError } from "@/components/sat/alert";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

/**
 * Parent line on the student page: the linked parents, or "Parent email: missing" with
 * "Add parent email". No approval step (consent is the Terms accepted at activation).
 */
export function ParentContact({ studentId, studentName, parents }: { studentId: string; studentName: string; parents: { name: string; email: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const data = await apiFetch<{ parentEmail: string; emailSent: boolean }>(`/api/students/${studentId}/parent`, {
        method: "POST",
        json: { parentName, parentEmail },
        fallback: "Could not add the parent.",
      });
      if (data.emailSent) notify.success("Parent added", `We emailed ${data.parentEmail} a link to sign in.`);
      else notify.success("Parent added", `The email to ${data.parentEmail} couldn't be sent. They can use "Forgot password" to sign in.`);
      setOpen(false);
      setParentName("");
      setParentEmail("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (parents.length > 0) {
    return (
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
        <Users size={12} aria-hidden /> Parent: {parents.map((p) => `${p.name} (${p.email})`).join(" · ")}
      </p>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="text-amber-700">Parent email: missing</span>
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(""); }}>
        <DialogTrigger asChild>
          <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs">
            Add parent email
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add parent email</DialogTitle>
            <DialogDescription>
              We link the parent or guardian to {studentName} and email them a link to sign in, so they can follow
              {" "}{studentName}&apos;s progress and receive reports.
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
                {sending ? "Adding…" : "Add parent"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
