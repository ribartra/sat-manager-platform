// scripts/clean-demo-content.mjs
//
// Deja el dev.db SIN alumnos ni contenido demo generado por el seed, preservando
// admin + 2 profesores + taxonomía + Program + AppSettings + tablas de score +
// TODO el staging de ingesta (Ingest*).
//
//   node scripts/clean-demo-content.mjs            # dry-run: solo reporta
//   node scripts/clean-demo-content.mjs --apply    # aplica los borrados
//
// Seguro por diseño: borra dentro de una transacción con foreign_keys=OFF y luego
// corre PRAGMA foreign_key_check + aserciones de preservación. Aborta si algo no cuadra.

import Database from "better-sqlite3";

const DB_PATH = process.env.CLEAN_DB_PATH || "dev.db";
const APPLY = process.argv.includes("--apply");

// Tablas de contenido demo a vaciar por completo (todas sus filas son demo:
// 0 provienen de ingesta — promotionStatus=NOT_PROMOTED en los candidatos).
const CLEAR_TABLES = [
  // hijos de intentos / asignaciones primero (aunque FK va OFF, orden legible)
  "AttemptAnswer",
  "AttemptPause",
  "Attempt",
  "UnlockRequest",
  "Assignment",
  // practice sets
  "PracticeSetQuestion",
  "PracticeSet",
  // full practice tests
  "FullPracticeTestAnswer",
  "FullPracticeTestPause",
  "FullPracticeTestAttempt",
  "FullPracticeTestAssignment",
  "FullPracticeTestQuestion",
  "FullPracticeTestModule",
  "FullPracticeTest",
  // preguntas / materiales
  "QuestionOption",
  "Question",
  "StudyMaterial",
  // alumnos / padres (relaciones)
  "ProgramEnrollment",
  "ParentStudent",
  "InviteToken",
];

// Borrados parciales
const DELETE_USERS_SQL = "DELETE FROM User WHERE role IN ('STUDENT','PARENT')";
const DELETE_AUDIT_SQL = "DELETE FROM AuditLog WHERE id LIKE 'audit-seed%'";

// Aserciones post-limpieza: [label, sql, expected]
const ASSERTIONS = [
  // preservar
  ["Section", "SELECT COUNT(*) c FROM Section", 2],
  ["Domain", "SELECT COUNT(*) c FROM Domain", 8],
  ["Topic", "SELECT COUNT(*) c FROM Topic", 46],
  ["TaxonomyNode", "SELECT COUNT(*) c FROM TaxonomyNode", 57],
  ["Subskill", "SELECT COUNT(*) c FROM Subskill", 1],
  ["Program", "SELECT COUNT(*) c FROM Program", 1],
  ["ProgramTeacher", "SELECT COUNT(*) c FROM ProgramTeacher", 1],
  ["AppSetting", "SELECT COUNT(*) c FROM AppSetting", 5],
  ["FullPracticeTestScoreConversion", "SELECT COUNT(*) c FROM FullPracticeTestScoreConversion", 100],
  ["User ADMIN", "SELECT COUNT(*) c FROM User WHERE role='ADMIN'", 1],
  ["User TEACHER", "SELECT COUNT(*) c FROM User WHERE role='TEACHER'", 2],
  ["User total", "SELECT COUNT(*) c FROM User", 3],
  ["IngestQuestionCandidate", "SELECT COUNT(*) c FROM IngestQuestionCandidate", 2549],
  ["IngestBatch", "SELECT COUNT(*) c FROM IngestBatch", 1],
  // limpiar
  ["User STUDENT", "SELECT COUNT(*) c FROM User WHERE role='STUDENT'", 0],
  ["User PARENT", "SELECT COUNT(*) c FROM User WHERE role='PARENT'", 0],
  ["Question", "SELECT COUNT(*) c FROM Question", 0],
  ["PracticeSet", "SELECT COUNT(*) c FROM PracticeSet", 0],
  ["FullPracticeTest", "SELECT COUNT(*) c FROM FullPracticeTest", 0],
  ["StudyMaterial", "SELECT COUNT(*) c FROM StudyMaterial", 0],
  ["Assignment", "SELECT COUNT(*) c FROM Assignment", 0],
  ["Attempt", "SELECT COUNT(*) c FROM Attempt", 0],
  ["ProgramEnrollment", "SELECT COUNT(*) c FROM ProgramEnrollment", 0],
  ["ParentStudent", "SELECT COUNT(*) c FROM ParentStudent", 0],
  ["InviteToken", "SELECT COUNT(*) c FROM InviteToken", 0],
];

const db = new Database(DB_PATH);
const count = (t) => db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get().c;
const scalar = (sql) => db.prepare(sql).get().c;

console.log(`\n=== clean-demo-content (${APPLY ? "APPLY" : "DRY-RUN"}) sobre ${DB_PATH} ===\n`);

// Guardarraíl: no debe haber ningún candidato ya promovido (rompería trazabilidad).
const promoted = scalar(
  "SELECT COUNT(*) c FROM IngestQuestionCandidate WHERE officialQuestionId IS NOT NULL"
);
if (promoted > 0) {
  console.error(`ABORTA: ${promoted} candidatos de ingesta ya están promovidos (officialQuestionId != NULL).`);
  console.error("Este script asume que ningún Question proviene de ingesta. Revisar antes de continuar.");
  db.close();
  process.exit(1);
}

console.log("A vaciar (contenido demo):");
let total = 0;
for (const t of CLEAR_TABLES) {
  const n = count(t);
  total += n;
  console.log(`  ${t.padEnd(30)} ${n}`);
}
console.log("\nBorrados parciales:");
const usersToDelete = scalar("SELECT COUNT(*) c FROM User WHERE role IN ('STUDENT','PARENT')");
const auditToDelete = scalar("SELECT COUNT(*) c FROM AuditLog WHERE id LIKE 'audit-seed%'");
console.log(`  User STUDENT/PARENT            ${usersToDelete}`);
console.log(`  AuditLog seed rows            ${auditToDelete}`);
console.log(`\nTotal filas de contenido demo a borrar: ${total} (+ ${usersToDelete} users + ${auditToDelete} audit)\n`);

if (!APPLY) {
  console.log("DRY-RUN: nada modificado. Re-ejecuta con --apply para aplicar.");
  db.close();
  process.exit(0);
}

// ── APPLY ────────────────────────────────────────────────────────────────────
db.pragma("foreign_keys = OFF");
const tx = db.transaction(() => {
  for (const t of CLEAR_TABLES) db.prepare(`DELETE FROM "${t}"`).run();
  db.prepare(DELETE_USERS_SQL).run();
  db.prepare(DELETE_AUDIT_SQL).run();
});
tx();
db.pragma("foreign_keys = ON");

// Integridad referencial
const fkIssues = db.pragma("foreign_key_check");
if (Array.isArray(fkIssues) && fkIssues.length > 0) {
  console.error("ABORTA: foreign_key_check encontró referencias colgantes:");
  console.error(fkIssues.slice(0, 20));
  db.close();
  process.exit(1);
}
console.log("foreign_key_check: OK (sin huérfanos)\n");

// Aserciones
let failed = 0;
console.log("Aserciones de estado final:");
for (const [label, sql, expected] of ASSERTIONS) {
  const got = scalar(sql);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(32)} ${got}${ok ? "" : `  (esperado ${expected})`}`);
}
db.close();

if (failed > 0) {
  console.error(`\n${failed} aserción(es) fallaron. Restaurar desde ./backups si es necesario.`);
  process.exit(1);
}
console.log("\n✅ Base limpia: sin alumnos ni contenido demo; taxonomía, admin, 2 profes y staging de ingesta intactos.");
