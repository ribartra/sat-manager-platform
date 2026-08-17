import { test, expect } from "@playwright/test";
import { loginAs, expectPortal } from "./helpers/auth";
import { E2E } from "./helpers/env";

test.describe("Auth — login por rol", () => {
  test("teacher entra al portal docente", async ({ page }) => {
    await loginAs(page, E2E.teacherEmail, E2E.teacherPassword);
    await expectPortal(page, "teacher");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("admin aterriza en portal operativo /teacher", async ({ page }) => {
    await loginAs(page, E2E.adminEmail, E2E.adminPassword);
    await expectPortal(page, "admin");
  });

  test("credenciales inválidas muestran error", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(E2E.teacherEmail);
    await page.locator('input[type="password"]').fill("wrong-password");
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
