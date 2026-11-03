// Class work and the teacher's Student view. Builds the Classroom work that 09 also uses (run 10, then 09):
// Lucía answers 10 of 13 of "Linear Inequalities · Medium" in class and starts "Systems of Linear
// Equations · Easy"; the teacher sees the sign-out prompt (Cancel), finishes the class work from Lucía's
// page, assigns Linear Inequalities as Homework (Lucía gets 8 of 13); then the durable Student view and a
// simulated try. Run on a throwaway copy (MANUAL_DB=…/man-shots.db): it creates tries.
const L = require("./lib.cjs");
const D = require("./db.cjs");
const { ACCOUNTS: A, BASE } = require("./config.cjs");

const INEQ = "Algebra - Linear Inequalities - MEDIUM";
const SYSTEMS = "Algebra - Systems of Linear Equations - EASY";

async function assign(page, studentId, setName, context) {
  const res = await page.request.post(BASE + "/api/assignments", {
    data: { studentIds: [studentId], practiceSetIds: [D.setId(setName)], context, feedbackMode: "AFTER_SET", showExplanations: true },
  });
  if (!res.ok()) throw new Error(`assign ${setName} ${context}: ${res.status()} ${await res.text()}`);
}
const assignmentOf = (studentId, setName, context) =>
  D.one("select a.id from Assignment a join PracticeSet p on p.id = a.practiceSetId where a.studentId = ? and p.name = ? and a.context = ?", studentId, setName, context).id;

/** Answers the first `count` questions (`wrong` = indexes answered wrong) and leaves the player open. */
async function answerSome(page, setName, count, wrong = []) {
  const key = D.answerKey(setName);
  for (let i = 0; i < count; i++) {
    await L.answer(page, key[i], !wrong.includes(i));
    await L.nextOrReview(page, i === key.length - 1);
  }
  await page.waitForTimeout(2500); // autosave
}

L.run(async () => {
  const lucia = D.userId(A.lucia.email);
  if (!D.setId(SYSTEMS)) throw new Error(`set not found: ${SYSTEMS}`);
  const teacher = await L.open();
  await L.login(teacher, A.teacher);
  await assign(teacher, lucia, INEQ, "CLASSROOM");
  await assign(teacher, lucia, SYSTEMS, "CLASSROOM");

  // Lucía works in class: 10 of 13 answered on one set, 3 on the other; she leaves both open.
  const student = await L.open();
  await L.login(student, A.lucia);
  await L.go(student, `/student/practice/assignment/${assignmentOf(lucia, INEQ, "CLASSROOM")}?start=1`);
  await answerSome(student, INEQ, 10, [2, 6, 8]);
  await L.go(student, `/student/practice/assignment/${assignmentOf(lucia, SYSTEMS, "CLASSROOM")}?start=1`);
  await answerSome(student, SYSTEMS, 3);
  await L.go(student, "/student");

  // Teacher signs out with class work open: the prompt (Cancel keeps everything).
  await L.go(teacher, "/teacher");
  await teacher.getByRole("button", { name: new RegExp(A.teacher.name) }).first().click();
  await teacher.getByRole("button", { name: "Sign out" }).click();
  await teacher.getByText("Finish class work before signing out?").waitFor();
  await teacher.waitForTimeout(400);
  await L.shot(teacher, "teacher-signout-classroom");
  await teacher.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

  // Finish class work from Lucía's page: the button and its confirmation.
  await L.go(teacher, `/teacher/students/${lucia}?area=math`);
  const finish = teacher.getByRole("button", { name: "Finish class work for this student" });
  await finish.waitFor();
  await L.shot(teacher, "teacher-finish-classroom-button");
  await finish.click();
  await teacher.getByText("Finish class work?").waitFor();
  await teacher.waitForTimeout(400);
  await L.shot(teacher, "teacher-finish-classroom-dialog");
  await teacher.getByRole("dialog").getByRole("button", { name: "Finish class work" }).click();
  await finish.waitFor({ state: "detached", timeout: 30000 });

  // Linear Inequalities assigned as Homework: Lucía answers it all (8 of 13 right) and submits.
  await assign(teacher, lucia, INEQ, "HOMEWORK");
  await L.go(student, `/student/practice/assignment/${assignmentOf(lucia, INEQ, "HOMEWORK")}?start=1`);
  await answerSome(student, INEQ, 13, [1, 4, 7, 10, 12]);
  await student.getByRole("button", { name: /^Submit$/ }).click();
  await student.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await student.waitForURL(/\/student\/results\//, { timeout: 60000 });

  // Student view: Lucía's own pages with the banner, and a simulated try (nothing is saved).
  await L.go(teacher, `/teacher/impersonate/${lucia}`);
  await L.shot(teacher, "teacher-student-view");
  const open = D.one(
    "select a.id from Assignment a where a.studentId = ? and a.status = 'IN_PROGRESS' and a.context = 'HOMEWORK' order by a.createdAt limit 1",
    lucia,
  );
  await L.go(teacher, `/student/practice/assignment/${open.id}`);
  await L.shot(teacher, "teacher-student-view-intro");
  await teacher.getByRole("link", { name: /Continue|Start/ }).first().click();
  await teacher.waitForURL(/start=1/);
  await L.settle(teacher, 1200);
  await L.shot(teacher, "teacher-student-view-simulated");
  await L.go(teacher, "/api/student-view/exit");
  console.log("classroom + student view ok");
});
