// Prepara un snapshot SANEADO de una BD SQLite local para empujar a producción.
//
// Lo usa deploy/push-db-to-cloud.sh, pero se puede correr solo. Produce una copia
// consolidada (incluye WAL) y, opcionalmente, la sanea para no arrastrar artefactos
// de desarrollo a producción:
//   • Purga AppSetting cifrados (no descifran con la SECRET_ENCRYPTION_KEY de prod).
//   • Inserta/actualiza un admin de prod con contraseña conocida (estable).
//   • Deshabilita cuentas dev con credenciales débiles.
//   • Rota contraseñas de cuentas dev que quieras conservar activas.
//
// Config por variables de entorno (todas opcionales salvo que se indique):
//   SRC                 BD origen (default ./dev.db)
//   OUT                 snapshot destino (default /tmp/push-cloud/dev.db)
//   PURGE_ENCRYPTED     "true"|"false" — purga AppSetting con key '%_ENCRYPTED' (default true)
//   PROD_ADMIN_EMAIL    si se da junto con PROD_ADMIN_PASSWORD, upsert de ese admin
//   PROD_ADMIN_PASSWORD contraseña del admin de prod
//   DISABLE_EMAILS      CSV de emails a deshabilitar (active=0)
//   ROTATE_EMAILS       CSV de emails cuya contraseña se rota (se imprime la nueva)
//   CONTENT_FILTER      "ps-fpt-only" — en el snapshot (no en SRC): deja asignables solo
//                       PracticeSet/FullPracticeTest PUBLISHED; archiva el resto;
//                       rechaza candidatos de ingest; archiva StudyMaterial.
//
// Imprime un resumen y, al final, líneas `CREDENTIAL <email> <password>` para que
// el orquestador las capture. NUNCA envía correos ni toca la BD origen.
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";

const SRC = process.env.SRC || "./dev.db";
const OUT = process.env.OUT || "/tmp/push-cloud/dev.db";
const PURGE_ENCRYPTED = (process.env.PURGE_ENCRYPTED ?? "true") !== "false";
const PROD_ADMIN_EMAIL = process.env.PROD_ADMIN_EMAIL?.trim().toLowerCase() || null;
const PROD_ADMIN_PASSWORD = process.env.PROD_ADMIN_PASSWORD || null;
const DISABLE_EMAILS = (process.env.DISABLE_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const ROTATE_EMAILS = (process.env.ROTATE_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const CONTENT_FILTER = (process.env.CONTENT_FILTER || "").trim().toLowerCase();

if (!fs.existsSync(SRC)) {
  console.error(`SRC no existe: ${SRC}`);
  process.exit(1);
}

const nowIso = () => new Date().toISOString().replace("Z", "+00:00");
const cuid = () => "c" + crypto.randomBytes(12).toString("hex");
const genPw = () => crypto.randomBytes(15).toString("base64url");

fs.mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true });

// 1) Copia consolidada (online backup: incluye lo que esté en el -wal).
const src = new Database(SRC, { readonly: true });
await src.backup(OUT);
src.close();

const db = new Database(OUT);
db.pragma("foreign_keys = OFF");

if (PURGE_ENCRYPTED) {
  const r = db.prepare("DELETE FROM AppSetting WHERE key LIKE '%\\_ENCRYPTED' ESCAPE '\\'").run();
  console.log(`AppSetting cifrados purgados: ${r.changes}`);
}

const creds = [];

if (PROD_ADMIN_EMAIL && PROD_ADMIN_PASSWORD) {
  const hash = bcrypt.hashSync(PROD_ADMIN_PASSWORD, 10);
  const existing = db.prepare("SELECT id FROM User WHERE email=?").get(PROD_ADMIN_EMAIL);
  if (existing) {
    db.prepare("UPDATE User SET passwordHash=?, role='ADMIN', active=1, validationStatus='APPROVED', updatedAt=? WHERE email=?")
      .run(hash, nowIso(), PROD_ADMIN_EMAIL);
    console.log(`admin prod actualizado: ${PROD_ADMIN_EMAIL}`);
  } else {
    db.prepare(`INSERT INTO User (id,name,email,passwordHash,role,active,validationStatus,validationReviewedAt,createdAt,updatedAt)
                VALUES (?,?,?,?,'ADMIN',1,'APPROVED',?,?,?)`)
      .run(cuid(), "Admin", PROD_ADMIN_EMAIL, hash, nowIso(), nowIso(), nowIso());
    console.log(`admin prod insertado: ${PROD_ADMIN_EMAIL}`);
  }
  creds.push([PROD_ADMIN_EMAIL, PROD_ADMIN_PASSWORD]);
} else if (PROD_ADMIN_EMAIL || PROD_ADMIN_PASSWORD) {
  console.error("Aviso: PROD_ADMIN_EMAIL y PROD_ADMIN_PASSWORD deben ir juntos; se omite el admin.");
}

for (const email of DISABLE_EMAILS) {
  const r = db.prepare("UPDATE User SET active=0 WHERE email=?").run(email);
  if (r.changes) console.log(`deshabilitado: ${email}`);
}

for (const email of ROTATE_EMAILS) {
  const found = db.prepare("SELECT id FROM User WHERE email=?").get(email);
  if (!found) continue;
  const pw = genPw();
  db.prepare("UPDATE User SET passwordHash=?, active=1, updatedAt=? WHERE email=?").run(bcrypt.hashSync(pw, 10), nowIso(), email);
  console.log(`rotado: ${email}`);
  creds.push([email, pw]);
}

if (CONTENT_FILTER === "ps-fpt-only") {
  const now = nowIso();
  const keepPs = new Set(
    db.prepare("SELECT id FROM PracticeSet WHERE status = 'PUBLISHED'").all().map((row) => row.id),
  );
  const keepFpt = new Set(
    db.prepare("SELECT id FROM FullPracticeTest WHERE status = 'PUBLISHED'").all().map((row) => row.id),
  );
  const keepQuestions = new Set();
  for (const id of keepPs) {
    for (const row of db.prepare("SELECT questionId FROM PracticeSetQuestion WHERE practiceSetId = ?").all(id)) {
      keepQuestions.add(row.questionId);
    }
  }
  for (const id of keepFpt) {
    for (const row of db
      .prepare(
        `SELECT fq.questionId AS questionId
         FROM FullPracticeTestQuestion fq
         JOIN FullPracticeTestModule m ON m.id = fq.moduleId
         WHERE m.testId = ?`,
      )
      .all(id)) {
      keepQuestions.add(row.questionId);
    }
  }

  const archivedPs = db
    .prepare("UPDATE PracticeSet SET status = 'ARCHIVED', updatedAt = ? WHERE status != 'PUBLISHED'")
    .run(now).changes;
  const archivedFpt = db
    .prepare("UPDATE FullPracticeTest SET status = 'ARCHIVED', updatedAt = ? WHERE status != 'PUBLISHED'")
    .run(now).changes;

  let archivedQuestions = 0;
  const allQuestions = db.prepare("SELECT id, status FROM Question").all();
  const archiveQ = db.prepare("UPDATE Question SET status = 'ARCHIVED', updatedAt = ? WHERE id = ?");
  for (const question of allQuestions) {
    if (keepQuestions.has(question.id)) continue;
    if (question.status === "ARCHIVED") continue;
    archiveQ.run(now, question.id);
    archivedQuestions += 1;
  }

  let archivedMaterials = 0;
  try {
    archivedMaterials = db
      .prepare("UPDATE StudyMaterial SET status = 'ARCHIVED', updatedAt = ? WHERE status != 'ARCHIVED'")
      .run(now).changes;
  } catch {
    archivedMaterials = 0;
  }

  let rejectedCandidates = 0;
  try {
    rejectedCandidates = db
      .prepare(
        `UPDATE IngestQuestionCandidate
         SET status = 'REJECTED', promotionStatus = 'REJECTED', updatedAt = ?
         WHERE status != 'REJECTED' OR promotionStatus != 'REJECTED'`,
      )
      .run(now).changes;
  } catch {
    rejectedCandidates = 0;
  }

  console.log(`CONTENT_FILTER=ps-fpt-only (solo snapshot):`);
  console.log(`  keep PracticeSet PUBLISHED=${keepPs.size} · archived other=${archivedPs}`);
  console.log(`  keep FullPracticeTest PUBLISHED=${keepFpt.size} · archived other=${archivedFpt}`);
  console.log(`  keep Question in those=${keepQuestions.size} · archived other=${archivedQuestions}`);
  console.log(`  StudyMaterial archived=${archivedMaterials}`);
  console.log(`  IngestQuestionCandidate rejected=${rejectedCandidates}`);
} else if (CONTENT_FILTER) {
  console.error(`Aviso: CONTENT_FILTER desconocido '${CONTENT_FILTER}' (ignorado). Usa ps-fpt-only.`);
}

db.pragma("wal_checkpoint(TRUNCATE)");
db.exec("VACUUM;");

const users = db.prepare("SELECT role,count(*) c FROM User GROUP BY role").all();
const psCounts = db.prepare("SELECT status,count(*) c FROM PracticeSet GROUP BY status").all();
const fptCounts = db.prepare("SELECT status,count(*) c FROM FullPracticeTest GROUP BY status").all();
db.close();

const sizeMb = (fs.statSync(OUT).size / 1e6).toFixed(1);
console.log(`\n── snapshot saneado ──`);
console.log(`OUT: ${OUT} (${sizeMb} MB)`);
console.log(`Usuarios: ${JSON.stringify(users)}`);
console.log(`PracticeSet: ${JSON.stringify(psCounts)}`);
console.log(`FullPracticeTest: ${JSON.stringify(fptCounts)}`);
// Líneas que captura el orquestador (fáciles de grep):
for (const [email, pw] of creds) console.log(`CREDENTIAL ${email} ${pw}`);
