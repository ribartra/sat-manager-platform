import { expect, type Page } from "@playwright/test";

/** Answer every MC with option A and submit the Practice Set player. */
export async function completePracticeSetPlayer(page: Page, questionCount: number) {
  await expect(page.getByText(new RegExp(`Question\\s+1\\s+of\\s+${questionCount}`, "i"))).toBeVisible({
    timeout: 30_000,
  });
  // Bottom chrome must stay visible after the player viewport fix.
  await expect(page.getByRole("button", { name: /^Next$|^Submit$/ })).toBeVisible();

  for (let index = 1; index <= questionCount; index += 1) {
    await expect(page.getByText(new RegExp(`Question\\s+${index}\\s+of\\s+${questionCount}`, "i"))).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("button").filter({ has: page.locator("span.rounded-full", { hasText: /^A$/ }) }).click();

    if (index < questionCount) {
      const next = page.getByRole("button", { name: /^Next/ });
      await expect(next).toBeVisible();
      await next.click();
    }
  }

  page.once("dialog", (dialog) => dialog.accept());
  const submitResponse = page.waitForResponse(
    (res) => res.url().includes("/submit") && res.request().method() === "POST",
    { timeout: 30_000 }
  );
  const submit = page.getByRole("button", { name: /^Submit$/ });
  await expect(submit).toBeVisible();
  await submit.click();
  const response = await submitResponse;
  expect(response.ok(), `submit status ${response.status()}`).toBeTruthy();
  await expect(page).toHaveURL(/\/student\/results\//, { timeout: 30_000 });
}
