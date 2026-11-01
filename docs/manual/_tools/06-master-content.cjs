// Master teacher: the empty slot for "Import with AI", the set, Test and question editors, a teacher's page.
const L = require("./lib.cjs");
const D = require("./db.cjs");
const { ACCOUNTS: A, MISSING } = require("./config.cjs");
L.run(async () => {
  const page = await L.open();
  await L.login(page, A.master);
  await L.go(page, "/teacher/practice-sets?area=math");
  await L.shot(page, "ai-practice-with-gap", "full");
  await L.soft("gap chip", async () => {
    const skill = page.locator("details", { hasText: "Nonlinear Functions" }).first();
    await L.shot(page, "ai-gap-chip", skill);
  });
  // The import steps themselves (ai-step1-*, ai-step2-modules) are taken by 07-import-steps.cjs.
  await L.go(page, "/teacher/tests");
  await L.shot(page, "ai-tests-list", "full");
  const set = D.setId("Algebra - Linear Equations in One Variable - EASY");
  await L.go(page, `/teacher/practice-sets/${set}?edit`);
  await L.shot(page, "maint-set-editor", "full");
  await L.go(page, `/teacher/practice-sets/${set}`);
  await L.soft("options", async () => {
    await page.getByRole("button", { name: /Options/ }).first().click(); await page.waitForTimeout(500);
    await L.shot(page, "maint-set-options"); await page.keyboard.press("Escape");
  });
  const question = D.one(`select questionId id from PracticeSetQuestion where practiceSetId = ? order by "order" limit 1`, set).id;
  await L.go(page, `/teacher/questions/${question}/edit`);
  await L.shot(page, "maint-question-editor", "full");
  const test1 = D.one("select id from FullPracticeTest where number = 1 and status = 'PUBLISHED' order by createdAt limit 1").id;
  await L.go(page, `/teacher/tests/${test1}?edit`);
  await L.shot(page, "maint-test-editor");
  await L.go(page, "/teacher/questions?area=math&status=all");
  await L.shot(page, "maint-question-bank");
  const diego = D.userId(A.teacher.email);
  await L.go(page, `/teacher/teachers/${diego}`);
  await L.shot(page, "master-teacher-detail");
  await L.go(page, "/teacher/teachers");
  await L.shot(page, "master-teachers-list");
  console.log("master ok", MISSING.practiceSet);
});
