// The teacher assigns practice sets and Tests (Assign view), edits one assignment's dates (Mateo's
// becomes overdue) and shows the view once things are assigned.
const L = require("./lib.cjs");
const D = require("./db.cjs");
const { ACCOUNTS: A } = require("./config.cjs");
const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

async function openSkill(page, pick) {
  const skill = pick.skill
    ? page.locator("details").filter({ has: page.locator("summary p.font-semibold", { hasText: new RegExp(`^${pick.skill}$`) }) }).first()
    : page.locator("details").nth(pick.index ?? 0);
  if ((await skill.getAttribute("open")) === null) await skill.locator("summary").click();
  await page.waitForTimeout(300);
  return skill;
}
async function setOptions(page, { feedback, explanations, open, due } = {}) {
  if (open) await page.locator("#assign-open").fill(open);
  if (due) await page.locator("#assign-due").fill(due);
  if (feedback) await page.locator("#assign-feedback").selectOption(feedback);
  if (explanations) await page.getByLabel("Show explanations in the player").check();
}
async function assignPractice(page, student, area, picks, opts = {}, shots = {}) {
  await L.go(page, `/teacher/students/${D.userId(A[student].email)}/assign?area=${area}`);
  // Step 3: Classroom or Homework (the sets show once one is chosen).
  await page.getByRole("tab", { name: opts.context ?? "Homework" }).click();
  await page.waitForTimeout(400);
  if (shots.empty) await L.shot(page, shots.empty);
  for (const pick of picks) {
    const skill = await openSkill(page, pick);
    await skill.locator("div.rounded-lg button[aria-pressed]", { hasText: pick.level }).first().click();
  }
  await setOptions(page, opts);
  if (shots.ready) await L.shot(page, shots.ready, "full");
  if (shots.options) await L.shot(page, shots.options, page.locator("aside").first());
  await page.getByRole("button", { name: /^Assign \(\d+\)$/ }).click();
  await page.getByRole("dialog").waitFor();
  if (shots.done) await L.shot(page, shots.done);
}
async function assignTest(page, student, number, opts = {}, shots = {}) {
  await L.go(page, `/teacher/students/${D.userId(A[student].email)}/assign?area=tests`);
  const acc = page.locator("details").filter({ has: page.locator("summary span.font-bold").getByText(`TEST ${number}`, { exact: true }) }).first();
  await acc.locator("summary").click();
  await page.waitForTimeout(300);
  await acc.locator("label").first().click();
  await setOptions(page, opts);
  if (shots.ready) await L.shot(page, shots.ready, "full");
  await page.getByRole("button", { name: /^Assign test/ }).click();
  await page.waitForSelector("text=/Redirecting|assigned/i", { timeout: 60000 });
  await page.waitForTimeout(800);
}
L.run(async () => {
  const page = await L.open();
  await L.login(page, A.teacher);
  await assignPractice(page, "lucia", "math", [{ skill: "Linear Equations in One Variable", level: "Easy" }], { feedback: "IMMEDIATE", explanations: true },
    { empty: "teacher-assign-practice-empty", ready: "teacher-assign-practice-selected", options: "teacher-assign-options", done: "teacher-assign-done" });
  await assignPractice(page, "lucia", "math", [{ skill: "Linear Equations in Two Variables", level: "Easy" }]);
  await assignPractice(page, "lucia", "reading", [{ skill: "Command of Evidence", level: "Easy" }]);
  await assignTest(page, "lucia", 1, {}, { ready: "teacher-assign-test-selected" });
  await assignTest(page, "lucia", 2);
  await assignPractice(page, "mateo", "math", [{ skill: "Linear Functions", level: "Easy" }, { skill: "Linear Functions", level: "Medium" }]);
  await assignTest(page, "mateo", 2);
  await assignPractice(page, "valentina", "writing", [{ index: 0, level: "Easy" }]);
  await assignTest(page, "valentina", 1);

  // Edit the dates of Mateo's MEDIUM set: due two days ago (it shows as overdue).
  const mediumSet = D.setId("Algebra - Linear Functions - MEDIUM");
  await L.go(page, `/teacher/students/${D.userId(A.mateo.email)}/assign?area=math&edit=${mediumSet}`);
  await setOptions(page, { open: day(-4), due: day(-2) });
  await L.shot(page, "teacher-assign-edit");
  await page.getByRole("button", { name: /Save changes/ }).click();
  await page.getByRole("dialog").waitFor();

  // The view after assigning: what Lucía already has is grayed / stamped.
  await L.go(page, `/teacher/students/${D.userId(A.lucia.email)}/assign?area=math`);
  const skill = await openSkill(page, { skill: "Linear Equations in One Variable" });
  await L.shot(page, "teacher-assign-already-assigned", skill);
  console.log("assign ok");
});
