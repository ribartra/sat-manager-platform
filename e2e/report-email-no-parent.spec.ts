import { expect, test, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { loginAs } from "./helpers/auth";
import { openDb } from "./helpers/db";
import { E2E, e2eMailbox } from "./helpers/env";

/**
 * Students without a parent: the Parents view lists them; the report dialog sends the PDF to a typed
 * address, shows "Report sent" and offers to link that address as the parent (Assign parent / Skip /
 * "Don't ask again for this student").
 */
const mailDir = process.env.E2E_MAIL_DIR;
const studentA = { id: process.env.E2E_NOPARENT_STUDENT_A || "e2e-student-a", name: process.env.E2E_NOPARENT_STUDENT_A_NAME || "Ana Prueba" };
const studentB = { id: process.env.E2E_NOPARENT_STUDENT_B || "e2e-student-b", name: process.env.E2E_NOPARENT_STUDENT_B_NAME || "Bruno Prueba" };
const parentA = e2eMailbox("parent");
const addressB = e2eMailbox("parent");

function run(sql: string, ...args: unknown[]) {
  const db = openDb();
  try {
    return db.prepare(sql).run(...args);
  } finally {
    db.close();
  }
}
function get<T>(sql: string, ...args: unknown[]): T {
  const db = openDb();
  try {
    return db.prepare(sql).get(...args) as T;
  } finally {
    db.close();
  }
}

function reset() {
  for (const s of [studentA, studentB]) {
    run("delete from ParentStudent where studentId = ?", s.id);
    run("delete from ParentLinkPromptDismissal where studentId = ?", s.id);
  }
  for (const email of [parentA.email, addressB.email]) {
    const user = get<{ id: string } | undefined>("select id from User where email = ?", email);
    if (user) {
      run("delete from ParentStudent where parentId = ?", user.id);
      run("delete from User where id = ?", user.id);
    }
  }
}

async function sendTo(page: Page, studentId: string, email: string) {
  await page.goto(`/teacher/students/${studentId}`);
  await page.getByRole("button", { name: "Generate Report" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("No parent linked. Send to:")).toBeVisible();
  await dialog.getByLabel("Email address for the report").fill(email);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/reports/students/${studentId}/email`) && r.request().method() === "POST"),
    dialog.getByRole("button", { name: "Send PDF" }).click(),
  ]);
  expect(res.status(), await res.text()).toBe(200);
  await expect(dialog.getByText(`Report sent to ${email}.`)).toBeVisible();
  return dialog;
}

test.describe.serial("Report email for students without a parent", () => {
  test.beforeAll(reset);
  test.afterAll(reset);

  test("Parents lists the students without a parent", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await page.goto("/teacher/parents");
    const card = page.locator("div").filter({ has: page.getByRole("heading", { name: /Students without a parent or guardian/ }) }).last();
    await expect(card.getByRole("link", { name: studentA.name })).toBeVisible();
    await card.locator("li").filter({ hasText: studentA.name }).getByRole("button", { name: "Add parent" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add Parent" })).toBeVisible();
  });

  test("send to an address, then assign that address as the parent", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    const dialog = await sendTo(page, studentA.id, parentA.email);

    if (mailDir) {
      const mail = readdirSync(mailDir)
        .filter((f) => f.endsWith(".eml"))
        .map((f) => readFileSync(path.join(mailDir, f), "latin1"))
        .find((m) => m.includes(parentA.email));
      expect(mail, "report email").toBeTruthy();
      expect(mail).toMatch(/application\/pdf/);
    }

    await expect(dialog.getByText(/has no parent linked\. Link this person/)).toBeVisible();
    await expect(dialog.getByLabel("Parent email")).toHaveValue(parentA.email);
    await expect(dialog.getByRole("button", { name: "Assign parent" })).toBeDisabled();
    await dialog.getByLabel("Parent name").fill(parentA.name);
    await dialog.getByRole("button", { name: "Assign parent" }).click();
    await expect(page.getByText("Parent linked", { exact: true }).first()).toBeVisible();
    const link = get<{ n: number }>(
      "select count(*) n from ParentStudent ps join User u on u.id = ps.parentId where ps.studentId = ? and u.email = ? and u.role = 'PARENT'",
      studentA.id,
      parentA.email,
    );
    expect(link.n).toBe(1);

    // Next time the dialog offers the linked parent, and Parents no longer lists the student.
    await page.goto(`/teacher/students/${studentA.id}`);
    await page.getByRole("button", { name: "Generate Report" }).first().click();
    await expect(page.getByRole("dialog").getByText("Email to parents")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(parentA.email)).toBeVisible();
    await page.goto("/teacher/parents");
    await expect(page.locator("li").filter({ hasText: studentA.name }).getByRole("button", { name: "Add parent" })).toHaveCount(0);
  });

  test("Skip with \"Don't ask again\" stops the offer for that student", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    let dialog = await sendTo(page, studentB.id, addressB.email);
    await dialog.getByLabel("Don't ask again for this student").check();
    await dialog.getByRole("button", { name: "Skip" }).click();
    await expect(dialog.getByText(/Link this person/)).toHaveCount(0);
    await expect.poll(() => get<{ n: number }>("select count(*) n from ParentLinkPromptDismissal where studentId = ?", studentB.id).n).toBe(1);

    dialog = await sendTo(page, studentB.id, addressB.email);
    await expect(dialog.getByText(/Link this person/)).toHaveCount(0);
    expect(get<{ n: number }>("select count(*) n from ParentStudent where studentId = ?", studentB.id).n).toBe(0);
  });
});
