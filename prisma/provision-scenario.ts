import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client.js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Provisión de la BASE del escenario de prueba (Sat Sol).
//
// Producción arranca con SOLO el admin (prisma/seed.prod.ts): no hay docente ni
// programa, y NINGÚN endpoint HTTP crea un teacher (los profes solo nacen del
// seed) — crear un Programa además exige un teacherId previo. Este script cubre
// ESE hueco y NADA MÁS:
//
//   1. Tutora (TEACHER, APPROVED, activa) con contraseña conocida
//   2. Programa activo
//   3. Asignación tutora ↔ programa
//
// El registro del ALUMNO NO se hace aquí: se hace con el flujo real de la app
// (`POST /api/students/invite` autenticado como la tutora), que envía la
// bienvenida al alumno y el consentimiento al apoderado, e inscribe en el
// programa al ACTIVAR (`/auth/activate`). Así el correo y la inscripción son los
// reales del producto, no una simulación.
//
// Además, LIMPIA cualquier alumno/apoderado de prueba creado por una corrida
// anterior (incluida la versión que pre-activaba), para que el invite no choque
// con "el usuario ya existe" y el flujo arranque desde cero.
//
// Es IDEMPOTENTE. La contraseña de la tutora se genera al azar la primera vez y
// se escribe en texto plano a .secrets/ (gitignored); en re-corridas NO se pisa.
//
// Uso (dentro del contenedor web):
//   docker compose exec web npx tsx prisma/provision-scenario.ts
// ─────────────────────────────────────────────────────────────────────────────

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const TEACHER_EMAIL = (process.env.SCENARIO_TEACHER_EMAIL ?? "tutora@satsol.org").trim().toLowerCase();
const TEACHER_NAME = process.env.SCENARIO_TEACHER_NAME ?? "Tutora Piloto";
const PROGRAM_NAME = process.env.SCENARIO_PROGRAM_NAME ?? "Programa SAT — Piloto";

// Alumno/apoderado de prueba a limpiar (los registra luego el invite real).
const STUDENT_EMAIL = (process.env.SCENARIO_STUDENT_EMAIL ?? "ricardo.bartra2000@gmail.com").trim().toLowerCase();
const PARENT_EMAIL = (process.env.SCENARIO_PARENT_EMAIL ?? "ricardo.bartra@pucp.edu.pe").trim().toLowerCase();
const CLEANUP = process.env.SCENARIO_CLEANUP !== "false"; // default: limpiar

const SECRETS_DIR = path.resolve(process.cwd(), ".secrets");
const CREDENTIALS_FILE = path.join(SECRETS_DIR, "prod-scenario-credentials.txt");

function genPassword(): string {
  return crypto.randomBytes(18).toString("base64url");
}

function writeCredentialsFile(teacherPassword: string | null, programId: string) {
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
  const body = [
    "# Sat Sol — base del escenario de prueba (PLAINTEXT, gitignored).",
    "# Generado por prisma/provision-scenario.ts. NO commitear. Rotar tras la prueba.",
    `# Generado: ${new Date().toISOString()}`,
    "",
    "## Docente (tutora) — usar para invitar al alumno vía la app",
    `TEACHER_EMAIL=${TEACHER_EMAIL}`,
    teacherPassword ? `TEACHER_PASSWORD=${teacherPassword}` : "TEACHER_PASSWORD=(sin cambios; ya existía)",
    `PROGRAM_ID=${programId}`,
    `PROGRAM_NAME=${PROGRAM_NAME}`,
    "",
    "# El alumno se registra con POST /api/students/invite (como la tutora);",
    "# recibe la bienvenida y crea su cuenta en /auth/activate?token=…, quedando",
    "# inscrito en el programa. El apoderado recibe el consentimiento.",
    "",
  ].join("\n");
  fs.writeFileSync(CREDENTIALS_FILE, body, { mode: 0o600 });
}

/** Limpia el alumno/apoderado de prueba y sus dependencias (FK-safe). */
async function cleanupTestUsers() {
  const student = await prisma.user.findUnique({ where: { email: STUDENT_EMAIL } });
  const parent = await prisma.user.findUnique({ where: { email: PARENT_EMAIL } });

  // Enlaces de reporte que apunten al alumno o al apoderado.
  const orAccess: { studentId?: string; parentId?: string }[] = [];
  if (student) orAccess.push({ studentId: student.id });
  if (parent) orAccess.push({ parentId: parent.id });
  if (orAccess.length) {
    const n = await prisma.parentAccessToken.deleteMany({ where: { OR: orAccess } });
    if (n.count) console.log(`  ⌫ ParentAccessToken borrados: ${n.count}`);
  }

  if (student) {
    await prisma.parentStudent.deleteMany({ where: { studentId: student.id } });
    await prisma.programEnrollment.deleteMany({ where: { studentId: student.id } });
  }
  // Invitaciones previas del alumno (para que el nuevo invite no choque).
  const inv = await prisma.inviteToken.deleteMany({ where: { email: STUDENT_EMAIL } });
  if (inv.count) console.log(`  ⌫ InviteToken previos del alumno: ${inv.count}`);

  if (student && student.role === "STUDENT") {
    await prisma.user.delete({ where: { id: student.id } });
    console.log(`  ⌫ Alumno de prueba borrado: ${STUDENT_EMAIL}`);
  }
  if (parent && parent.role === "PARENT") {
    const remaining = await prisma.parentStudent.count({ where: { parentId: parent.id } });
    if (remaining === 0) {
      await prisma.user.delete({ where: { id: parent.id } });
      console.log(`  ⌫ Apoderado de prueba borrado: ${PARENT_EMAIL}`);
    } else {
      console.log(`  •  Apoderado conservado (${remaining} vínculo(s) restantes): ${PARENT_EMAIL}`);
    }
  }
}

async function main() {
  console.log(`\n▶  Provisionando BASE del escenario contra ${url}\n`);

  // 0) Limpieza del alumno/apoderado de prueba ────────────────────────────────
  if (CLEANUP) {
    console.log("  Limpieza previa (alumno/apoderado de prueba):");
    await cleanupTestUsers();
  }

  // 1) Docente (el hueco sin API) ─────────────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email: TEACHER_EMAIL } });
  let teacherPassword: string | null = null;
  let teacherId: string;
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { name: TEACHER_NAME, role: "TEACHER", active: true, validationStatus: "APPROVED" },
    });
    teacherId = existing.id;
    console.log(`  ✓ Tutora: ${TEACHER_EMAIL} (ya existía; contraseña sin cambios)`);
  } else {
    teacherPassword = genPassword();
    const created = await prisma.user.create({
      data: {
        name: TEACHER_NAME,
        email: TEACHER_EMAIL,
        passwordHash: await bcrypt.hash(teacherPassword, 10),
        role: "TEACHER",
        active: true,
        validationStatus: "APPROVED",
        validationReviewedAt: new Date(),
      },
    });
    teacherId = created.id;
    console.log(`  ✓ Tutora creada: ${TEACHER_EMAIL}`);
  }

  // 2) Programa activo ────────────────────────────────────────────────────────
  let program = await prisma.program.findFirst({ where: { name: PROGRAM_NAME, deletedAt: null } });
  if (!program) {
    program = await prisma.program.create({ data: { name: PROGRAM_NAME, startDate: new Date(), active: true } });
    console.log(`  ✓ Programa creado: ${PROGRAM_NAME}`);
  } else {
    await prisma.program.update({ where: { id: program.id }, data: { active: true } });
    console.log(`  ✓ Programa ya existía: ${PROGRAM_NAME}`);
  }

  // 3) Asignación tutora ↔ programa ───────────────────────────────────────────
  await prisma.programTeacher.upsert({
    where: { programId_teacherId: { programId: program.id, teacherId } },
    update: { endDate: null },
    create: { programId: program.id, teacherId, startDate: new Date() },
  });
  console.log(`  ✓ Asignación tutora↔programa`);

  writeCredentialsFile(teacherPassword, program.id);

  console.log("\n────────────── BASE LISTA ──────────────");
  console.log(`  Tutora:      ${TEACHER_EMAIL}   pass=${teacherPassword ?? "(sin cambios)"}`);
  console.log(`  Programa:    ${PROGRAM_NAME}`);
  console.log(`  PROGRAM_ID:  ${program.id}`);
  console.log(`  Credenciales:${path.relative(process.cwd(), CREDENTIALS_FILE)} (gitignored)`);
  console.log("─────────────────────────────────────────\n");
  console.log("➡  Siguiente: invitar al alumno con POST /api/students/invite como la tutora.");
  console.log("   El alumno recibe la bienvenida (crea su cuenta) y queda inscrito al activar.\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
