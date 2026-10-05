import { expect, test } from "@playwright/test";
import { expectPortal, loginAs } from "./helpers/auth";
import { E2E, e2eMailbox, uniqueTag } from "./helpers/env";
import { cleanupE2eUsers, createApprovedStudent } from "./helpers/db";

test.describe("consideraciones smoke", () => {
  const tag = uniqueTag();
  const studentBox = e2eMailbox("student", tag);

  test.beforeAll(() => {
    cleanupE2eUsers();
    createApprovedStudent({
      email: studentBox.email,
      name: studentBox.name,
      password: E2E.studentPassword,
    });
  });

  test.afterAll(() => {
    cleanupE2eUsers();
  });

  test("Materials stays hidden for teacher and student when flag is off", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await expectPortal(page, "teacher");
    await expect(page.getByRole("link", { name: "Materials" })).toHaveCount(0);
    await page.goto("/teacher/materials");
    await expect(page.getByRole("heading", { name: "Study materials" })).toHaveCount(0);

    await page.context().clearCookies();
    await loginAs(page, studentBox.email, E2E.studentPassword);
    await expectPortal(page, "student");
    await expect(page.getByRole("link", { name: "Materials" })).toHaveCount(0);
    await page.goto("/student/materials");
    await expect(page.getByRole("heading", { name: "Study materials" })).toHaveCount(0);
  });

  test("Practice Set import modal shows dual trays", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await page.goto("/teacher/practice-sets/new");
    await page.getByRole("button", { name: "Import from PDF" }).click();
    await expect(page.getByRole("heading", { name: "Import questions from PDF/DOCX" })).toBeVisible();
    await expect(page.getByText("Answers / Explanations").first()).toBeVisible();
    await expect(page.getByText("Choose file").first()).toBeVisible();
    await expect(page.getByText(/answers with explanations/i).first()).toBeVisible();
  });

  test("Student history does not show practice SAT averages", async ({ page }) => {
    await loginAs(page, studentBox.email, E2E.studentPassword);
    await page.goto("/student/history");
    await expect(page.getByRole("heading", { name: "My history" })).toBeVisible();
    await expect(page.getByText("SAT R&W average")).toHaveCount(0);
    await expect(page.getByText("SAT Math average")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Math", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reading", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Writing", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Full Practice Tests", exact: true })).toBeVisible();
    await expect(page.locator('label:text-is("Section")')).toHaveCount(0);
  });
});
