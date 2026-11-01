import { test, expect } from "@playwright/test";
import {
  cleanupE2eUsers,
  countAuditActions,
  createUsedInviteWithPendingParentConsent,
  findActiveProgramId,
  findUserByEmail,
} from "./helpers/db";
import { E2E, e2eMailbox } from "./helpers/env";

/**
 * Smoke: parent consent remains valid after student activation (usedAt set),
 * parent report shows explicit failure messages, and audit events are written.
 */
test.describe("Parent links + audit smoke", () => {
  const student = e2eMailbox("minor-student");
  const parent = e2eMailbox("minor-parent", student.tag);
  let consentUrlPath = "";
  const sinceIso = new Date(Date.now() - 60_000).toISOString();

  test.beforeAll(() => {
    cleanupE2eUsers();
    const teacher = findUserByEmail(E2E.teacherEmail);
    expect(teacher).toBeTruthy();
    const programId = findActiveProgramId();
    expect(programId, "need an active program").toBeTruthy();

    const invite = createUsedInviteWithPendingParentConsent({
      studentEmail: student.email,
      studentName: student.name,
      parentEmail: parent.email,
      parentName: parent.name,
      invitedById: teacher!.id,
      programId: programId!,
    });
    consentUrlPath = invite.consentUrlPath;
  });

  test.afterAll(() => {
    cleanupE2eUsers();
  });

  test("parent consent link works even when invite.usedAt is set", async ({ page }) => {
    await page.goto(consentUrlPath);
    await expect(page.getByText(/Invalid or expired/i)).toHaveCount(0);
    await expect(page.getByText(new RegExp(student.name))).toBeVisible({ timeout: 15_000 });

    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill(E2E.parentPassword);
    await passwords.nth(1).fill(E2E.parentPassword);
    await page.getByRole("button", { name: /^Approve$/i }).click();
    await expect(page.getByText(/can now finish setting up/i)).toBeVisible({ timeout: 20_000 });

    const audits = countAuditActions(
      ["PARENT_CONSENT_VIEWED", "PARENT_CONSENT_RECORDED", "PARENT_CONSENT_VIEW_FAILED"],
      sinceIso
    );
    expect((audits.PARENT_CONSENT_VIEWED ?? 0) + (audits.PARENT_CONSENT_RECORDED ?? 0)).toBeGreaterThan(0);
    expect(audits.PARENT_CONSENT_VIEW_FAILED ?? 0).toBe(0);
  });

  test("parent report page explains missing / invalid tokens", async ({ page }) => {
    await page.goto("/parent/access");
    await expect(page.getByText(/We couldn't open this report/i)).toBeVisible();
    await expect(page.getByText(/This link is incomplete/i)).toBeVisible();

    await page.goto("/parent/access?token=not-a-real-token");
    await expect(page.getByText(/We couldn't open this report/i)).toBeVisible();
    await expect(page.getByText(/This link doesn't work/i)).toBeVisible();

    const audits = countAuditActions(["PARENT_REPORT_OPEN_FAILED"], sinceIso);
    expect(audits.PARENT_REPORT_OPEN_FAILED ?? 0).toBeGreaterThanOrEqual(2);
  });
});
