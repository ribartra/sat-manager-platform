// Lucía's whole student experience: Home, Practice, the set player and its tools, results, a second
// try (improvement), a Test module, History, Pending and notifications.
const L = require("./lib.cjs");
const D = require("./db.cjs");
const { ACCOUNTS: A } = require("./config.cjs");
const SET_CHECK = "Algebra - Linear Equations in One Variable - EASY";
const SET_PLAIN = "Algebra - Linear Equations in Two Variables - EASY";
const SET_READING = "Information and Ideas - Command of Evidence - EASY";

async function play(page, assignment) {
  await L.go(page, `/student/practice/assignment/${assignment}?start=1`);
  await page.waitForTimeout(1500);
}
async function submitPractice(page, shotName) {
  await page.getByRole("button", { name: /^Submit$/ }).click();
  await page.getByRole("dialog").waitFor();
  if (shotName) await L.shot(page, shotName);
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await page.waitForURL(/\/student\/results\//, { timeout: 120000 });
  await L.settle(page, 1200);
}
L.run(async () => {
  const page = await L.open();
  await L.login(page, A.lucia);
  const asg = (name) => D.assignmentId(A.lucia.email, name);
  await L.shot(page, "student-home");
  await L.go(page, "/student/practice?area=math");
  await L.shot(page, "student-practice-new", "full");
  await L.go(page, `/student/practice/assignment/${asg(SET_CHECK)}`);
  await L.shot(page, "student-practice-intro");

  // Try 1 (answers checked one by one): a first, weak try.
  const key = D.answerKey(SET_CHECK);
  await play(page, asg(SET_CHECK));
  await L.shot(page, "player-question");
  for (let i = 0; i < key.length; i++) {
    await L.answer(page, key[i], i % 3 === 0);
    if (i === 0) await L.shot(page, "player-answer-selected");
    await L.check(page);
    if (i === 1) {
      await L.soft("reference", async () => {
        await page.getByRole("button", { name: "Reference" }).click(); await page.waitForTimeout(600);
        await L.shot(page, "player-reference"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
      });
    }
    await L.nextOrReview(page, i === key.length - 1);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
  await L.shot(page, "player-review");
  await L.soft("navigator", async () => {
    await page.getByRole("button", { name: /^Question \d+ of \d+/ }).click(); await page.waitForTimeout(400);
    await L.shot(page, "player-navigator");
    await page.getByRole("button", { name: "Close question navigator" }).click();
  });
  await submitPractice(page, "player-submit-confirm");

  // Second set (answers at the end), one question left blank.
  const key2 = D.answerKey(SET_PLAIN);
  await play(page, asg(SET_PLAIN));
  for (let i = 0; i < key2.length; i++) {
    if (i !== 2) await L.answer(page, key2[i], i % 4 !== 1);
    await L.nextOrReview(page, i === key2.length - 1);
    await page.waitForTimeout(250);
  }
  await submitPractice(page, "player-submit-confirm-blank");

  // Reading set: mark for review, personal note, eliminate; then Save & exit (stays in progress).
  const key3 = D.answerKey(SET_READING);
  await play(page, asg(SET_READING));
  await L.answer(page, key3[0], true);
  await page.getByRole("button", { name: "Mark for review" }).last().click();
  await page.getByText("Personal note").first().click().catch(() => {});
  await page.getByPlaceholder("A note just for you").fill("Revisar la evidencia del segundo párrafo.");
  await page.waitForTimeout(500);
  await L.shot(page, "player-mark-note");
  await L.nextOrReview(page, false); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Eliminate" }).first().click(); await page.waitForTimeout(300);
  await L.shot(page, "player-eliminate");
  await page.getByRole("button", { name: "Eliminate" }).first().click();
  await page.getByText("Save & exit", { exact: true }).first().click();
  await page.waitForURL((u) => !u.search.includes("start=1"), { timeout: 120000 });
  await L.settle(page, 800);

  // Try 2 of the first set, mostly right: feedback screens and the improvement.
  await L.go(page, `/student/practice/assignment/${asg(SET_CHECK)}`);
  await L.shot(page, "student-practice-intro-retry");
  await play(page, asg(SET_CHECK));
  for (let i = 0; i < key.length; i++) {
    await L.answer(page, key[i], i % 5 !== 3);
    await L.check(page);
    await page.waitForTimeout(400);
    if (i === 0) await L.shot(page, "player-check-feedback");
    if (i === 3) await L.shot(page, "player-check-incorrect");
    await L.nextOrReview(page, i === key.length - 1);
    await page.waitForTimeout(250);
  }
  await submitPractice(page);
  await L.shot(page, "student-results-top");
  await L.shot(page, "student-results", "full");
  await L.go(page, "/student/practice?area=math");
  await L.shot(page, "student-practice", "full");

  // Test 1, module Reading & Writing 1.
  const test1 = D.testAssignmentId(A.lucia.email, 1);
  await L.go(page, "/student/tests");
  await L.shot(page, "student-tests", "full");
  await L.go(page, `/student/tests/${test1}?module=rw1`);
  await L.shot(page, "student-test-intro", "full");
  await page.getByRole("link", { name: /Start module|Continue module/ }).click();
  await page.waitForURL(/start=1/, { timeout: 120000 });
  await page.waitForTimeout(2000);
  await L.shot(page, "test-player");
  const totalT = await L.totalQuestions(page);
  for (let i = 0; i < totalT; i++) {
    const n = await L.choices(page).count();
    if (n) await L.choices(page).nth(i % n).click(); else await page.getByPlaceholder("Type your answer").fill("2");
    await L.nextOrReview(page, i === totalT - 1);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(500);
  await L.shot(page, "test-review");
  await page.getByRole("button", { name: /^Submit module$/ }).click();
  await page.getByText("Submit module?").waitFor();
  await L.shot(page, "test-submit-module");
  await page.getByRole("button", { name: /^Submit module$/ }).last().click();
  await page.waitForURL(/\/student\/tests\/results\//, { timeout: 120000 });
  await L.settle(page, 1500);
  await L.shot(page, "test-results-module", "full");
  await L.go(page, "/student/tests");
  await L.shot(page, "student-tests-after", "full");

  await L.go(page, "/student/history");
  await L.shot(page, "student-history", "full");
  await L.go(page, "/student/pending");
  await L.shot(page, "student-pending", "full");
  await L.go(page, "/student");
  await L.shot(page, "student-home-active");
  await page.getByRole("button", { name: /Notifications/ }).first().click().catch(() => {});
  await page.waitForTimeout(700);
  await L.shot(page, "common-notifications");
  console.log("lucia ok");
});
