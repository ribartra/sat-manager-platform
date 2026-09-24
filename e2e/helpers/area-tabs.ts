import { expect, type Page } from "@playwright/test";

/** Canonical area tabs: Math / Reading / Writing / Full Practice Tests. */
export const AREA_TAB_LABELS = ["Math", "Reading", "Writing", "Full Practice Tests"] as const;
export const AREA_TAB_KEYS = ["math", "reading", "writing", "mocks"] as const;

export async function expectAreaTabs(page: Page, options?: { basePath?: string }) {
  for (const label of AREA_TAB_LABELS) {
    await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
  }

  if (options?.basePath) {
    for (let i = 0; i < AREA_TAB_KEYS.length; i += 1) {
      const key = AREA_TAB_KEYS[i];
      const label = AREA_TAB_LABELS[i];
      const link = page.getByRole("link", { name: label, exact: true });
      await expect(link).toHaveAttribute("href", new RegExp(`[?&]area=${key}(&|$)`));
    }
  }
}

export async function clickAreaTab(page: Page, label: (typeof AREA_TAB_LABELS)[number]) {
  await page.getByRole("link", { name: label, exact: true }).click();
}
