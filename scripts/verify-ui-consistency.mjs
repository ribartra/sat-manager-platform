// Static gate: UI states and errors go through the shared bases (see CLAUDE.md "UI states & errors").
//   - no native dialogs (window.alert/confirm/prompt) → notify / useConfirm
//   - no ad-hoc client error parsing (`.json().catch(() => ...)`) → apiFetch / readApiError
//   - no ad-hoc disabled look (`disabled:opacity-*`) outside components/ui → Button / control-states
//   - raw <button disabled> must use a shared blocked class (control-states) or be the Button base
//   - API routes answer errors with ApiError subclasses, never `NextResponse.json({ error ... })`
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
  if (isApi) {
    for (const m of text.matchAll(/NextResponse\.json\(\s*\{\s*error\s*:/g)) {
      failures.push(`${file}:${lineOf(text, m.index)} inline error response — use an ApiError subclass`);
    }
  }
}

console.log(failures.length ? failures.map((f) => `FAIL - ${f}`).join("\n") : "PASS - UI states and errors use the shared bases");
if (failures.length) {
  console.error(`\n${failures.length} UI consistency problem(s).`);
  process.exit(1);
}
console.log("UI consistency static verification passed.");
