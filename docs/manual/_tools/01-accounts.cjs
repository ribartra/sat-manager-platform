// Master teacher invites the teacher; the teacher activates, invites three students (one with a
// parent email); the students activate. Screens: login, master Home/Teachers/invite, activation
// (teacher and student), teacher Home/Students/invite.
const L = require("./lib.cjs");
const { ACCOUNTS: A } = require("./config.cjs");
const field = (page, label) => page.locator(`xpath=//label[starts-with(normalize-space(), "${label}")]/following-sibling::input[1]`).first();
async function activate(page, link, password, shotName) {
  await page.goto(link, { waitUntil: "networkidle", timeout: 300000 });
  await page.waitForTimeout(800);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Type the password again").fill(password);
  if (shotName) await L.shot(page, shotName, "full");
  await page.getByRole("button", { name: /Finish setup|Create account/ }).click();
  await page.waitForURL(/\/login/, { timeout: 120000 });
}
L.run(async () => {
  let page = await L.open();
  await L.login(page, A.master, { capture: "common-login" });
  await L.shot(page, "master-home");
  await L.go(page, "/teacher/teachers");
  await L.shot(page, "master-teachers-list");
  await L.go(page, "/teacher/teachers/invite");
  await page.getByLabel("Name").fill(A.teacher.name);
  await page.getByLabel("Email").fill(A.teacher.email);
  await L.shot(page, "master-teacher-invite-form");
  await page.getByRole("button", { name: /send invitation/i }).click();
  await page.waitForSelector("text=/could not be sent|Invitation sent/", { timeout: 60000 });
  const teacherLink = (await page.locator("span.font-mono").first().innerText()).trim();
  await L.go(page, "/teacher/teachers");
  await L.shot(page, "master-teachers-pending");
  await L.shot(page, "common-sidebar", undefined, { clip: { x: 0, y: 0, width: 200, height: 900 } });
  await page.context().close();

  page = await L.open();
  await activate(page, teacherLink, A.teacher.password, "teacher-activation");
  await page.context().close();

  page = await L.open();
  await L.login(page, A.teacher);
  await L.shot(page, "teacher-home-empty");
  await L.go(page, "/teacher/students");
  await L.shot(page, "teacher-students-empty");
  const links = {};
  for (const key of ["lucia", "mateo", "valentina"]) {
    const st = A[key];
    await L.go(page, "/teacher/students/invite");
    await field(page, "Name").fill(st.name);
    await field(page, "Email").fill(st.email);
    await field(page, "Phone").fill(st.phone);
    await field(page, "Birth date").fill(st.birth);
    if (st.parent) {
      await field(page, "Parent name").fill(st.parent.name);
      await field(page, "Parent email").fill(st.parent.email);
      await field(page, "Parent phone").fill(st.parent.phone);
    }
    if (key === "lucia") await L.shot(page, "teacher-invite-form", "full");
    await page.getByRole("button", { name: "Create Invite" }).click();
    await page.waitForSelector("text=Student activation link:", { timeout: 60000 });
    if (key === "lucia") await L.shot(page, "teacher-invite-created", "full");
    links[key] = (await page.locator("text=/auth\\/activate\\?token=/").first().innerText()).trim();
  }
  await L.go(page, "/teacher/students");
  await L.shot(page, "teacher-students-invitations", "full");
  await page.context().close();

  for (const key of ["lucia", "mateo", "valentina"]) {
    page = await L.open();
    await activate(page, links[key], A[key].password, key === "lucia" ? "student-activation" : null);
    if (key === "lucia") await L.shot(page, "student-login-activated");
    await page.context().close();
  }
  console.log("accounts ok");
});
