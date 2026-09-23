// Apply the recovery-map fixes to OFFICIAL content, WAL-safely (raw better-sqlite3).
//
// tsx/esbuild is broken in this env, so this is a self-contained .mjs (no Prisma/TS).
// It replicates lib/ingest-promotion.ts `materializeOfficialImageUrl` + object-storage
// `putQuestionImage` for images (read artifact bytes -> sha256(24) name -> write
// public/uploads/questions -> set Question.imageUrl). Text/answer/option are direct UPDATEs
// (reconcileOfficialUpdate is additive and would NOT overwrite a wrong-but-present value).
//
// WAL SAFETY (raw-handle pattern, like scripts/cleanup-ps-image-placeholders.mjs):
//   - dev server MUST be stopped (guard: refuse if :3000 open + require --confirm-server-stopped),
//   - busy_timeout=5000, one db.transaction() per question,
//   - close with PRAGMA wal_checkpoint(TRUNCATE) + integrity_check.
// Take a backup first. Rollback = restore backups/ snapshot.
//
// Usage:
//   node scripts/qa/apply-recovery-fixes.mjs                              # dry-run
//   node scripts/qa/apply-recovery-fixes.mjs --apply --confirm-server-stopped
//   flags: --specs-dir=<dir>  --include-low  --audit=<md>
//
// Spec types: answer | text {field} | option {label} (upsert) | image {imageArtifactId}
//   | imageFile {file} (local crop, e.g. from pdftoppm) | imageClear | qtype {new: MC|NUMERIC} | deferred
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import crypto from "node:crypto";

const REPO_ROOT = "/home/turista/Descargas/Github/sat-manager-platform";
const DB_PATH = path.join(REPO_ROOT, "dev.db");
const PRIVATE_ROOT = process.env.INGEST_PUBLIC_UPLOAD_ROOT || path.join(REPO_ROOT, ".private", "uploads", "ingest");
const PUBLIC_Q_DIR = path.join(REPO_ROOT, "public", "uploads", "questions");
const SCRATCH = "/tmp/claude-1000/-home-turista-Descargas-Github-sat-manager-platform/2c6b9f94-723c-41e4-833c-9b04cf4b5682/scratchpad";
const DEFAULT_SPECS_DIR = path.join(SCRATCH, "fixes");
const AUDIT_PATH = path.join(REPO_ROOT, "docs", "qa", "fixes-applied.md");

function parseArgs(argv) {
  const a = { apply: false, confirmStopped: false, includeLow: false, specsDir: DEFAULT_SPECS_DIR, audit: AUDIT_PATH };
  for (const arg of argv) {
    if (arg === "--apply") a.apply = true;
    else if (arg === "--confirm-server-stopped") a.confirmStopped = true;
    else if (arg === "--include-low") a.includeLow = true;
    else if (arg.startsWith("--specs-dir=")) a.specsDir = arg.slice("--specs-dir=".length);
    else if (arg.startsWith("--audit=")) a.audit = arg.slice("--audit=".length);
  }
  return a;
}
function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: "127.0.0.1", port }, () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    s.setTimeout(500, () => { s.destroy(); resolve(false); });
  });
}
const NUM = String.raw`-?(\d+(\.\d+)?|\.\d+)(\/\d+)?`;
const ANSWER_SHAPE = new RegExp(`^([A-D](\\|[A-D])*|${NUM}(\\|${NUM})*)$`);
const h = (s, n = 80) => (s == null ? "" : String(s)).replace(/\s+/g, " ").trim().slice(0, n);

function loadSpecs(dir) {
  if (!fs.existsSync(dir)) throw new Error(`specs dir not found: ${dir}`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const ops = [];
  for (const f of files) {
    const arr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (!Array.isArray(arr)) throw new Error(`${f} not a JSON array`);
    for (const o of arr) ops.push({ ...o, _file: f });
  }
  return ops;
}

// Replicate materializeOfficialImageUrl + putQuestionImage (disk-only; no GCS in dev).
function materializeImage(db, imageArtifactId) {
  const art = db.prepare("SELECT id, fileUrl, base64Data, mimeType FROM IngestImageArtifact WHERE id = ?").get(imageArtifactId);
  if (!art) throw new Error(`image artifact not found: ${imageArtifactId}`);
  let data, ext;
  if (art.fileUrl && art.fileUrl.startsWith("/api/admin/ai-import/assets/")) {
    const rel = art.fileUrl.replace("/api/admin/ai-import/assets/", "");
    const src = path.resolve(PRIVATE_ROOT, rel);
    if (!src.startsWith(path.resolve(PRIVATE_ROOT))) throw new Error("path traversal");
    data = fs.readFileSync(src);
    ext = path.extname(rel) || ".jpg";
  } else if (art.base64Data) {
    data = Buffer.from(art.base64Data, "base64");
    ext = (art.mimeType && art.mimeType.includes("png")) ? ".png" : ".jpg";
  } else {
    throw new Error(`artifact ${imageArtifactId} has neither fileUrl nor base64Data`);
  }
  const digest = crypto.createHash("sha256").update(data).digest("hex").slice(0, 24);
  const name = `${digest}${ext}`;
  fs.mkdirSync(PUBLIC_Q_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_Q_DIR, name), data);
  return `/uploads/questions/${name}`;
}

// Same sha256(24) naming as materializeImage, for a local crop file (e.g. pdftoppm render).
function materializeFile(file) {
  const data = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase() || ".png";
  const name = `${crypto.createHash("sha256").update(data).digest("hex").slice(0, 24)}${ext}`;
  fs.mkdirSync(PUBLIC_Q_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_Q_DIR, name), data);
  return `/uploads/questions/${name}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.apply && !args.confirmStopped) {
    console.error("\nRefusing to --apply without --confirm-server-stopped (dev.db is WAL; a concurrent write corrupts it).\n");
    process.exit(2);
  }
  if (args.apply && (await portOpen(3000))) {
    console.error("\nRefusing to --apply: something is listening on :3000 (dev server up). Stop it first.\n");
    process.exit(2);
  }

  const allOps = loadSpecs(args.specsDir);
  const skippedLow = [], deferred = [];
  const ops = allOps.filter((o) => {
    if (o.type === "deferred") { deferred.push(o); return false; }
    if (o.confidence === "low" && !args.includeLow) { skippedLow.push(o); return false; }
    return true;
  });

  const db = new Database(DB_PATH);
  db.pragma("busy_timeout = 5000");

  // validate
  const errors = [];
  const qids = [...new Set(ops.map((o) => o.qid).filter(Boolean))];
  const getQ = db.prepare("SELECT id, stem, stimulus, correctAnswer, imageUrl FROM Question WHERE id = ?");
  const getOpts = db.prepare("SELECT label, text FROM QuestionOption WHERE questionId = ? ORDER BY label");
  const existing = new Set(qids.filter((id) => getQ.get(id)));
  for (const o of ops) {
    if (!o.qid) { errors.push(`${o.type}: missing qid`); continue; }
    if (!existing.has(o.qid)) { errors.push(`${o.loc || o.qid}: qid not in DB`); continue; }
    if (o.type === "answer" && !(o.new && ANSWER_SHAPE.test(o.new))) errors.push(`${o.loc}: bad answer "${o.new}"`);
    if (o.type === "text" && !(o.field && o.new && o.new.trim())) errors.push(`${o.loc}: text needs field+new`);
    if (o.type === "option" && !(o.label && o.new && o.new.trim())) errors.push(`${o.loc}: option needs label+new`);
    if (o.type === "image" && !o.imageArtifactId) errors.push(`${o.loc}: image needs imageArtifactId`);
    if (o.type === "text" && !["stem", "stimulus", "explanation"].includes(o.field)) errors.push(`${o.loc}: bad text field "${o.field}"`);
    if (o.type === "option" && !/^[A-D]$/.test(o.label || "")) errors.push(`${o.loc}: bad option label "${o.label}"`);
    if (o.type === "imageFile" && !(o.file && fs.existsSync(o.file))) errors.push(`${o.loc}: imageFile not found "${o.file}"`);
    if (o.type === "qtype" && !["MC", "NUMERIC"].includes(o.new)) errors.push(`${o.loc}: bad qtype "${o.new}"`);
    if (!["answer", "text", "option", "image", "imageFile", "imageClear", "qtype"].includes(o.type)) errors.push(`${o.loc}: unknown type "${o.type}"`);
  }
  if (errors.length) { console.error("VALIDATION ERRORS:\n  " + errors.join("\n  ")); db.close(); process.exit(1); }

  const byType = {};
  for (const o of ops) byType[o.type] = (byType[o.type] || 0) + 1;
  console.log(`Loaded ${allOps.length} ops from ${args.specsDir}`);
  console.log(`Applying: ${JSON.stringify(byType)} over ${qids.length} questions | skipped(low): ${skippedLow.length} | deferred: ${deferred.length}`);
  for (const o of skippedLow) console.log(`  SKIP(low) ${o.loc} ${o.type}${o.field ? "/" + o.field : ""}${o.label ? "/" + o.label : ""} — ${h(o.note, 90)}`);
  for (const o of deferred) console.log(`  DEFERRED  ${o.loc} — ${h(o.note, 90)}`);

  const before = new Map();
  for (const id of qids) before.set(id, { q: getQ.get(id), opts: getOpts.all(id) });

  if (!args.apply) {
    console.log("\n--- DRY RUN ---");
    for (const id of qids) {
      const my = ops.filter((o) => o.qid === id);
      console.log(`\n${my[0].loc || id} (${id})  [${my[0].test || ""}]`);
      for (const o of my) {
        if (o.type === "answer") console.log(`  answer: ${o.old} -> ${o.new}`);
        else if (o.type === "text") console.log(`  ${o.field}: "${h(o.new, 110)}"`);
        else if (o.type === "option") console.log(`  opt ${o.label}: "${h(o.new, 90)}"`);
        else if (o.type === "image") console.log(`  image STEM <= ${o.imageArtifactId}`);
        else if (o.type === "imageFile") console.log(`  image STEM <= file ${o.file}`);
        else if (o.type === "imageClear") console.log(`  image STEM cleared (was ${before.get(id).q.imageUrl})`);
        else if (o.type === "qtype") console.log(`  type -> ${o.new}`);
      }
    }
    console.log("\nDry-run only. Re-run with --apply --confirm-server-stopped.");
    db.close();
    return;
  }

  // APPLY
  const audit = [`# Fixes aplicados — recovery-map (${new Date().toISOString()})`,
    `\nSpecs: \`${args.specsDir}\`. Backup previo en \`backups/devdb-preapply-*\`. Dev server detenido. Raw better-sqlite3 + WAL checkpoint.\n`];
  const upOpt = db.prepare("UPDATE QuestionOption SET text = ? WHERE questionId = ? AND label = ?");
  const insOpt = db.prepare("INSERT INTO QuestionOption (id, questionId, label, text) VALUES (?, ?, ?, ?)");

  for (const id of qids) {
    const my = ops.filter((o) => o.qid === id);
    const b = before.get(id);
    // resolve images first (file IO), collect imageUrl
    let newImageUrl = null;
    for (const o of my.filter((x) => x.type === "image")) {
      newImageUrl = materializeImage(db, o.imageArtifactId);
      audit.push(`- **${o.loc}** (${o.test}) image STEM <= ${o.imageArtifactId} → \`${newImageUrl}\` (was \`${b.q.imageUrl}\`)`);
    }
    for (const o of my.filter((x) => x.type === "imageFile")) {
      newImageUrl = materializeFile(o.file);
      audit.push(`- **${o.loc}** (${o.test}) image STEM <= file \`${path.basename(o.file)}\` → \`${newImageUrl}\` (was \`${b.q.imageUrl}\`)`);
    }
    const qset = {};
    for (const o of my) {
      if (o.type === "text") qset[o.field] = o.new;
      else if (o.type === "answer") qset.correctAnswer = o.new;
      else if (o.type === "qtype") qset.type = o.new;
      else if (o.type === "imageClear") { qset.imageUrl = null; audit.push(`- **${o.loc}** (${o.test}) image STEM cleared (was \`${b.q.imageUrl}\`)`); }
    }
    if (newImageUrl) qset.imageUrl = newImageUrl;
    const optOps = my.filter((o) => o.type === "option");

    const tx = db.transaction(() => {
      const keys = Object.keys(qset);
      if (keys.length) {
        const sql = `UPDATE Question SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updatedAt = CURRENT_TIMESTAMP WHERE id = @id`;
        db.prepare(sql).run({ ...qset, id });
      }
      for (const o of optOps) {
        if (upOpt.run(o.new, id, o.label).changes === 0) insOpt.run(`qo${crypto.randomBytes(11).toString("hex")}`, id, o.label, o.new);
      }
    });
    tx();

    for (const o of my) {
      if (o.type === "text") audit.push(`- **${o.loc}** (${o.test}) ${o.field}: \`${h(b.q[o.field])}\` → \`${h(o.new)}\``);
      else if (o.type === "qtype") audit.push(`- **${o.loc}** (${o.test}) type → \`${o.new}\``);
      else if (o.type === "answer") audit.push(`- **${o.loc}** (${o.test}) correctAnswer: \`${b.q.correctAnswer}\` → \`${o.new}\`  (${h(o.evidence, 120)})`);
      else if (o.type === "option") {
        const ob = b.opts.find((x) => x.label === o.label);
        audit.push(`- **${o.loc}** (${o.test}) opt ${o.label}: \`${h(ob && ob.text, 60)}\` → \`${h(o.new, 60)}\``);
      }
    }
  }

  if (skippedLow.length || deferred.length) {
    audit.push(`\n## No aplicados (revisar manual)`);
    for (const o of skippedLow) audit.push(`- SKIP(low) **${o.loc}** (${o.test}) ${o.type}${o.field ? "/" + o.field : ""}${o.label ? "/" + o.label : ""} — ${o.note || ""}`);
    for (const o of deferred) audit.push(`- DEFERRED **${o.loc}** (${o.test}) — ${o.note || ""} artifactIds=${JSON.stringify(o.artifactIds || [])}`);
  }

  const checkpoint = db.pragma("wal_checkpoint(TRUNCATE)");
  const integrity = db.pragma("integrity_check");
  const okIntegrity = JSON.stringify(integrity).includes("ok");
  audit.push(`\n## WAL\ncheckpoint: \`${JSON.stringify(checkpoint)}\`\nintegrity: \`${JSON.stringify(integrity)}\``);
  fs.mkdirSync(path.dirname(args.audit), { recursive: true });
  fs.writeFileSync(args.audit, audit.join("\n") + "\n");
  db.close();
  console.log("checkpoint:", JSON.stringify(checkpoint));
  console.log("integrity :", JSON.stringify(integrity));
  console.log("audit ->", args.audit);
  if (!okIntegrity) { console.error("\n!!! integrity_check NOT ok — restore from backups/."); process.exit(1); }
  console.log("Done.");
}
main().catch((e) => { console.error(e); process.exit(1); });
