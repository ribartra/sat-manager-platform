// Playwright helpers for the manual (Brave, 1440x900). Sign-in uses the same NextAuth credentials
// exchange the login form does, inside the browser context.
const path = require("path");
const { chromium } = require(path.join(__dirname, "../../../node_modules/playwright"));
const { BASE, IMG } = require("./config.cjs");

let browser;
async function open() {
  browser ??= await chromium.launch({ executablePath: process.env.MANUAL_BROWSER ?? "/usr/bin/brave-browser", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // The Next.js dev badge is not part of the product: hide it in screenshots.
  await ctx.addInitScript(() => {
    const add = () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); };
    if (document.head) add(); else document.addEventListener("DOMContentLoaded", add);
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  return page;
}
async function close() { if (browser) await browser.close(); browser = undefined; }
async function go(page, p) { await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 300000 }); await page.waitForTimeout(400); }
async function settle(page, ms = 600) { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(ms); }
/** target: undefined = viewport, "full" = whole page, a Locator = that element; opts e.g. { clip }. */
async function shot(page, name, target, opts = {}) {
  const file = path.join(IMG, `${name}.png`);
  if (target && typeof target !== "string") await target.screenshot({ path: file, ...opts });
  else await page.screenshot({ path: file, fullPage: target === "full", timeout: 180000, ...opts });
  console.log("  shot", name);
}
async function login(page, account, { capture } = {}) {
  if (capture) {
    await go(page, "/login");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await shot(page, capture);
  }
  const req = page.context().request;
  const { csrfToken } = await (await req.get(BASE + "/api/auth/csrf")).json();
  const res = await req.post(BASE + "/api/auth/callback/credentials", { form: { csrfToken, email: account.email, password: account.password, callbackUrl: BASE + "/" }, maxRedirects: 0 });
  if (res.status() !== 302) throw new Error("login failed " + res.status());
  const session = await (await req.get(BASE + "/api/auth/session")).json();
  if (!session?.user) throw new Error("no session for " + account.email);
  await go(page, session.user.role === "STUDENT" ? "/student" : session.user.role === "PARENT" ? "/parent" : "/teacher");
}
const soft = async (label, fn) => { try { await fn(); } catch (e) { console.log(`  (skipped ${label}: ${e.message.split("\n")[0].slice(0, 160)})`); } };
const run = (fn) => fn().then(close).catch(async (e) => { console.error("ERROR", e.message.split("\n").slice(0, 6).join("\n")); await close(); process.exit(1); });

// Players
const choices = (page) => page.locator(".font-serif-q button.text-left");
async function answer(page, key, right = true) {
  const n = await choices(page).count();
  const correct = String(key ?? "").split("|")[0].trim();
  if (n) {
    const idx = Math.max(0, "ABCD".indexOf(correct.toUpperCase()));
    await choices(page).nth(right ? idx : (idx + 1) % n).click();
  } else await page.getByPlaceholder("Type your answer").fill(right ? correct || "4" : "999");
  await page.waitForTimeout(200);
}
const totalQuestions = async (page) => Number((await page.getByRole("button", { name: /^Question \d+ of \d+/ }).innerText()).match(/of (\d+)/)[1]);
/** Next (or Review on the last question), then waits until the player really moved on. */
async function nextOrReview(page, last) {
  const before = await page.getByRole("button", { name: /^Question \d+ of \d+/ }).innerText().catch(() => "");
  await page.getByRole("button", { name: last ? /^Review/ : /^Next/ }).click();
  if (last) { await page.getByText(/Check your work/).first().waitFor({ timeout: 30000 }).catch(() => {}); return; }
  const n = Number((before.match(/Question (\d+)/) ?? [])[1] ?? 0);
  if (n) await page.getByRole("button", { name: new RegExp(`^Question ${n + 1} of`) }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(150);
}
/** Check (immediate feedback) and wait for this question's result. */
async function check(page) {
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: /^Checking/ }).waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
  await page.getByText(/^(Correct|Incorrect)/).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(300);
}

module.exports = { open, close, go, settle, shot, login, soft, run, choices, answer, totalQuestions, nextOrReview, check };
