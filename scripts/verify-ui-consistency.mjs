// Static gate: UI states and errors go through the shared bases (see CLAUDE.md "UI states & errors").
//   - no native dialogs (window.alert/confirm/prompt) → notify / useConfirm
//   - no ad-hoc client error parsing (`.json().catch(() => ...)`) → apiFetch / readApiError
//   - no ad-hoc disabled look (`disabled:opacity-*`) outside components/ui → Button / control-states
//   - raw <button disabled> must use a shared blocked class (control-states) or be the Button base
//   - API routes answer errors with ApiError subclasses, never `NextResponse.json({ error ... })`
//   - icon-only buttons (no visible text) need an accessible name (aria-label / title)
//   - page CSP is per-request with a nonce (proxy.ts + lib/csp.ts): no 'unsafe-inline' for scripts
//     or <style> elements in production
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const failures = [];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated") continue;
      out.push(...(await walk(rel)));
    } else if (/\.(tsx?|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const files = [...(await walk("app")), ...(await walk("components")), ...(await walk("hooks"))];
// Allowed exceptions, each with a reason.
const allow = {
  jsonCatch: new Set([
    "hooks/use-session-guards.ts", // health probe: any non-{ok:true} body just ends the session
  ]),
};

/** `<Button>`/`<button>` elements whose content is only icons, without aria-label/title. */
function iconOnlyButtons(text) {
  const problems = [];
  for (const m of text.matchAll(/<(Button|button)\b/g)) {
    let i = m.index + m[0].length;
    let depth = 0;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    const attrs = text.slice(m.index, i);
    if (attrs.endsWith("/") || /aria-label|aria-labelledby|\btitle=|asChild/.test(attrs)) continue;
    const close = text.indexOf(`</${m[1]}>`, i);
    if (close < 0) continue;
    const body = text.slice(i + 1, close);
    if (/MathContent/.test(body)) continue;
    const visible = body
      .replace(/<[A-Z][A-Za-z0-9.]*\b[^<]*?\/>/g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\s+/g, "");
    if (visible === "" || /^[✕×]$/.test(visible)) {
      problems.push(`${lineOf(text, m.index)} icon-only button without aria-label`);
    }
  }
  return problems;
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

for (const file of files) {
  const text = await readFile(path.join(root, file), "utf8");
  const isApi = file.startsWith(path.join("app", "api"));
  const isUi = file.startsWith(path.join("components", "ui"));

  for (const m of text.matchAll(/window\.(alert|confirm|prompt)\(/g)) {
    failures.push(`${file}:${lineOf(text, m.index)} native ${m[1]}() — use notify / useConfirm`);
  }
  if (!isApi && !allow.jsonCatch.has(file)) {
    for (const m of text.matchAll(/\.json\(\)\.catch\(/g)) {
      failures.push(`${file}:${lineOf(text, m.index)} ad-hoc error parsing — use apiFetch / readApiError`);
    }
  }
  if (!isUi) {
    for (const m of text.matchAll(/disabled:opacity-\d+/g)) {
      failures.push(`${file}:${lineOf(text, m.index)} ${m[0]} — use Button or a control-states class`);
    }
  }
  if (file.endsWith(".tsx")) {
    for (const problem of iconOnlyButtons(text)) failures.push(`${file}:${problem}`);
  }
  if (isApi) {
    for (const m of text.matchAll(/NextResponse\.json\(\s*\{\s*error\s*:/g)) {
      failures.push(`${file}:${lineOf(text, m.index)} inline error response — use an ApiError subclass`);
    }
  }
}

// CSP: nonce-based, built per request.
{
  // Zod must be configured jitless before any schema exists (its eval probe trips the CSP).
  for (const file of [...(await walk("contracts")), ...files]) {
    const text = await readFile(path.join(root, file), "utf8");
    if (/from "zod"/.test(text)) failures.push(`${file} imports "zod" directly — import { z } from "@/lib/zod-config"`);
  }

  const csp = await readFile(path.join(root, "lib/csp.ts"), "utf8");
  const proxy = await readFile(path.join(root, "proxy.ts"), "utf8");
  const config = await readFile(path.join(root, "next.config.ts"), "utf8");
  const scriptLine = csp.split("\n").find((l) => l.includes("script-src"));
  const styleLine = csp.split("\n").find((l) => l.includes("style-src-elem"));
  if (!scriptLine || !/'nonce-\$\{nonce\}'/.test(scriptLine) || !scriptLine.includes("'strict-dynamic'") || scriptLine.includes("unsafe-inline")) {
    failures.push("lib/csp.ts script-src must be 'nonce-…' + 'strict-dynamic' without 'unsafe-inline'");
  }
  // Production branch (after the `:`) must not allow inline <style> elements.
  const prodStyle = styleLine?.split(":").slice(1).join(":") ?? "";
  if (!styleLine || !/'nonce-\$\{nonce\}'/.test(prodStyle) || prodStyle.includes("unsafe-inline")) {
    failures.push("lib/csp.ts production style-src-elem must be nonce-based without 'unsafe-inline'");
  }
  if (!proxy.includes("buildCsp(nonce)")) failures.push("proxy.ts must set the per-request CSP (buildCsp)");
  if (/key:\s*"Content-Security-Policy"/.test(config)) failures.push("next.config.ts must not set a static CSP (proxy.ts owns it)");
}

{
  // Every view inside the app shell shows breadcrumbs (mockup `A.crumbs`): a page folder whose
  // .tsx files render PageShell must also render Breadcrumbs. Exceptions: the portal Homes and
  // screens without the shell (auth, public parent access).
  const noCrumbs = new Set([
    "app/(teacher)/teacher", // teacher Home
    "app/(parent)/parent", // parent Home
    "app/(auth)/auth/change-password", // auth layout, no sidebar
    "app/parent/access", // public token page
  ]);
  const byDir = new Map();
  for (const file of files.filter((f) => f.startsWith("app/") && f.endsWith(".tsx"))) {
    const dir = path.dirname(file);
    byDir.set(dir, [...(byDir.get(dir) ?? []), file]);
  }
  for (const [dir, dirFiles] of byDir) {
    if (!dirFiles.some((f) => path.basename(f) === "page.tsx") || noCrumbs.has(dir)) continue;
    const texts = await Promise.all(dirFiles.map((f) => readFile(path.join(root, f), "utf8")));
    if (texts.some((t) => /<PageShell\b/.test(t)) && !texts.some((t) => /<Breadcrumbs\b/.test(t))) {
      failures.push(`${dir}/page.tsx renders PageShell without Breadcrumbs (components/sat/breadcrumbs.tsx)`);
    }
  }
}

console.log(failures.length ? failures.map((f) => `FAIL - ${f}`).join("\n") : "PASS - UI states and errors use the shared bases");
if (failures.length) {
  console.error(`\n${failures.length} UI consistency problem(s).`);
  process.exit(1);
}
console.log("UI consistency static verification passed.");
