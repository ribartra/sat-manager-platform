// UI margin harness: visits every view per role, screenshots it and measures absolute
// distances (DOM) — nav logo x/width vs page container x/width, h1 x/y, horizontal scroll.
// Pixel verification of the screenshots is done by scripts/qa/ui-margins-pixels.py.
// Usage: node scripts/qa/ui-margins.mjs <baseUrl> <ids.json> <outDir> [viewport=1440x900]
import { chromium } from "@playwright/test";
import fs from "node:fs";

const [base, idsPath, outDir, vp = "1440x900"] = process.argv.slice(2);
const [W, H] = vp.split("x").map(Number);
const ids = JSON.parse(fs.readFileSync(idsPath, "utf8"));
const PASS = "E2eTest#2026";
const s0 = ids.sets[0];
const ROUTES = {
  admin: ["/admin/import", "/admin/import/ai", `/admin/import/ai/${ids.batch}/files/${ids.file}`, "/admin/import/ai/sets", "/admin/logs", "/admin/programs", "/admin/settings", "/admin/taxonomy", "/admin/teachers", "/admin/users"],
  teacher: ["/teacher", "/teacher/compare", "/teacher/content", `/teacher/content/${ids.topic}`, "/teacher/full-tests", "/teacher/full-tests/new", "/teacher/full-tests/scoring", `/teacher/full-tests/${ids.fpt}`, `/teacher/full-tests/${ids.fpt}/assign`, `/teacher/full-tests/${ids.fpt}/edit`, "/teacher/groups", `/teacher/impersonate/${ids.student}`, "/teacher/materials", "/teacher/parents", "/teacher/practice-sets", "/teacher/practice-sets/new", `/teacher/practice-sets/${s0.set}/edit`, "/teacher/programs", "/teacher/questions", "/teacher/questions/new", `/teacher/questions/${ids.question}/edit`, "/teacher/students/invite", `/teacher/students/${ids.student}`, `/teacher/students/${ids.student}/assign`, `/teacher/students/${ids.student}/assign-exam`, `/teacher/students/${ids.student}/attempts/${ids.attempts[0]}`, `/teacher/students/${ids.student}/edit`, "/teacher/subskills", "/notifications"],
  student: ["/student", "/student/content-map", `/student/content-map/${s0.topic}/${s0.difficulty}`, "/student/full-tests", `/student/full-tests/results/${ids.fptAttempt}`, "/student/history", "/student/materials", "/student/practice-sets", "/student/program", `/student/results/${ids.attempts[0]}`],
  parent: ["/parent"],
  anon: ["/login", "/auth/forgot-password", "/auth/pending-validation", "/parent/access"],
  // full-screen players (no nav) — measured separately
  playerTeacher: [`/teacher/practice-sets/${s0.set}/preview`, `/teacher/full-tests/${ids.fpt}/preview`],
  playerStudent: [`/student/practice/assignment/${ids.sets[4].assignment}`, `/student/full-tests/${ids.fptAssignmentPending}`],
};
const EMAIL = { admin: "admin@sat.com", teacher: "teacher@sat.com", student: "student.ui@test.local", parent: "parent.ui@test.local", playerTeacher: "teacher@sat.com", playerStudent: "student.ui@test.local" };

const browser = await chromium.launch({ channel: "chromium" });
const results = [];
fs.mkdirSync(`${outDir}/shots`, { recursive: true });
for (const [role, routes] of Object.entries(ROUTES)) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  if (EMAIL[role]) {
    await page.goto(`${base}/login`);
    await page.fill('input[type="email"]', EMAIL[role]);
    await page.fill('input[type="password"]', PASS);
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }), page.keyboard.press("Enter")]);
  }
  for (const route of routes) {
    const slug = `${role}${route.replace(/[^a-z0-9]+/gi, "_")}`.slice(0, 120);
    try {
      const resp = await page.goto(base + route, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), w: Math.round(b.width), y: Math.round(b.top), r: Math.round(b.right) }; };
        const logo = [...document.querySelectorAll("header *, nav *")].find((el) => /^SAT (Platform|Parent Portal|Practice)$/.test(el.textContent?.trim() || "") && el.children.length === 0);
        const navBar = logo?.closest("div.mx-auto") || logo?.parentElement;
        const main = document.querySelector("main") || document.body;
        const h1 = [...document.querySelectorAll("h1")].find((h) => h.offsetParent !== null);
        // page container: the PageShell (data-page-shell); fallback = ancestor of h1 as wide as its parent chain
        let shell = document.querySelector("[data-page-shell]");
        if (!shell) { shell = h1 ? h1.parentElement : main.firstElementChild; while (shell && shell.parentElement && shell.parentElement !== main && shell.parentElement.getBoundingClientRect().width === shell.getBoundingClientRect().width) shell = shell.parentElement; }
        const firstChild = shell ? [...shell.children].find((c) => c.getBoundingClientRect().height > 0) : null;
        const shellStyle = shell ? getComputedStyle(shell) : null;
        const content = [...main.querySelectorAll("*")].map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0 && b.top < innerHeight);
        const minX = Math.min(...content.map((b) => b.left)), maxX = Math.max(...content.map((b) => b.right));
        return {
          logo: r(logo), navBar: r(navBar), h1: r(h1), h1Text: h1?.textContent?.trim().slice(0, 60) || null, shell: r(shell),
          isPageShell: !!shell?.hasAttribute?.("data-page-shell"), firstY: firstChild ? Math.round(firstChild.getBoundingClientRect().top) : null,
          padL: shellStyle ? parseFloat(shellStyle.paddingLeft) : null,
          contentMinX: Math.round(minX), contentMaxX: Math.round(maxX), scrollX: document.documentElement.scrollWidth > innerWidth,
          navBottom: (() => { const bar = logo?.closest("header, nav"); return bar ? Math.round(bar.getBoundingClientRect().bottom) : 0; })(),
        };
      });
      await page.screenshot({ path: `${outDir}/shots/${slug}.png` });
      results.push({ role, route, status: resp?.status(), url: page.url().replace(base, ""), slug, ...m });
    } catch (e) {
      results.push({ role, route, error: String(e).slice(0, 200), slug });
    }
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${outDir}/margins.json`, JSON.stringify(results, null, 1));
console.log(`measured ${results.length} views (${results.filter((r) => r.error).length} errors) at ${vp}`);
