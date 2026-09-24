import { expect, test } from "@playwright/test";
import { expectPortal, loginAs } from "./helpers/auth";
import { expectAreaTabs } from "./helpers/area-tabs";
import { E2E, e2eMailbox, uniqueTag } from "./helpers/env";
import {
  cleanupE2eUsers,
  createApprovedStudent,
  enrollStudentInProgram,
  findPublishedFullPracticeTest,
  openDb,
} from "./helpers/db";

test.describe("FPT assign visibility", () => {
  const tag = uniqueTag();
  const studentBox = e2eMailbox("student", tag);
  let studentId = "";
  let examName = "";

  test.beforeAll(() => {
    cleanupE2eUsers();
    studentId = createApprovedStudent({
      email: studentBox.email,
      name: studentBox.name,
      password: E2E.studentPassword,
    });
    enrollStudentInProgram(studentId);
    const exam = findPublishedFullPracticeTest();
    if (!exam) throw new Error("No PUBLISHED Full Practice Test in DB — seed content required");
    examName = exam.name;

    const db = openDb();
    try {
      db.prepare(`DELETE FROM FullPracticeTestAnswer WHERE attemptId IN (
        SELECT id FROM FullPracticeTestAttempt WHERE assignmentId IN (
          SELECT id FROM FullPracticeTestAssignment WHERE studentId = ? AND testId = ?
        )
      )`).run(studentId, exam.id);
      db.prepare(`DELETE FROM FullPracticeTestAttempt WHERE assignmentId IN (
        SELECT id FROM FullPracticeTestAssignment WHERE studentId = ? AND testId = ?
      )`).run(studentId, exam.id);
      db.prepare(`DELETE FROM FullPracticeTestAssignment WHERE studentId = ? AND testId = ?`).run(
        studentId,
        exam.id
      );
    } finally {
      db.close();
    }
  });

  test.afterAll(() => {
    cleanupE2eUsers();
  });

  test("Assign FPT → student Home FPT tab and Exams list show it", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await expectPortal(page, "teacher");

    await page.goto(`/teacher/students/${studentId}/assign-exam`);
    await expect(page.getByRole("heading", { name: "Assign Exam" })).toBeVisible();

    const row = page.locator("label").filter({ hasText: examName }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /Assign Exam/ }).click();
    await expect(page.getByText(/Assigned successfully/i)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(new RegExp(`/teacher/students/${studentId}\\?area=mocks`), {
      timeout: 15_000,
    });
    await expect(page.getByText(examName).first()).toBeVisible({ timeout: 20_000 });

    await page.context().clearCookies();
    await loginAs(page, studentBox.email, E2E.studentPassword);
    await expectPortal(page, "student");

    await page.goto("/student");
    await expectAreaTabs(page, { basePath: "/student" });
    await expect(page.getByText(/active Full Practice Test/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assigned Practice Sets" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assigned Exams" })).toHaveCount(0);

    await page.goto("/student?area=mocks");
    await expect(page.getByRole("heading", { name: "Assigned Exams" })).toBeVisible();
    await expect(page.getByText(examName).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /Start/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assigned Practice Sets" })).toHaveCount(0);

    await page.goto("/student/full-tests");
    await expect(page.getByRole("heading", { name: "Exams" })).toBeVisible();
    await expect(page.getByText(examName).first()).toBeVisible();
    await expect(page.getByText("No Exams assigned.")).toHaveCount(0);
  });
});
