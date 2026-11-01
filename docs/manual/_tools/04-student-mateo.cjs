// Mateo: a set left half-done (Save & exit) and an overdue set; plus the public screens
// (forgot password) and the student's Report a problem.
const L = require("./lib.cjs");
const D = require("./db.cjs");
const { ACCOUNTS: A } = require("./config.cjs");
const SET = "Algebra - Linear Functions - EASY";
L.run(async () => {
  let page = await L.open();
  await L.go(page, "/auth/forgot-password");
  await page.getByLabel("Email").fill(A.mateo.email).catch(() => {});
  await L.shot(page, "common-forgot-password");
  await page.context().close();

  page = await L.open();
  await L.login(page, A.mateo);
  const key = D.answerKey(SET);
  await L.go(page, `/student/practice/assignment/${D.assignmentId(A.mateo.email, SET)}?start=1`);
  await page.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) { await L.answer(page, key[i], i !== 2); await L.nextOrReview(page, false); await page.waitForTimeout(250); }
  await page.getByText("Save & exit", { exact: true }).first().click();
  await page.waitForURL((u) => !u.search.includes("start=1"), { timeout: 120000 });
  await L.settle(page, 800);
  await L.shot(page, "student-after-save-exit");
  await L.go(page, "/student");
  await L.shot(page, "student-home-overdue");
  await L.go(page, "/student/pending");
  await L.shot(page, "student-pending-overdue", "full");
  await L.soft("report a problem", async () => {
    await page.getByRole("button", { name: /Report a problem/ }).first().click();
    await page.waitForTimeout(600);
    await L.shot(page, "common-report-select");
    await page.mouse.click(700, 250);
    await page.getByRole("dialog").waitFor({ timeout: 15000 });
    // Wait until the captured screenshot is shown inside the dialog.
    await page.waitForFunction(() => { const img = document.querySelector('[role="dialog"] img'); return !img || (img.complete && img.naturalWidth > 0); }, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    // The in-page screenshot preview does not render in a headless browser: capture the dialog from
    // the question down (comment, type, buttons).
    const box = await page.getByRole("dialog").boundingBox();
    const from = await page.getByText("What do you see? What did you expect?").boundingBox();
    await L.shot(page, "common-report-dialog", undefined, { clip: { x: box.x, y: from.y - 12, width: box.width, height: box.y + box.height - from.y + 12 } });
    await page.keyboard.press("Escape");
  });
  console.log("mateo ok");
});
