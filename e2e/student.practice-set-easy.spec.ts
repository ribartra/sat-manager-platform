import { test, expect } from "@playwright/test";
import { loginAs, expectPortal, fillByLabelText } from "./helpers/auth";
import {
  cleanupE2eUsers,
  findPromotedEasyPracticeSet,
  findUserByEmail,
  setUserPassword,
} from "./helpers/db";
import { E2E, e2eMailbox } from "./helpers/env";
import { completePracticeSetPlayer } from "./helpers/practice";

/**
 * Flujo incremental (área usuario):
 * 1. Tutor invita alumno + padre
 * 2. Alumno activa y crea contraseña
 * 3. Tutor ve al alumno
 * 4. Tutor asigna Practice Set EASY real (ingesta)
 * 5. Alumno lo resuelve
 * 6. Tutor ve el progreso
 */
test.describe.serial("Incremental — Tutor → Alumno → Practice Set EASY", () => {
  const student = e2eMailbox("student");
  const parent = e2eMailbox("parent", student.tag);
  const ctx: {
    inviteUrl?: string;
    studentId?: string;
    practiceSet?: ReturnType<typeof findPromotedEasyPracticeSet>;
  } = {};

  test.beforeAll(() => {
    cleanupE2eUsers();
    expect(findUserByEmail(E2E.teacherEmail), "teacher@sat.com must exist").toBeTruthy();
    ctx.practiceSet = findPromotedEasyPracticeSet({
      maxQuestions: 6,
      preferNameIncludes: process.env.E2E_EASY_PS_HINT || "Circles - EASY",
    });
    expect(ctx.practiceSet.sourcePath).toMatch(/PRACTICE EXERCISES|\.pdf$/i);
  });

  test.afterAll(() => {
    cleanupE2eUsers();
  });

  test("1) Tutor invita alumno y registra padre de familia", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await expectPortal(page, "teacher");

    await page.goto("/teacher/students/invite");
    await expect(page.getByRole("heading", { name: "Invite Student" })).toBeVisible();
    await expect(page.getByText("SAT Core Program")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Invite" })).toBeEnabled();

    await fillByLabelText(page, "Name", student.name);
    await fillByLabelText(page, "Email", student.email);

    await page.getByLabel(/Student is a minor/i).check();
    await expect(page.getByText(/Parent \/ guardian account/i)).toBeVisible();
    const parentBlock = page.locator("div.border-blue-200").first();
    await parentBlock.locator("div").filter({ has: page.locator('label:text-is("Parent name")') }).locator("input").fill(parent.name);
    await parentBlock.locator('input[type="email"]').fill(parent.email);

    const inviteResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/students/invite") && res.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Create Invite" }).click();
    const inviteResponse = await inviteResponsePromise;
    const payload = await inviteResponse.json();
    expect(inviteResponse.ok(), JSON.stringify(payload)).toBeTruthy();
    expect(payload.inviteUrl).toMatch(/\/auth\/activate\?token=/);
    await expect(page.getByText("Invite created")).toBeVisible();

    const href = String(payload.inviteUrl);
    ctx.inviteUrl = href.startsWith("http") ? `${new URL(href).pathname}${new URL(href).search}` : href;
  });

  test("2) Alumno entra, crea su contraseña y accede al portal", async ({ page }) => {
    expect(ctx.inviteUrl).toBeTruthy();

    await page.goto(ctx.inviteUrl!);
    await expect(page.getByRole("heading", { name: new RegExp(`Welcome,\\s*${escapeRegExp(student.name)}`) })).toBeVisible({
      timeout: 20_000,
    });
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill(E2E.studentPassword);
    await passwords.nth(1).fill(E2E.studentPassword);
    await page.getByRole("button", { name: "Activate Account" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

    await loginAs(page, student.email, E2E.studentPassword);
    await expectPortal(page, "student");

    const row = findUserByEmail(student.email);
    expect(row?.role).toBe("STUDENT");
    expect(row?.validationStatus).toBe("APPROVED");
    ctx.studentId = row!.id;

    // Parent was linked at activation — ensure password so tutor/parent flows can use it later.
    const parentRow = findUserByEmail(parent.email);
    expect(parentRow?.role).toBe("PARENT");
    setUserPassword(parent.email, E2E.parentPassword);
  });

  test("3) Tutor ve al estudiante en su lista", async ({ page }) => {
    expect(ctx.studentId).toBeTruthy();

    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await page.goto(`/teacher?q=${encodeURIComponent(student.name)}`);
    await expect(page.getByText(student.name).first()).toBeVisible({ timeout: 20_000 });
    await page.locator(`a[href="/teacher/students/${ctx.studentId}"]`).first().click();
    await expect(page.getByRole("heading", { name: student.name })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(student.email)).toBeVisible();
  });

  test("4) Tutor asigna Practice Set EASY promovido por ingesta", async ({ page }) => {
    expect(ctx.studentId && ctx.practiceSet).toBeTruthy();
    const ps = ctx.practiceSet!;

    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await page.goto(`/teacher/students/${ctx.studentId}/assign`);
    await expect(page.getByText("Select Practice Sets")).toBeVisible({ timeout: 20_000 });

    const searchTerm = ps.name.includes("Circles") ? "Circles - EASY" : ps.name.split(" - ").slice(-2).join(" - ");
    await page.getByPlaceholder("Search...").fill(searchTerm);
    const row = page.locator("label").filter({ hasText: ps.name }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.locator('input[type="checkbox"]').check();

    await page.getByRole("button", { name: /Assign\s*\(/ }).click();
    await expect(page.getByText(/Assigned successfully/i)).toBeVisible({ timeout: 20_000 });
  });

  test("5) Alumno resuelve el Practice Set EASY", async ({ page }) => {
    const ps = ctx.practiceSet!;
    await loginAs(page, student.email, E2E.studentPassword);
    await page.goto("/student/practice-sets");

    const start = page.getByRole("link", { name: /^(Start|Continue)$/ }).first();
    await expect(start).toBeVisible({ timeout: 20_000 });
    await start.click();

    // Next/Submit must be in the player chrome (layout fix).
    await expect(page.getByRole("button", { name: /^Next$|^Submit$/ })).toBeVisible({ timeout: 30_000 });
    await completePracticeSetPlayer(page, ps.questionCount);
  });

  test("6) Tutor ve el progreso del estudiante", async ({ page }) => {
    expect(ctx.studentId).toBeTruthy();
    const ps = ctx.practiceSet!;

    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await page.goto(`/teacher/students/${ctx.studentId}`);
    await expect(page.getByRole("heading", { name: student.name })).toBeVisible();

    // Completed attempt appears (no longer empty state).
    await expect(page.getByText(/No completed attempts yet/i)).toHaveCount(0);
    await expect(
      page.getByText(new RegExp(ps.name.split(" - ")[0] || "Circles|Attempt|Completed|%", "i")).first()
    ).toBeVisible({ timeout: 20_000 });

    // Optional: open report for a progress summary.
    await page.goto(`/teacher/students/${ctx.studentId}/report`);
    await expect(page.getByText(/Completed attempts|Recent Attempts|Average/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
