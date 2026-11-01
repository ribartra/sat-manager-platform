// Retakes the screenshots changed by the review with Soledad (2026-11-01): tests named after their
// source ("Innovator Test 1") with source tags, the Completed chip in Home › Practice, the report's
// Period, the % in black and the reference sheet as the original sheet.
// Run on a throwaway copy (MANUAL_DB=…/man-shots.db) with the tests renamed: it opens a practice set.
const L = require("./lib.cjs");
const D = require("./db.cjs");
const { ACCOUNTS: A } = require("./config.cjs");

L.run(async () => {
  // Student: Home, Practice, Tests, reference sheet.
  let page = await L.open();
  await L.login(page, A.lucia);
  await L.shot(page, "student-home-active");
  await L.go(page, "/student/practice?area=math");
  await L.shot(page, "student-practice", "full");
  await L.go(page, "/student/tests");
  await L.shot(page, "student-tests-after", "full");
  const lucia = D.userId(A.lucia.email);
  const mathTodo = D.one(
    `select a.id from Assignment a join PracticeSet p on p.id = a.practiceSetId join Topic t on t.id = p.topicId join Domain d on d.id = t.domainId
     where a.studentId = ? and d.practiceArea = 'MATH' and a.locked = 0 and not exists (select 1 from Attempt x where x.assignmentId = a.id and x.status = 'SUBMITTED')
     order by a.createdAt limit 1`,
    lucia,
  );
  await L.soft("reference", async () => {
    await L.go(page, `/student/practice/assignment/${mathTodo.id}?start=1`);
    await page.getByRole("button", { name: "Reference" }).click();
    await page.locator('img[src="/reference-sheet.svg"]').waitFor();
    await page.waitForTimeout(600);
    await L.shot(page, "player-reference");
  });
  await L.close();

  // A student who hasn't started her Test yet: the Tests list.
  page = await L.open();
  await L.login(page, A.valentina);
  await L.go(page, "/student/tests");
  await L.shot(page, "student-tests", "full");
  await L.close();

  // Teacher: Home, Tests, report with its Period, assigning a Test.
  page = await L.open();
  await L.login(page, A.teacher);
  await L.shot(page, "teacher-home");
  await L.go(page, "/teacher/tests");
  await L.shot(page, "teacher-tests", "full");
  await L.go(page, `/teacher/students/${lucia}`);
  await L.soft("report", async () => {
    await page.getByRole("button", { name: /Generate Report/ }).click();
    await page.getByRole("dialog").waitFor();
    await page.locator("#report-period").selectOption("90d");
    await page.waitForTimeout(800);
    await page.getByText(/Generating report|Updating preview/).first().waitFor({ state: "detached", timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await L.shot(page, "teacher-report-dialog");
    await page.keyboard.press("Escape");
  });
  await L.soft("assign test", async () => {
    await L.go(page, `/teacher/students/${D.userId(A.mateo.email)}/assign?area=tests`);
    const acc = page.locator("details").filter({ has: page.locator("summary span.font-bold").getByText("TEST 1", { exact: true }) }).first();
    await acc.locator("summary").click();
    await page.waitForTimeout(300);
    await acc.locator("label").first().click();
    await L.shot(page, "teacher-assign-test-selected", "full");
  });
  await L.close();

  // Master teacher: the Tests catalogue with the empty TEST 9 (AI import guide).
  page = await L.open();
  await L.login(page, A.master);
  await L.go(page, "/teacher/tests");
  await L.shot(page, "ai-tests-list", "full");
  await L.soft("empty test", async () => {
    const test9 = page.locator("details", { has: page.locator("summary", { hasText: /^\s*TEST 9(?!\d)/ }) });
    await test9.locator("summary").click();
    await page.waitForTimeout(400);
    await L.shot(page, "ai-tests-gap", test9);
  });
});
