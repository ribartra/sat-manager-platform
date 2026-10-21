import { expect, test, type Page } from "@playwright/test";
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
  return ((await res.json()) as { id: string; emailed: boolean });
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
    const { id, emailed } = await send(page, comment, "Confusing");
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
    await page.getByRole("button", { name: "Mark resolved" }).click();
    await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
    expect(report(latest.id).status).toBe("RESOLVED");
  });
});
