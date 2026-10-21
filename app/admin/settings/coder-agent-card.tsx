"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/sat/alert";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import type { CoderAgentSummary } from "@/lib/coder-agent-settings";

/**
 * Admin → Settings → Coding agent: where "Report a problem" reports are sent (empty URL = off), the
 * token sent to it, and the callback token it uses on /api/agent/issue-reports/[id] (shown once).
 * Contract: docs/coder-agent-api.md.
 */
export function CoderAgentCard({ summary, callbackBase }: { summary: CoderAgentSummary; callbackBase: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(summary.url ?? "");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newCallbackToken, setNewCallbackToken] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    try {
      await apiFetch("/api/admin/settings/coder-agent", { method: "PUT", json: { url, token } });
      setToken("");
      notify.success(url.trim() ? "Coding agent saved. New reports will be sent to it." : "Coding agent turned off.");
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function rotate() {
    setRotating(true);
    try {
      const data = await apiFetch<{ token: string }>("/api/admin/settings/coder-agent", { method: "POST", json: { action: "rotate-callback-token" } });
      setNewCallbackToken(data.token);
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setRotating(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Coding agent</h2>
      </div>
      <div className="grid gap-4 px-4 py-4">
        <div className="grid gap-1 text-xs text-muted-foreground">
          <p>
            Status:{" "}
            <span className={summary.enabled ? "font-medium text-green-700" : "font-medium text-amber-700"}>
              {summary.enabled ? "On — new problem reports are sent to the agent" : "Off (no URL)"}
            </span>
          </p>
          <p>
            Each “Report a problem” is sent to this address (with the screenshot and the selected elements). The agent can then
            say it took the report or mark it as fixed; reports can still be resolved from Admin → Reports.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="coder-agent-url">Agent URL (leave empty to turn it off)</Label>
            <Input id="coder-agent-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://agent.example.com/issue-reports" autoComplete="off" />
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="coder-agent-token">
              Token sent to the agent{" "}
              {summary.tokenConfigured ? <span className="text-muted-foreground">(on file, last 4: {summary.tokenLast4} — leave blank to keep it)</span> : null}
            </Label>
            <Input id="coder-agent-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Optional bearer token" autoComplete="off" />
          </div>
        </div>
        <div>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>

        <div className="grid gap-2 border-t border-border pt-4 text-sm">
          <p className="font-medium text-foreground">Callback from the agent</p>
          <ul className="grid gap-1 text-xs text-muted-foreground">
            <li>Address: <code className="break-all">POST {callbackBase}/&lt;report id&gt;</code></li>
            <li>Header: <code>Authorization: Bearer &lt;callback token&gt;</code></li>
            <li>Body: <code>{'{ "status": "IN_PROGRESS" | "RESOLVED" | "NOTE", "message": "…", "ref": "commit or PR link" }'}</code></li>
            <li>RESOLVED marks the report fixed and tells the person who reported it. Details: docs/coder-agent-api.md.</li>
          </ul>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            Callback token:{" "}
            {summary.callbackTokenConfigured
              ? `set${summary.callbackTokenUpdatedAt ? ` (created ${new Date(summary.callbackTokenUpdatedAt).toLocaleString()})` : ""}`
              : "not created yet — the agent cannot report back"}
          </p>
          {newCallbackToken ? (
            <Alert tone="warning" title="Copy this token now — it is not shown again">
              <code className="block break-all rounded bg-white px-2 py-1 text-xs">{newCallbackToken}</code>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => void navigator.clipboard?.writeText(newCallbackToken).then(() => notify.success("Token copied."))}
              >
                Copy token
              </Button>
            </Alert>
          ) : null}
          <div>
            <Button type="button" variant="secondary" onClick={rotate} disabled={rotating}>
              {rotating ? "Creating…" : summary.callbackTokenConfigured ? "Replace callback token" : "Create callback token"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
