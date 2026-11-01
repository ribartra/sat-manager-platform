import { test, expect } from "@playwright/test";
import { loginAs, logoutViaClear, expectPortal, fillByLabelText } from "./helpers/auth";
import {
  cleanupE2eUsers,
  createParentAccessToken,
  findUserByEmail,
  setUserPassword,
} from "./helpers/db";
import { E2E, e2eMailbox } from "./helpers/env";

/**
 * Guion automatizado (área usuario):
 * Teacher invita → Student activa → Teacher asigna → Student practica →
 * Teacher vincula Parent → Parent ve progreso + enlace de reporte.
 */
test.describe.serial("Journey Teacher → Student → Parent", () => {
  const student = e2eMailbox("student");
  const parent = e2eMailbox("parent", student.tag);
  const ctx: {
    inviteUrl?: string;
    studentId?: string;
    parentId?: string;
    teacherId?: string;
  } = {};

  test.beforeAll(() => {
    cleanupE2eUsers();
    const teacher = findUserByEmail(E2E.teacherEmail);
    expect(teacher, "teacher@sat.com must exist in local DB").toBeTruthy();
    ctx.teacherId = teacher!.id;
  });

  test.afterAll(() => {
    cleanupE2eUsers();
  });

  test("1) Teacher invita alumno", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await expectPortal(page, "teacher");

    await page.goto("/teacher/students/invite");
    await expect(page.getByRole("heading", { name: "Invite Student" })).toBeVisible();
    // Wait until program is loaded (enables submit).
    await expect(page.getByText("SAT Core Program")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Invite" })).toBeEnabled();

    await fillByLabelText(page, "Name", student.name);
    await fillByLabelText(page, "Email", student.email);

    const inviteResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/students/invite") && res.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Create Invite" }).click();
    const inviteResponse = await inviteResponsePromise;
    const payload = await inviteResponse.json();
    expect(inviteResponse.ok(), JSON.stringify(payload)).toBeTruthy();
    expect(payload.inviteUrl).toMatch(/\/auth\/activate\?token=/);

    await expect(page.getByText("Invite created")).toBeVisible({ timeout: 10_000 });
    const href = String(payload.inviteUrl);
    ctx.inviteUrl = href.startsWith("http") ? `${new URL(href).pathname}${new URL(href).search}` : href;
  });

  test("2) Student activa y entra", async ({ page }) => {
    expect(ctx.inviteUrl, "inviteUrl from step 1").toBeTruthy();

    await page.goto(ctx.inviteUrl!);
    await expect(
      page.getByRole("heading", { name: new RegExp(`Welcome,\\s*${escapeRegExp(student.name)}`) })
    ).toBeVisible({ timeout: 20_000 });

    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill(E2E.studentPassword);
    await passwords.nth(1).fill(E2E.studentPassword);
    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

    await loginAs(page, student.email, E2E.studentPassword);
    await expectPortal(page, "student");

    const row = findUserByEmail(student.email);
    expect(row?.role).toBe("STUDENT");
    expect(row?.validationStatus).toBe("APPROVED");
    ctx.studentId = row!.id;
  });

  test("3) Teacher asigna Practice Set pequeño", async ({ page }) => {
    expect(ctx.studentId).toBeTruthy();

    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await page.goto(`/teacher/students/${ctx.studentId}/assign`);
    await expect(page.getByText("Select Practice Sets")).toBeVisible({ timeout: 20_000 });

    await page.getByPlaceholder("Search...").fill("Data, Studies & Experiments - EASY");
    const row = page.locator("label").filter({ hasText: "Data, Studies & Experiments - EASY" }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.locator('input[type="checkbox"]').check();

    await page.getByRole("button", { name: /Assign\s*\(/ }).click();
    await expect(page.getByText(/Assigned successfully/i)).toBeVisible({ timeout: 20_000 });
  });

  test("4) Student abre asignación, responde y envía", async ({ page }) => {
    await loginAs(page, student.email, E2E.studentPassword);
    await page.goto("/student/practice-sets");

    const start = page.getByRole("link", { name: /^(Start|Continue)$/ }).first();
    await expect(start).toBeVisible({ timeout: 20_000 });
    await start.click();
    await expect(page.getByText(/Question\s+1\s+of\s+2/i)).toBeVisible({ timeout: 30_000 });

    // Q1
    await page.locator("button").filter({ has: page.locator("span.rounded-full", { hasText: /^A$/ }) }).click();
    await page.getByRole("button", { name: /^Next/ }).click();
    await expect(page.getByText(/Question\s+2\s+of\s+2/i)).toBeVisible({ timeout: 15_000 });

    // Q2 + submit (confirm dialog)
    await page.locator("button").filter({ has: page.locator("span.rounded-full", { hasText: /^A$/ }) }).click();
    page.once("dialog", (dialog) => dialog.accept());
    const submitResponse = page.waitForResponse(
      (res) => res.url().includes("/submit") && res.request().method() === "POST",
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: /^Submit$/ }).click();
    const response = await submitResponse;
    expect(response.ok(), `submit status ${response.status()}`).toBeTruthy();

    await expect(page).toHaveURL(/\/student\/results\//, { timeout: 30_000 });
  });

  test("5) Teacher vincula padre y comparte reporte", async ({ page }) => {
    expect(ctx.studentId).toBeTruthy();

    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await page.goto("/teacher/parents");
    await page.getByRole("button", { name: /Add Parent/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add Parent" })).toBeVisible();
    await dialog.getByPlaceholder("Parent name").fill(parent.name);
    await dialog.getByPlaceholder("parent@example.com").fill(parent.email);

    await dialog.getByPlaceholder("Search student...").fill(student.name);
    await dialog.locator("label").filter({ hasText: student.name }).locator('input[type="checkbox"]').check();

    await dialog.getByRole("button", { name: "Save Parent" }).click();
    await expect(page.getByText(parent.email)).toBeVisible({ timeout: 20_000 });

    const parentRow = findUserByEmail(parent.email);
    expect(parentRow?.role).toBe("PARENT");
    ctx.parentId = parentRow!.id;
    setUserPassword(parent.email, E2E.parentPassword);

    const row = page.locator("tr").filter({ hasText: parent.email });
    await row.getByRole("button", { name: /Reports/i }).click();
    await expect(page.getByRole("heading", { name: /Share progress with parent/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /Share report by email/i }).click();
    await expect(page.getByText(/Link created|Report link emailed/i)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("6) Parent portal + enlace temporal de reporte", async ({ page }) => {
    expect(ctx.studentId && ctx.parentId && ctx.teacherId).toBeTruthy();

    await loginAs(page, parent.email, E2E.parentPassword);
    await expectPortal(page, "parent");
    await expect(page.getByRole("heading", { name: /Your student's progress/i })).toBeVisible();
    await expect(page.getByText(student.name)).toBeVisible();

    await logoutViaClear(page);

    const access = createParentAccessToken({
      studentId: ctx.studentId!,
      parentId: ctx.parentId!,
      createdById: ctx.teacherId!,
      areas: "mathematics,reading,writing",
    });
    await page.goto(access.urlPath);
    await expect(page.getByRole("heading", { name: student.name })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Progress report/i)).toBeVisible();
    await expect(page.getByText(/You can open this report until/i)).toBeVisible();
  });
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
