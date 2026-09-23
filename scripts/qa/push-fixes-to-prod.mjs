// Push the recovery fixes to PRODUCTION, NON-DESTRUCTIVELY, via the app's own API.
// Only the ~37 affected questions change (PUT /api/questions/{id}); no DB swap, no
// downtime, WAL-safe (writes through the running app). Values come from the already-fixed
// LOCAL dev.db (source of truth). New images are uploaded first (POST /api/questions/media/upload).
//
// Usage:
//   node scripts/qa/push-fixes-to-prod.mjs                 # dry-run (no login, no writes)
//   node scripts/qa/push-fixes-to-prod.mjs --apply         # login + upload + PUT
//   flags: --base=https://satsol.org  --specs-dir=<dir>
//
// Creds: .secrets/prod-admin-credentials.txt ("email / password"), or PROD_ADMIN_EMAIL/PASSWORD.
// The email/password are used ONLY to log in to the user's own production app. Never sent elsewhere.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const REPO = "/home/turista/Descargas/Github/sat-manager-platform";
const DB_PATH = path.join(REPO, "dev.db");
const PUBLIC_Q_DIR = path.join(REPO, "public", "uploads", "questions");
const SCRATCH = "/tmp/claude-1000/-home-turista-Descargas-Github-sat-manager-platform/2c6b9f94-723c-41e4-833c-9b04cf4b5682/scratchpad";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const BASE = (args.find((a) => a.startsWith("--base=")) || "--base=https://satsol.org").split("=")[1].replace(/\/$/, "");
const SPECS_DIR = (args.find((a) => a.startsWith("--specs-dir=")) || `--specs-dir=${path.join(SCRATCH, "fixes")}`).split("=")[1];
const AUDIT = (args.find((a) => a.startsWith("--audit=")) || `--audit=${path.join(REPO, "docs", "qa", "prod-push-applied.md")}`).slice("--audit=".length);
// --baseline-db: pre-apply backup of dev.db. Reports which fields each fix changed and only
// uploads an image when imageUrl changed vs the baseline (otherwise the prod path is reused).
const BASELINE = (args.find((a) => a.startsWith("--baseline-db=")) || "").slice("--baseline-db=".length) || null;
if (!/^https:\/\/satsol\.org$/.test(BASE)) { console.error(`Refusing: base must be https://satsol.org (got ${BASE})`); process.exit(2); }

function readCreds() {
  let email = process.env.PROD_ADMIN_EMAIL, password = process.env.PROD_ADMIN_PASSWORD;
  for (const rel of [".secrets/prod-admin-credentials.txt", ".secrets/prod-credentials.txt"]) {
    if (email && password) break;
    const f = path.join(REPO, rel);
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      // env-style: PROD_ADMIN_EMAIL=... / PROD_ADMIN_PASSWORD=...
      const m = t.match(/^([A-Z_]+)\s*=\s*(.+)$/);
      if (m) {
        if (/EMAIL/.test(m[1]) && !email) email = m[2].trim();
        else if (/PASSWORD/.test(m[1]) && !password) password = m[2].trim();
        continue;
      }
      // "email / password" (first admin line)
      if (t.includes("/") && t.includes("@") && !(email && password)) {
        email = t.split("/")[0].trim();
        password = t.split("/").slice(1).join("/").trim();
      }
    }
  }
  if (!email || !password) throw new Error("No prod admin creds (set PROD_ADMIN_EMAIL/PASSWORD or .secrets/*.txt)");
  return { email, password };
}

// ---- cookie jar ----
const jar = new Map();
function absorb(res) {
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of sc) { const [nv] = c.split(";"); const i = nv.indexOf("="); if (i > 0) jar.set(nv.slice(0, i).trim(), nv.slice(i + 1).trim()); }
}
function cookieHeader() { return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "); }

async function login({ email, password }) {
  let r = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } });
  absorb(r);
  const { csrfToken } = await r.json();
  if (!csrfToken) throw new Error("no csrfToken");
  const body = new URLSearchParams({ csrfToken, email, password, callbackUrl: BASE + "/", json: "true" });
  r = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: body.toString(),
  });
  absorb(r);
  const s = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookieHeader() } });
  const sess = await s.json().catch(() => ({}));
  if (!sess || !sess.user) throw new Error(`login failed (no session; status ${r.status})`);
  return sess.user;
}

async function uploadImage(localFile, res) {
  const buf = fs.readFileSync(localFile);
  const ext = path.extname(localFile).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type }), path.basename(localFile));
  const r = await fetch(`${BASE}/api/questions/media/upload`, { method: "POST", headers: { cookie: cookieHeader() }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(`upload failed ${r.status}: ${JSON.stringify(j)}`);
  return j.url;
}

// ---- gather affected qids + local final values ----
const db = new Database(DB_PATH, { readonly: true });
const qids = new Set();
for (const f of fs.readdirSync(SPECS_DIR).filter((x) => x.endsWith(".json")))
  for (const o of JSON.parse(fs.readFileSync(path.join(SPECS_DIR, f), "utf8"))) if (o.qid) qids.add(o.qid);

const getQ = db.prepare("SELECT id, topicId, subskillId, difficulty, type, stem, stimulus, explanation, imageUrl, supportsGraph, correctAnswer, status FROM Question WHERE id = ?");
const getOpts = db.prepare("SELECT label, text, imageUrl FROM QuestionOption WHERE questionId = ? ORDER BY label");
const items = [];
for (const id of qids) {
  const q = getQ.get(id);
  if (!q) { console.error(`missing local qid ${id}`); continue; }
  const options = getOpts.all(id).map((o) => ({ label: o.label, text: o.text ?? "", imageUrl: o.imageUrl || "" }));
  items.push({ q, options });
}
db.close();
if (BASELINE) {
  const bdb = new Database(BASELINE, { readonly: true });
  const bq = bdb.prepare(getQ.source);
  const bo = bdb.prepare(getOpts.source);
  for (const it of items) {
    const b = bq.get(it.q.id);
    if (!b) { it.changed = ["<missing in baseline>"]; continue; }
    it.changed = Object.keys(it.q).filter((k) => (it.q[k] ?? null) !== (b[k] ?? null));
    const bOpts = JSON.stringify(bo.all(it.q.id).map((o) => ({ label: o.label, text: o.text ?? "", imageUrl: o.imageUrl || "" })));
    if (bOpts !== JSON.stringify(it.options)) it.changed.push("options");
  }
  bdb.close();
  const noop = items.filter((it) => it.changed && it.changed.length === 0);
  for (const it of noop) console.log(`  skip (no change vs baseline) ${it.q.id}`);
  items.splice(0, items.length, ...items.filter((it) => !noop.includes(it)));
}
function needsUpload(it) {
  const q = it.q;
  const localImg = q.imageUrl ? path.join(PUBLIC_Q_DIR, q.imageUrl.split("/").pop()) : null;
  if (!localImg || !fs.existsSync(localImg)) return null;
  if (it.changed && !it.changed.includes("imageUrl")) return null;
  return localImg;
}
items.sort((a, b) => a.q.id.localeCompare(b.q.id));

function bodyFor(it, imageUrlOverride) {
  const q = it.q;
  return {
    topicId: q.topicId,
    subskillId: q.subskillId || null,
    difficulty: q.difficulty,
    type: q.type,
    stem: q.stem ?? "",
    stimulus: q.stimulus ?? "",
    explanation: q.explanation ?? "",
    imageUrl: imageUrlOverride != null ? imageUrlOverride : (q.imageUrl ?? ""),
    supportsGraph: Boolean(q.supportsGraph),
    correctAnswer: q.correctAnswer ?? "",
    status: "PUBLISHED",
    options: q.type === "MC" ? it.options : [],
  };
}

console.log(`Base: ${BASE} | affected questions: ${items.length} | mode: ${APPLY ? "APPLY" : "dry-run"}`);
for (const it of items) {
  const q = it.q;
  const willUpload = needsUpload(it);
  console.log(`  ${q.id}  type=${q.type} status=${q.status} ans=${q.correctAnswer} img=${q.imageUrl || "-"}${willUpload ? " (upload)" : ""} opts=${it.options.length}${it.changed ? ` changed=[${it.changed.join(",")}]` : ""}`);
}

if (!APPLY) { console.log("\nDry-run only. Re-run with --apply to login + upload + PUT."); process.exit(0); }

const log = [`# Push a producción (${new Date().toISOString()}) — ${BASE}`, `\nNo destructivo: PUT por id de ${items.length} preguntas. Valores del dev.db local.\n`];
const user = await login(readCreds());
console.log(`Logged in as ${user.email || user.id} role=${user.role}`);
log.push(`Login: ${user.email || user.id} role=${user.role}\n`);
if (user.role !== "ADMIN" && user.role !== "TEACHER") { console.error("role not TEACHER/ADMIN"); process.exit(1); }

let ok = 0; const fails = [];
for (const it of items) {
  const q = it.q;
  try {
    let imgOverride;
    const localImg = needsUpload(it);
    if (localImg) imgOverride = await uploadImage(localImg);
    const body = bodyFor(it, imgOverride);
    const r = await fetch(`${BASE}/api/questions/${q.id}`, {
      method: "PUT", headers: { "content-type": "application/json", cookie: cookieHeader() }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { ok++; log.push(`- OK ${q.id} (img=${body.imageUrl || "-"})`); }
    else { fails.push({ id: q.id, status: r.status, err: j.errors || j.error }); log.push(`- FAIL ${q.id} ${r.status}: ${JSON.stringify(j.errors || j.error)}`); }
  } catch (e) { fails.push({ id: q.id, err: String(e) }); log.push(`- ERROR ${q.id}: ${String(e)}`); }
}
log.push(`\n## Resultado\nOK: ${ok} / ${items.length} | FAIL: ${fails.length}`);
for (const f of fails) log.push(`- ${f.id} :: ${f.status || ""} ${JSON.stringify(f.err)}`);
fs.mkdirSync(path.dirname(AUDIT), { recursive: true });
fs.writeFileSync(AUDIT, log.join("\n") + "\n");
console.log(`\nOK ${ok}/${items.length}, FAIL ${fails.length}. Audit -> ${AUDIT}`);
for (const f of fails) console.log(`  FAIL ${f.id} ${f.status || ""} ${JSON.stringify(f.err)}`);
