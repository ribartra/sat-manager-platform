import { expect, request as playwrightRequest, test, type Page } from "@playwright/test";
import http from "http";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { loginAs } from "./helpers/auth";
import { openDb } from "./helpers/db";
import { E2E } from "./helpers/env";

/**
 * "Report a problem" (components/sat/issue-reporter.tsx): pick an element / drag an area / whole screen,
 * send, and check the stored report (selector, classes, HTML, screenshot), the email (when E2E_MAIL_DIR
 * points at a local SMTP catcher) and Admin → Reports.
 */
const studentEmail = process.env.E2E_REPORT_STUDENT_EMAIL || "student1@sat.com";
const studentPassword = process.env.E2E_REPORT_STUDENT_PASSWORD || E2E.studentPassword;
const mailDir = process.env.E2E_MAIL_DIR;

type Row = { id: string; category: string; comment: string; target: string; size: number | null; status: string; emailSentAt: string | null };

function report(id: string): Row {
  const db = openDb();
  try {
    return db.prepare("select id, category, comment, target, length(screenshot) size, status, emailSentAt from IssueReport where id = ?").get(id) as Row;
  } finally {
    db.close();
  }
}

async function send(page: Page, comment: string, category?: string) {
  const dialog = page.getByRole("dialog", { name: "Report a problem" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("img", { name: "Screenshot that will be sent" })).toBeVisible();
  await dialog.getByRole("textbox").fill(comment);
  if (category) await dialog.getByRole("radio", { name: category }).click();
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/issue-reports") && r.request().method() === "POST"),
    dialog.getByRole("button", { name: "Send report" }).click(),
  ]);
  expect(res.status()).toBe(201);
  await expect(page.getByText("Thanks — your report was sent.").last()).toBeVisible();
  return ((await res.json()) as { id: string; emailed: boolean; sentToAgent: boolean });
}

function mailFor(comment: string) {
  if (!mailDir) return null;
  for (const f of readdirSync(mailDir).filter((n) => n.endsWith(".eml"))) {
    const raw = readFileSync(path.join(mailDir, f), "latin1");
    const body = raw.replace(/=\r\n/g, "");
    if (body.includes(comment)) return raw;
  }
  return null;
}

test.describe("Report a problem", () => {
  test("student reports one element; the page does not react to the click", async ({ page }) => {
    await loginAs(page, studentEmail, studentPassword);
    await page.goto("/student");
    const url = page.url();
    await page.getByRole("button", { name: "Report a problem" }).click();
    await expect(page.getByText(/Click the part of the screen with the problem/)).toBeVisible();

    const card = page.locator("main a h2", { hasText: /^Math$/ }).first();
    await card.hover();
    await card.click();
    expect(page.url()).toBe(url); // the card link was not followed

    const comment = `E2E element report ${Date.now()}`;
    const { id, emailed, sentToAgent } = await send(page, comment, "Confusing");
    expect(sentToAgent).toBe(false); // no coding agent URL set up yet
    const row = report(id);
    expect(row.category).toBe("CONFUSING");
    expect(row.size ?? 0).toBeGreaterThan(10_000);
    const target = JSON.parse(row.target);
    expect(target.kind).toBe("element");
    expect(target.element.selector).toBeTruthy();
    expect(target.element.tag).toBe("h2");
    expect(target.element.html).toContain("Math");
    expect(target.element.ancestors.length).toBeGreaterThan(0);

    if (mailDir) {
      expect(emailed).toBe(true);
      await expect.poll(() => mailFor(comment) !== null, { timeout: 15_000 }).toBe(true);
      const mail = mailFor(comment)!;
      expect(mail).toContain("admin@nordmetric.com");
      expect(mail).toMatch(/Subject: =\?UTF-8\?Q\?=5BSAT_report=5D_Confusing|Subject: \[SAT report\] Confusing/);
      expect(mail).toContain('filename=screenshot.jpg');
      expect(mail).toContain('filename=report.json');
    }
  });

  test("teacher drags over a table column and reports the whole screen", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await page.goto("/teacher/history");
    const th = page.locator("table thead th").nth(1);
    await expect(th).toBeVisible();
    const box = (await th.boundingBox())!;
    await page.getByRole("button", { name: "Report a problem" }).click();
    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 120, { steps: 6 });
    await page.mouse.move(box.x + box.width - 4, box.y + 160, { steps: 6 });
    await page.mouse.up();
    const area = await send(page, `E2E area report ${Date.now()}`);
    const t = JSON.parse(report(area.id).target);
    expect(t.kind).toBe("area");
    expect(t.columns.length).toBeGreaterThan(0);
    expect(t.inside.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Report a problem" }).click();
    await page.getByRole("button", { name: "Whole screen" }).click();
    const whole = await send(page, `E2E page report ${Date.now()}`, "Suggestion");
    const p = report(whole.id);
    expect(JSON.parse(p.target).kind).toBe("page");
    expect(p.category).toBe("SUGGESTION");
  });

  test("Esc cancels; students cannot read admin report routes", async ({ page }) => {
    await loginAs(page, studentEmail, studentPassword);
    await page.goto("/student");
    await page.getByRole("button", { name: "Report a problem" }).click();
    await expect(page.getByText(/Click the part of the screen/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/Click the part of the screen/)).toBeHidden();

    const db = openDb();
    const any = db.prepare("select id from IssueReport order by createdAt desc limit 1").get() as { id: string };
    db.close();
    expect((await page.request.get(`/api/admin/issue-reports/${any.id}/screenshot`)).status()).toBe(403);
    expect((await page.request.patch(`/api/admin/issue-reports/${any.id}`, { data: { status: "RESOLVED" } })).status()).toBe(403);
  });

  test("admin sees the report, its screenshot, and resolves it", async ({ page }) => {
    const db = openDb();
    const latest = db.prepare("select id, comment from IssueReport where status = 'OPEN' order by createdAt desc limit 1").get() as { id: string; comment: string };
    db.close();
    await loginAs(page, E2E.adminEmail, E2E.adminPassword);
    await page.goto("/admin/reports");
    await page.getByText(latest.comment).first().waitFor();
    await page.goto(`/admin/reports/${latest.id}`);
    const img = page.getByRole("img", { name: /What the user saw/ });
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(300);
    await expect(page.getByRole("button", { name: "Send to coding agent" })).toBeDisabled();
    await expect(page.getByText("Set the coding agent URL in Admin → Settings").first()).toBeAttached();
    await page.getByRole("button", { name: "Mark fixed" }).click();
    await page.getByLabel(/What was done/).fill("Fixed by hand");
    await page.getByRole("button", { name: "Mark fixed" }).last().click();
    await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
    const row = openDb().prepare("select status, resolvedBySource, resolutionNote from IssueReport where id = ?").get(latest.id) as Record<string, string>;
    expect(row).toEqual({ status: "RESOLVED", resolvedBySource: "ADMIN", resolutionNote: "Fixed by hand" });
  });
});

test.describe("Report a problem → coding agent", () => {
  const received: { headers: http.IncomingHttpHeaders; body: { event: string; report: { id: string; target: { kind: string } }; screenshot: { base64: string } | null; callback: { url: string } } }[] = [];
  let server: http.Server;
  const port = Number(process.env.E2E_AGENT_PORT || 4555);

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        received.push({ headers: req.headers, body: JSON.parse(data) });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ticketId: `AGENT-${received.length}` }));
      });
    });
    await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  });
  test.afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("report goes to the agent; the agent takes it and marks it fixed; admin can reopen", async ({ browser, baseURL }) => {
    const admin = await browser.newPage();
    await loginAs(admin, E2E.adminEmail, E2E.adminPassword);
    const put = await admin.request.put("/api/admin/settings/coder-agent", { data: { url: `http://127.0.0.1:${port}/hook`, token: "agent-outbound-1234" } });
    expect(put.status()).toBe(200);
    const rotated = await admin.request.post("/api/admin/settings/coder-agent", { data: { action: "rotate-callback-token" } });
    const { token } = (await rotated.json()) as { token: string };
    expect(token).toMatch(/^sat_agent_/);

    const student = await browser.newPage();
    await loginAs(student, studentEmail, studentPassword);
    await student.goto("/student");
    await student.getByRole("button", { name: "Report a problem" }).click();
    await student.getByRole("button", { name: "Whole screen" }).click();
    const comment = `E2E agent report ${Date.now()}`;
    const { id, sentToAgent } = await send(student, comment);
    expect(sentToAgent).toBe(true);
    const hit = received.find((r) => r.body.report.id === id)!;
    expect(hit.headers.authorization).toBe("Bearer agent-outbound-1234");
    expect(hit.headers["x-event"]).toBe("issue_report.created");
    expect(hit.body.report.target.kind).toBe("page");
    expect(hit.body.screenshot?.base64.length ?? 0).toBeGreaterThan(10_000);
    expect(hit.body.callback.url).toContain(`/api/agent/issue-reports/${id}`);
    expect((openDb().prepare("select agentTicketId from IssueReport where id = ?").get(id) as { agentTicketId: string }).agentTicketId).toMatch(/^AGENT-/);

    // The agent calls back without any session.
    const agent = await playwrightRequest.newContext({ baseURL });
    const url = `/api/agent/issue-reports/${id}`;
    expect((await agent.post(url, { headers: { Authorization: "Bearer wrong" }, data: { status: "RESOLVED" } })).status()).toBe(401);
    const auth = { Authorization: `Bearer ${token}` };
    const got = await agent.get(url, { headers: auth });
    expect(got.status()).toBe(200);
    expect(((await got.json()) as { report: { comment: string } }).report.comment).toBe(comment);
    expect((await agent.post(url, { headers: auth, data: { status: "BOGUS" } })).status()).toBe(400);
    const taken = await agent.post(url, { headers: auth, data: { status: "IN_PROGRESS", message: "Looking into it" } });
    expect(((await taken.json()) as { status: string }).status).toBe("IN_PROGRESS");
    const fixed = await agent.post(url, { headers: auth, data: { status: "RESOLVED", message: "Chart fixed", ref: "https://github.com/org/repo/pull/1" } });
    expect(fixed.status()).toBe(200);
    const row = openDb().prepare("select status, resolvedBySource, resolutionNote, resolutionRef, userId from IssueReport where id = ?").get(id) as Record<string, string>;
    expect(row).toMatchObject({ status: "RESOLVED", resolvedBySource: "AGENT", resolutionNote: "Chart fixed", resolutionRef: "https://github.com/org/repo/pull/1" });
    const note = openDb().prepare("select title, body from Notification where userId = ? order by createdAt desc limit 1").get(row.userId) as { title: string; body: string };
    expect(note.title).toBe("Your report was fixed");
    expect(note.body).toContain("Chart fixed");
    if (mailDir) await expect.poll(() => mailFor("Chart fixed") !== null, { timeout: 15_000 }).toBe(true);
    await agent.dispose();

    await admin.goto(`/admin/reports/${id}`);
    await expect(admin.getByText("Fixed by the AI coding agent")).toBeVisible();
    await expect(admin.getByText("Coding agent took it")).toBeVisible();
    await expect(admin.getByRole("link", { name: "https://github.com/org/repo/pull/1" }).first()).toBeVisible();
    await admin.getByRole("button", { name: "Reopen" }).click();
    await expect(admin.getByRole("button", { name: "Mark fixed" })).toBeVisible();
    expect((openDb().prepare("select status, resolvedBySource from IssueReport where id = ?").get(id) as Record<string, string | null>)).toEqual({ status: "OPEN", resolvedBySource: null });

    // Settings page shows it on; turning the URL off stops sending.
    await admin.goto("/admin/settings");
    await expect(admin.getByText("On — new problem reports are sent to the agent")).toBeVisible();
    await admin.request.put("/api/admin/settings/coder-agent", { data: { url: "" } });
    await admin.goto("/admin/settings");
    await expect(admin.getByText("Off (no URL)")).toBeVisible();
  });
});
