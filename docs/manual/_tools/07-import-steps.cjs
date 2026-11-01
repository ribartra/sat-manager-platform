// "Import with AI" up to the external AI: step 1 filled with the ORIGINAL files (practice set
// Nonlinear Functions HARD; TEST 9: R&W PDF, Math PDF, answer key + explanations) and step 2 with the
// 4 module cards. Step 1 of the Test is submitted, so this creates an import: run it ONLY against a
// throwaway copy (MANUAL_DB=…/man-shots.db for server.sh, ingest.sh and this script), never against
// the man.db the user imports into.
const path = require("path");
const L = require("./lib.cjs");
const D = require("./db.cjs");
const { ACCOUNTS: A, DB, REPO } = require("./config.cjs");
if (path.basename(DB) === "man.db") throw new Error("Run 07 with MANUAL_DB pointing to a throwaway copy (it creates an import).");
const SRC = path.join(REPO, "files_to_load");
const T9 = path.join(SRC, "MOCK EXAMS/TEST 9");
const NLF = path.join(SRC, "PRACTICE EXERCISES/EXERCISES MATH/ADVANCED MATH/NON LINEAR FUNCTIONS");
L.run(async () => {
  const page = await L.open();
  await L.login(page, A.master);

  // Practice Set: opened from the "+ Hard" chip (skill and level pre-filled), files chosen, not submitted.
  const topic = D.one("select id from Topic where name = 'Nonlinear Functions'").id;
  await L.go(page, `/teacher/import?kind=PRACTICE_SET&topic=${topic}&difficulty=HARD`);
  let files = page.locator('input[type="file"]');
  await files.nth(0).setInputFiles(path.join(NLF, "NON LINEAR FUNCTIONS HARD.pdf"));
  await files.nth(1).setInputFiles(path.join(NLF, "ANS NON LINEAR FUNCT HARD .pdf"));
  await L.shot(page, "ai-step1-practice", "full");

  // Test: TEST 9 as the originals come: R&W and Math each in one file with both modules, each
  // section's explanations in its tray, and one answer key for the whole Test.
  await L.go(page, "/teacher/import?kind=FULL_PRACTICE_TEST");
  await page.getByLabel("Test number").fill("9");
  await page.locator("select").last().selectOption(D.one("select id from Source where name like 'Innovator%'").id);
  const tray = (name) => page.locator("fieldset").filter({ has: page.locator("legend", { hasText: new RegExp(`^${name}$`) }) }).locator('input[type="file"]');
  await tray("Reading and Writing").nth(0).setInputFiles(path.join(T9, "READING AND WRITING/TEST 9 RW MOD 1, 2, REV PDF.pdf"));
  await tray("Reading and Writing").nth(1).setInputFiles(path.join(T9, "Test9_RW_Answer_Explanations FINAL.docx"));
  await tray("Math").nth(0).setInputFiles(path.join(T9, "MATH/TEST 9 MATH MOD 1, 2B.pdf"));
  await tray("Math").nth(1).setInputFiles(path.join(T9, "Test9_Math ANS Explanations.docx"));
  await page.getByText("Answer key for the whole Test").locator('xpath=ancestor::div[contains(@class,"border-dashed")][1]').locator('input[type="file"]').setInputFiles(path.join(T9, "Test 9 Ans Key.docx"));
  await L.shot(page, "ai-step1-test", "full");
  await page.getByRole("button", { name: "Continue to step 2" }).click();
  await page.waitForURL(/\/teacher\/import\/[^?/]+$/, { timeout: 180000 });
  await L.settle(page, 1000);
  await L.shot(page, "ai-step2-modules", page.locator("#step-2"));
  // One module's card with its files and its prompt opened (what is pasted into the AI).
  const card = page.locator("section", { hasText: "Reading and Writing, Module 1" });
  await card.getByText("See the prompt").click();
  await page.waitForTimeout(300);
  await L.shot(page, "ai-step2-prompt", card);
  console.log("import steps ok");
});
