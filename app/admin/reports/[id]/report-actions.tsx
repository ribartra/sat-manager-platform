"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

/** Admin → Reports detail actions: mark fixed (with note/link), reopen, send to the coding agent, resend email. */
export function ReportActions({ id, status, emailed, agentEnabled, sentToAgent }: { id: string; status: string; emailed: boolean; agentEnabled: boolean; sentToAgent: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"status" | "email" | "agent" | null>(null);
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");
  const [ref, setRef] = useState("");

  async function run(kind: "status" | "email" | "agent", call: () => Promise<unknown>, done: string) {
    setBusy(kind);
    try {
      await call();
      notify.success(done);
      setResolving(false);
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  const resolve = () =>
    run("status", () => apiFetch(`/api/admin/issue-reports/${id}`, { method: "PATCH", json: { status: "RESOLVED", note, ref } }), "Marked as fixed. The person who reported it was notified.");
  const reopen = () => run("status", () => apiFetch(`/api/admin/issue-reports/${id}`, { method: "PATCH", json: { status: "OPEN" } }), "Reopened.");
  const email = () => run("email", () => apiFetch(`/api/admin/issue-reports/${id}`, { method: "POST", json: { action: "email" } }), "Email sent.");
  const agent = () => run("agent", () => apiFetch(`/api/admin/issue-reports/${id}`, { method: "POST", json: { action: "agent" } }), "Sent to the coding agent.");

  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={agent}
          disabled={busy !== null || !agentEnabled}
          disabledReason={!agentEnabled ? "Set the coding agent URL in Admin → Settings" : undefined}
        >
          {busy === "agent" ? "Sending…" : sentToAgent ? "Send to coding agent again" : "Send to coding agent"}
        </Button>
        <Button type="button" variant="secondary" onClick={email} disabled={busy !== null}>
          {busy === "email" ? "Sending…" : emailed ? "Send email again" : "Send email"}
        </Button>
        {status === "RESOLVED" ? (
          <Button type="button" variant="secondary" onClick={reopen} disabled={busy !== null}>Reopen</Button>
        ) : (
          <Button type="button" onClick={() => setResolving((v) => !v)} disabled={busy !== null} aria-expanded={resolving}>
            Mark fixed
          </Button>
        )}
      </div>
      {resolving ? (
        <div className="grid w-full max-w-md gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <label className="grid gap-1 text-xs font-medium text-gray-700">
            What was done (optional, the reporter sees it)
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="E.g. The chart now shows the latest Test." />
          </label>
          <label className="grid gap-1 text-xs font-medium text-gray-700">
            Commit or PR link (optional)
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="https://github.com/…/commit/…" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setResolving(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={resolve} disabled={busy !== null}>{busy === "status" ? "Saving…" : "Mark fixed"}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
