// The teacher's views once there is activity: Home, Students, a student's page (tabs), an attempt
// (invalidate), a Test attempt, Pending, History, the PDF report, Parents, Tests, Practice, the
// Question Bank, notifications, the account menu and the password page.
const L = require("./lib.cjs");
const D = require("./db.cjs");
const { ACCOUNTS: A } = require("./config.cjs");
L.run(async () => {
  const page = await L.open();
  await L.login(page, A.teacher);
  const lucia = D.userId(A.lucia.email);
  const try1 = D.one(`select a.id from Attempt a join PracticeSet p on p.id = a.practiceSetId where a.studentId = ? and p.name = ? and a.attemptNumber = 1`, lucia, "Algebra - Linear Equations in One Variable - EASY").id;
  const testAttempt = D.one("select id from FullPracticeTestAttempt where studentId = ? order by startedAt limit 1", lucia).id;
  await L.shot(page, "teacher-home");
  await L.go(page, "/teacher/students");
  await L.shot(page, "teacher-students", "full");
  for (const area of ["summary", "math", "tests"]) {
    await L.go(page, `/teacher/students/${lucia}?area=${area}`);
    await L.shot(page, `teacher-student-${area}`, "full");
  }
  await L.go(page, `/teacher/students/${lucia}/attempts/${try1}`);
  await L.shot(page, "teacher-attempt");
  await L.soft("invalidate", async () => {
    await page.getByRole("button", { name: /Invalidate attempt/ }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("dialog").locator("select").selectOption({ label: "Connection problem" });
    await page.waitForTimeout(300);
    await L.shot(page, "teacher-invalidate-dialog");
    await page.getByRole("dialog").getByRole("button", { name: "Invalidate attempt" }).click();
    await page.waitForTimeout(1500);
    await L.go(page, `/teacher/students/${lucia}/attempts/${try1}`);
    await L.shot(page, "teacher-attempt-invalidated");
  });
  await L.go(page, `/teacher/students/${lucia}/tests/${testAttempt}`);
  await L.shot(page, "teacher-test-attempt");
  await L.go(page, "/teacher/pending");
  await L.shot(page, "teacher-pending", "full");
  await L.go(page, "/teacher/history?status=all");
  await L.shot(page, "teacher-history", "full");
  await L.go(page, `/teacher/students/${lucia}?area=summary`);
  await L.soft("report", async () => {
    await page.getByRole("button", { name: /Generate Report/ }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByText(/Generating report|Updating preview/).first().waitFor({ state: "detached", timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await L.shot(page, "teacher-report-dialog");
    await page.keyboard.press("Escape");
  });
  await L.go(page, "/teacher/parents");
  await L.shot(page, "teacher-parents", "full");
  await L.soft("share", async () => {
    await page.getByRole("button", { name: /^Reports$/ }).first().click();
    await page.getByRole("dialog").waitFor(); await page.waitForTimeout(500);
    await L.shot(page, "teacher-parents-share"); await page.keyboard.press("Escape");
  });
  await L.go(page, "/teacher/tests");
  await L.shot(page, "teacher-tests", "full");
  const test1 = D.one("select id from FullPracticeTest where number = 1 and status = 'PUBLISHED' order by createdAt limit 1").id;
  await L.go(page, `/teacher/tests/${test1}`);
  await L.shot(page, "teacher-test-page");
  await L.go(page, "/teacher/practice-sets?area=math");
  await L.shot(page, "teacher-practice", "full");
  await L.soft("set menu", async () => {
    const chip = page.locator("button", { hasText: "Easy" }).first();
    await chip.click(); await page.waitForTimeout(500);
    await L.shot(page, "teacher-practice-menu"); await page.keyboard.press("Escape");
  });
  await L.go(page, `/teacher/practice-sets/${D.setId("Algebra - Linear Equations in One Variable - EASY")}`);
  await L.shot(page, "teacher-practice-set");
  await L.go(page, "/teacher/questions?area=math");
  await L.shot(page, "teacher-questions");
  await L.go(page, "/teacher");
  await L.soft("bell", async () => {
    await page.getByRole("button", { name: /Notifications/ }).first().click(); await page.waitForTimeout(700);
    await L.shot(page, "teacher-notifications"); await page.keyboard.press("Escape");
  });
  await L.soft("account", async () => {
    await page.getByRole("button", { name: new RegExp(A.teacher.name) }).first().click(); await page.waitForTimeout(500);
    await L.shot(page, "common-account-menu"); await page.keyboard.press("Escape");
  });
  await L.go(page, "/auth/change-password");
  await L.shot(page, "common-change-password");
  await L.go(page, `/teacher/impersonate/${lucia}`);
  await L.shot(page, "teacher-student-view");
  console.log("teacher ok");
});
