# Coding agent API — "Report a problem"

Users report problems from any screen (components/sat/issue-reporter.tsx). Each report is saved
(`IssueReport`), emailed to `ISSUE_REPORT_EMAIL`, and — when a coding agent is set up — sent to it.
The agent reports back to the app, and can mark the report as fixed ("levantado").
Reports can also be resolved by an admin in **Admin → Reports**.

Configuration: **Admin → Settings → Coding agent** (env fallback `CODER_AGENT_URL`,
`CODER_AGENT_TOKEN`, `CODER_AGENT_CALLBACK_TOKEN`). **An empty URL turns the agent off.**

## 1. App → agent (outbound)

`POST <agent URL>` for every new report (and when an admin clicks "Send to coding agent").

Headers:

```
Content-Type: application/json
X-Event: issue_report.created
Authorization: Bearer <token sent to the agent>     # only when a token is set
```

Body:

```json
{
  "event": "issue_report.created",
  "sentAt": "2026-10-21T10:00:00.000Z",
  "report": {
    "id": "cm…",
    "category": "PROBLEM | CONFUSING | SUGGESTION | PRAISE",
    "comment": "What the user wrote",
    "status": "OPEN",
    "url": "https://satsol.org/student/tests?view=all",
    "pageTitle": "…",
    "viewport": "1440x900",
    "userAgent": "…",
    "createdAt": "…",
    "user": { "id": "…", "name": "…", "email": "…", "role": "STUDENT" },
    "target": {
      "kind": "element | area | page",
      "context": "Nearest heading (the block)",
      "element": { "selector": "…", "tag": "h2", "id": "…", "classes": ["…"], "attributes": { "data-…": "…" },
                   "text": "…", "html": "<h2 …>…</h2>", "ancestors": ["div.card", "main"], "rect": { "x": 0, "y": 0, "width": 0, "height": 0 } },
      "area": { "x": 0, "y": 0, "width": 0, "height": 0 },
      "columns": ["Table column headers inside a dragged area"],
      "inside": [{ "selector": "…", "tag": "td", "classes": ["…"], "text": "…" }],
      "devicePixelRatio": 1,
      "scroll": { "x": 0, "y": 0 },
      "errors": ["Recent JS errors on the page"]
    },
    "resolution": null,
    "agentTicketId": null
  },
  "screenshot": { "contentType": "image/jpeg", "base64": "…" },
  "links": { "admin": "https://satsol.org/admin/reports/<id>" },
  "callback": { "url": "https://satsol.org/api/agent/issue-reports/<id>", "auth": "Bearer <callback token from Admin → Settings → Coding agent>" }
}
```

Answer any 2xx. Optionally answer JSON `{ "ticketId": "…" }` — it is stored and shown in Admin.
Timeout: 15 s. A non-2xx or timeout is recorded on the report (Admin can resend); the report is never lost.

## 2. Agent → app (callback)

Create the callback token in Admin → Settings → Coding agent (shown once; only its hash is stored).

### Read a report

```bash
curl -H "Authorization: Bearer $SAT_AGENT_TOKEN" https://satsol.org/api/agent/issue-reports/<id>
```

Returns the same `report` / `screenshot` / `links` / `callback` object as above.

### Update a report

```bash
# The agent took it
curl -X POST -H "Authorization: Bearer $SAT_AGENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS","message":"Looking into the chart component","ticketId":"AGENT-42"}' \
  https://satsol.org/api/agent/issue-reports/<id>

# Fixed ("levantado")
curl -X POST -H "Authorization: Bearer $SAT_AGENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"RESOLVED","message":"Chart now uses the latest Test","ref":"https://github.com/org/repo/pull/123"}' \
  https://satsol.org/api/agent/issue-reports/<id>
```

| status        | Effect |
|---------------|--------|
| `IN_PROGRESS` | Report → In progress; timeline event. |
| `RESOLVED`    | Report → Resolved, **resolved by AGENT**, `message` = fix note, `ref` = commit/PR link; the reporter gets an in-app notification and `ISSUE_REPORT_EMAIL` gets an email. An admin can reopen it. |
| `NOTE`        | Timeline event only. |

Optional fields: `message` (≤ 4000), `ref` (≤ 1000), `ticketId` (≤ 200).

Responses: `200 { ok, id, status, resolvedBySource, resolvedAt }` · `400` bad status ·
`401` wrong token · `404` unknown report · `429` more than 60 calls/min · `503` no callback token set.
