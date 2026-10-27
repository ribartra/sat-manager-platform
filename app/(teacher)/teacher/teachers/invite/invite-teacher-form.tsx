"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/sat/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

export function InviteTeacherForm({ programs }: { programs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; emailSent: boolean; inviteUrl: string } | null>(null);
  const missing = !programs.length
    ? "You don't teach any program yet."
    : !name.trim()
      ? "Enter the teacher's name."
      : !email.trim()
        ? "Enter the teacher's email."
        : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (missing) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ inviteUrl: string; emailSent: boolean }>("/api/teachers/invite", {
        method: "POST",
        json: { name: name.trim(), email: email.trim(), programId },
        fallback: "The invitation could not be created.",
      });
      setSent({ email: email.trim(), ...result });
      notify.success("Invitation created.");
      setName("");
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="lg">
      {sent ? (
        <Alert tone={sent.emailSent ? "success" : "warning"} className="mb-4">
          {sent.emailSent ? `Invitation sent to ${sent.email}.` : `The email to ${sent.email} could not be sent. Share this link with them:`}
          {sent.emailSent ? null : <span className="mt-1 block break-all font-mono text-xs">{sent.inviteUrl}</span>}
        </Alert>
      ) : null}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="teacher-name">Name</Label>
          <Input id="teacher-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="teacher-email">Email</Label>
          <Input id="teacher-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.com" autoComplete="off" />
        </div>
        {programs.length > 1 ? (
          <div className="space-y-1.5">
            <Label htmlFor="teacher-program">Program they join</Label>
            <Select id="teacher-program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        ) : programs[0] ? (
          <p className="text-xs text-gray-500">They join <b>{programs[0].name}</b>.</p>
        ) : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving} disabledReason={saving ? undefined : missing ?? undefined}>
            {saving ? "Sending…" : "Send invitation"}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/teacher/teachers">Back to Teachers</Link>
          </Button>
        </div>
      </form>
    </Card>
  );
}
