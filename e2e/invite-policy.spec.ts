import { expect, test, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { fillByLabelText, loginAs } from "./helpers/auth";
import { openDb } from "./helpers/db";
import { E2E, e2eMailbox } from "./helpers/env";

/**
 * Student invitation policy (2026-10-22): one open invitation per student until it expires, the
 * student gets an email with the activation link, and consent (also for minors) is accepting the
 * Terms of Use at activation; a parent's authorization no longer blocks it.
 */
const mailDir = process.env.E2E_MAIL_DIR;
const otherStudentEmail = process.env.E2E_REPORT_STUDENT_EMAIL || "student1@sat.com";

function sql<T>(query: string, ...args: unknown[]): T {
  const db = openDb();
  try {
    return db.prepare(query).get(...args) as T;
  } finally {
    db.close();
  }
}

function cleanup(email: string) {
  const db = openDb();
  try {
    const user = db.prepare("select id from User where email = ?").get(email) as { id: string } | undefined;
    if (user) {
      db.prepare("delete from ProgramEnrollment where studentId = ?").run(user.id);
      db.prepare("delete from AuditLog where userId = ?").run(user.id);
      db.prepare("delete from User where id = ?").run(user.id);
    }
    db.prepare("delete from InviteToken where email = ?").run(email);
  } finally {
    db.close();
  }
}

async function invite(page: Page, student: { name: string; email: string }, birthDate: string, parentEmail?: string) {
  await page.goto("/teacher/students/invite");
  await expect(page.getByRole("heading", { name: "Invite Student" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Invite" })).toBeEnabled({ timeout: 15_000 }).catch(() => undefined);
  await fillByLabelText(page, "Name", student.name);
  await fillByLabelText(page, "Email", student.email);
  await page.locator('input[type="date"]').nth(1).fill(birthDate);
  if (parentEmail) await fillByLabelText(page, "Parent email", parentEmail);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/students/invite") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Create Invite" }).click(),
  ]);
  return { status: res.status(), body: (await res.json()) as { inviteUrl?: string; error?: string; code?: string; expiresAt?: string } };
}

function relative(url: string) {
  const u = new URL(url, "http://x");
  return `${u.pathname}${u.search}`;
}

test.describe.serial("Student invitation policy", () => {
  const minor = e2eMailbox("student");
  const revoked = e2eMailbox("student");
  const ctx: { url?: string } = {};

  test.beforeAll(() => {
    cleanup(minor.email);
    cleanup(revoked.email);
  });
  test.afterAll(() => {
    cleanup(minor.email);
    cleanup(revoked.email);
  });

  test("a minor is invited without a parent; the email has the link; a second invitation is refused", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await page.goto("/teacher/students/invite");
    await expect(page.getByText("Parent / guardian (optional)")).toBeVisible();
    await expect(page.getByText("Require parent authorization")).toHaveCount(0);

    const first = await invite(page, minor, "2010-03-15");
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    await expect(page.getByText("Invite created")).toBeVisible();
    ctx.url = relative(first.body.inviteUrl!);
    const row = sql<{ isMinor: number; parentConsentRequired: number; parentEmail: string | null }>(
      "select isMinor, parentConsentRequired, parentEmail from InviteToken where email = ?",
      minor.email,
    );
    expect(row).toEqual({ isMinor: 1, parentConsentRequired: 0, parentEmail: null });

    if (mailDir) {
      const mails = readdirSync(mailDir)
        .filter((f) => f.endsWith(".eml"))
        .map((f) => readFileSync(path.join(mailDir, f), "latin1").replace(/=\r\n/g, ""));
      const mail = mails.find((m) => m.includes(minor.email));
      expect(mail, "invitation email for the student").toBeTruthy();
      expect(mail).toContain("/auth/activate?token=");
    }

    const second = await invite(page, minor, "2010-03-15");
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("INVITE_ALREADY_OPEN");
    expect(second.body.expiresAt).toBeTruthy();
    await expect(page.getByText(/already has an invitation/)).toBeVisible();
    expect(sql<{ n: number }>("select count(*) n from InviteToken where email = ?", minor.email).n).toBe(1);
  });

  test("a parent email that belongs to a student account is refused", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    const res = await invite(page, revoked, "2009-05-25", otherStudentEmail);
    expect(res.status).toBe(400);
    await expect(page.getByText(/already belongs to another kind of account/)).toBeVisible();
    expect(sql<{ n: number }>("select count(*) n from InviteToken where email = ?", revoked.email).n).toBe(0);
  });

  test("the minor activates by accepting the Terms; without them it is refused", async ({ page }) => {
    await page.goto(ctx.url!);
    await expect(page.getByRole("heading", { name: new RegExp(`Welcome, ${minor.name}`) })).toBeVisible();
    await expect(page.getByText(/You are under 18/)).toBeVisible();
    await expect(page.getByText(/needs to authorize/)).toHaveCount(0);
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill(E2E.studentPassword + "Aa1!");
    await passwords.nth(1).fill(E2E.studentPassword + "Aa1!");
    await expect(page.getByRole("button", { name: "Finish setup" })).toBeDisabled();

    const token = new URL(ctx.url!, "http://x").searchParams.get("token");
    const refused = await page.request.post("/api/auth/activate", { data: { token, password: E2E.studentPassword + "Aa1!" } });
    expect(refused.status()).toBe(400);
    expect((await refused.json()).error).toMatch(/accept the Terms/);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    const user = sql<{ termsVersion: string; termsAcceptedAt: string | null }>(
      "select termsVersion, termsAcceptedAt from User where email = ?",
      minor.email,
    );
    expect(user.termsVersion).toBe("2026-10-22");
    expect(user.termsAcceptedAt).toBeTruthy();

    // The used link no longer works.
    await page.goto(ctx.url!);
    await expect(page.getByText(/doesn't work or has expired/)).toBeVisible();
  });

  test("a revoked invitation stops working and frees the slot", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    const first = await invite(page, revoked, "2009-05-25");
    expect(first.status).toBe(200);
    const db = openDb();
    try {
      db.prepare("update InviteToken set revokedAt = ? where email = ?").run(new Date().toISOString().replace("Z", "+00:00"), revoked.email);
    } finally {
      db.close();
    }
    await page.goto(relative(first.body.inviteUrl!));
    await expect(page.getByText(/doesn't work or has expired/)).toBeVisible();
    const again = await invite(page, revoked, "2009-05-25");
    expect(again.status, JSON.stringify(again.body)).toBe(200);
  });
});
