// Screenshots of Classroom / Homework (pendiente-p2.md). Run on a throwaway copy (MANUAL_DB=…/man-shots.db)
// after the work below exists for Lucía (the E2E check creates it): "Linear Inequalities · Medium" done in
// class (10 of 13 answered), then assigned as Homework (62%); "Systems of Linear Equations · Easy" in class.
const L = require("./lib.cjs");
const D = require("./db.cjs");
const { ACCOUNTS: A } = require("./config.cjs");

L.run(async () => {
  const lucia = D.userId(A.lucia.email);
  const classroomTry = D.one(
    `select t.id from Attempt t join Assignment a on a.id = t.assignmentId join PracticeSet p on p.id = a.practiceSetId
     where a.studentId = ? and a.context = 'CLASSROOM' and p.name = 'Algebra - Linear Inequalities - MEDIUM' and t.status = 'SUBMITTED'`,
    lucia,
  )?.id;

  let page = await L.open();
  await L.login(page, A.teacher);
  await L.go(page, `/teacher/students/${lucia}/assign?area=math`);
  // The Classroom · Homework tabs above the sets, and the summary showing the chosen one.
  await page.getByRole("tab", { name: "Classroom" }).click();
  await page.waitForTimeout(400);
  await L.shot(page, "teacher-assign-context");
  await L.go(page, `/teacher/students/${lucia}?area=math`);
  await L.shot(page, "teacher-student-context");
  await L.go(page, `/teacher/history?student=${lucia}&context=classroom`);
  await L.shot(page, "teacher-history-context");
  await L.close();

  page = await L.open();
  await L.login(page, A.lucia);
  await L.go(page, "/student/practice?area=math&context=classroom");
  await page.locator("#recent-attempts details summary").first().click();
  await page.waitForTimeout(300);
  await L.shot(page, "student-practice-context", "full");
  if (classroomTry) {
    await L.go(page, `/student/results/${classroomTry}`);
    await L.shot(page, "student-classroom-result");
  }
});
