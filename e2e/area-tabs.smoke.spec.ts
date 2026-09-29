import { expect, test } from "@playwright/test";
import { expectPortal, loginAs } from "./helpers/auth";
import { clickAreaTab, expectAreaTabs } from "./helpers/area-tabs";
import { E2E, e2eMailbox, uniqueTag } from "./helpers/env";
import { cleanupE2eUsers, createApprovedStudent, enrollStudentInProgram } from "./helpers/db";

test.describe("area tabs smoke", () => {
  const tag = uniqueTag();
  const studentBox = e2eMailbox("student", tag);
  let studentId = "";

  test.beforeAll(() => {
    cleanupE2eUsers();
    studentId = createApprovedStudent({
      email: studentBox.email,
      name: studentBox.name,
      password: E2E.studentPassword,
    });
    enrollStudentInProgram(studentId);
  });

  test.afterAll(() => {
    cleanupE2eUsers();
  });

  test("Student History shows 4 tabs and FPT tab is R&W/Math only", async ({ page }) => {
    await loginAs(page, studentBox.email, E2E.studentPassword);
    await expectPortal(page, "student");
    await page.goto("/student/history");
    await expect(page.getByRole("heading", { name: "My History" })).toBeVisible();
    await expectAreaTabs(page, { basePath: "/student/history" });
    await expect(page.locator('label:text-is("Section")')).toHaveCount(0);
    await expect(page.locator('select[name="section"], input[name="section"]')).toHaveCount(0);

    await clickAreaTab(page, "Full Practice Tests");
    await expect(page).toHaveURL(/area=mocks/);
    await expect(page.getByRole("columnheader", { name: "R&W" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Math" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Practice Set" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Practice History" })).toHaveCount(0);
  });

  test("Student page (single view) and Impersonate expose 4 tabs", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await expectPortal(page, "teacher");

    // The former Student Analytics view now lands on the student page (performance section).
    await page.goto(`/teacher/analytics?studentId=${studentId}`);
    await expect(page).toHaveURL(new RegExp(`/teacher/students/${studentId}\\?.*#performance`));
    await expect(page.getByRole("heading", { name: studentBox.name })).toBeVisible();
    await expectAreaTabs(page, { basePath: `/teacher/students/${studentId}` });
    await expect(page.getByRole("heading", { name: "Skill performance by difficulty" })).toBeVisible();
    await clickAreaTab(page, "Full Practice Tests");
    await expect(page).toHaveURL(/area=mocks/);
    await expect(page.getByText("Inactive 5+ Days")).toHaveCount(0);

    await page.goto(`/teacher/students/${studentId}`);
    await expect(page.getByRole("heading", { name: studentBox.name })).toBeVisible();
    await expectAreaTabs(page, { basePath: `/teacher/students/${studentId}` });
    await clickAreaTab(page, "Writing");
    await expect(page).toHaveURL(/area=writing/);
    await expect(page.getByRole("heading", { name: /Active practice sets/ })).toBeVisible();
    await expect(page.getByText(/No completed Writing attempts yet/i)).toBeVisible();
    await clickAreaTab(page, "Full Practice Tests");
    await expect(page).toHaveURL(/area=mocks/);
    await expect(page.getByRole("columnheader", { name: "R&W" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Math" })).toBeVisible();
    await expect(page.getByText("By Skill")).toHaveCount(0);

    await page.goto(`/teacher/impersonate/${studentId}`);
    await expect(page.getByText(/You are viewing as/i)).toBeVisible();
    await expectAreaTabs(page, { basePath: `/teacher/impersonate/${studentId}` });
    await expect(page.getByRole("heading", { name: "Assigned to Student" })).toBeVisible();
    await clickAreaTab(page, "Full Practice Tests");
    await expect(page).toHaveURL(/area=mocks/);
    await expect(page.getByText(/No active Full Practice Tests|Full Practice Test · R&W/i).first()).toBeVisible();
  });

  test("Individual Report link lands on the student page and keeps Practice out of FPT", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await page.goto(`/teacher/students/${studentId}/report`);
    await expect(page).toHaveURL(/#performance/);
    await expect(page.getByRole("link", { name: /PDF report/ })).toBeVisible();
    await clickAreaTab(page, "Full Practice Tests");
    await expect(page).toHaveURL(/area=mocks/);
    await expect(page.getByText("No submitted Full Practice Tests for this student yet.")).toBeVisible();
    await expect(page.getByText("Progress by Skill")).toHaveCount(0);
  });
});
