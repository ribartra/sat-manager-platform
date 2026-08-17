import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 20_000 });
}

export async function logoutViaClear(page: Page) {
  await page.context().clearCookies();
}

export async function expectPortal(page: Page, role: "teacher" | "student" | "parent" | "admin") {
  const path =
    role === "teacher" || role === "admin"
      ? /\/teacher(\/|$)/
      : role === "parent"
        ? /\/parent(\/|$)/
        : /\/student(\/|$)/;
  await expect(page).toHaveURL(path, { timeout: 20_000 });
}

/** Fill an Input that sits in a div with a sibling label (no htmlFor). */
export async function fillByLabelText(page: Page, label: string, value: string) {
  const input = page.locator(`div:has(> label:text-is("${label}")) input`).first();
  await input.fill(value);
}
