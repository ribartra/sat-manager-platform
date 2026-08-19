import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client.js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
import bcrypt from "bcryptjs";
import { seedTaxonomy } from "./seed-taxonomy.js";

// ─────────────────────────────────────────────────────────────────────────────
// ESSENTIAL SEED — accounts + program + taxonomy + scoring tables ONLY.
//
// This does NOT create demo students, synthetic questions, Practice Sets,
// assignments, attempts or mock Full Practice Tests. Real academic content is
// produced by promoting reviewed AI-import candidates. The legacy demo generator
// lives in `prisma/seed.demo.ts` (disconnected; run it manually if ever needed).
// ─────────────────────────────────────────────────────────────────────────────

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ─── ADMIN ───────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@sat.com" },
    update: { active: true, validationStatus: "APPROVED" },
    create: {
      name: "SAT Admin",
      email: "admin@sat.com",
      passwordHash: adminHash,
      role: "ADMIN",
      active: true,
      validationStatus: "APPROVED",
    },
  });

  await Promise.all([
    prisma.appSetting.upsert({
      where: { key: "STUDENT_UNLOCK_REQUESTS" },
      update: { value: "false" },
      create: { key: "STUDENT_UNLOCK_REQUESTS", value: "false" },
    }),
    prisma.appSetting.upsert({
      where: { key: "STUDENT_SELF_ENROLLMENT" },
      update: { value: "false" },
      create: { key: "STUDENT_SELF_ENROLLMENT", value: "false" },
    }),
    prisma.appSetting.upsert({
      where: { key: "TEACHER_PROGRAM_MANAGEMENT" },
      update: { value: "false" },
      create: { key: "TEACHER_PROGRAM_MANAGEMENT", value: "false" },
    }),
    prisma.appSetting.upsert({
      where: { key: "TEACHER_GROUP_MANAGEMENT" },
      update: { value: "false" },
      create: { key: "TEACHER_GROUP_MANAGEMENT", value: "false" },
    }),
    prisma.appSetting.upsert({
      where: { key: "QUESTION_GRAPH_VISUALIZATION" },
      update: { value: "false" },
      create: { key: "QUESTION_GRAPH_VISUALIZATION", value: "false" },
    }),
    prisma.appSetting.upsert({
      where: { key: "MATERIALS_MODULE" },
      update: { value: "false" },
      create: { key: "MATERIALS_MODULE", value: "false" },
    }),
  ]);

  // ─── TEACHERS ────────────────────────────────────────────────────────────────
  const teacherHash = await bcrypt.hash("teacher123", 10);
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@sat.com" },
    update: { active: true, validationStatus: "APPROVED" },
    create: {
      name: "SAT Teacher",
      email: "teacher@sat.com",
      passwordHash: teacherHash,
      role: "TEACHER",
      active: true,
      validationStatus: "APPROVED",
    },
  });

  // Teacher pendiente de validación (no asignado a ningún programa)
  await prisma.user.upsert({
    where: { email: "teacher.pending@sat.com" },
    update: {},
    create: {
      name: "Carlos Ruiz",
      email: "teacher.pending@sat.com",
      passwordHash: teacherHash,
      role: "TEACHER",
      active: true,
      validationStatus: "PENDING",
    },
  });

  // ─── PROGRAMA ─────────────────────────────────────────────────────────────────
  const defaultProgram = await prisma.program.upsert({
    where: { id: "program-sat-core" },
    update: { active: true },
    create: {
      id: "program-sat-core",
      name: "SAT Core Program",
      startDate: new Date("2026-04-01"),
      endDate: null,
      active: true,
    },
  });

  await prisma.programTeacher.upsert({
    where: { programId_teacherId: { programId: defaultProgram.id, teacherId: teacher.id } },
    update: {},
    create: {
      programId: defaultProgram.id,
      teacherId: teacher.id,
      startDate: new Date("2026-04-01"),
      endDate: null,
    },
  });

  // ─── TAXONOMÍA ACADÉMICA ──────────────────────────────────────────────────────
  // Single source of truth in prisma/seed-taxonomy.ts (shared with seed.prod.ts).
  await seedTaxonomy(prisma);

  // ─── TABLAS DE CONVERSIÓN DE PUNTAJE (Full Practice Test) ─────────────────────
  // Datos reales de scoring, NO demo: se conservan siempre para poder puntuar
  // los Full Practice Tests que se promuevan desde ingesta.
  for (const section of ["RW", "MATH"] as const) {
    const maxRaw = section === "RW" ? 50 : 40;
    for (let rawCorrect = 0; rawCorrect <= maxRaw; rawCorrect += 1) {
      const score = Math.round((200 + (rawCorrect / maxRaw) * 600) / 10) * 10;
      await prisma.fullPracticeTestScoreConversion.upsert({
        where: { section_rawCorrect: { section, rawCorrect } },
        update: { score },
        create: { section, rawCorrect, score },
      });
    }
  }

  // ─── RESUMEN ──────────────────────────────────────────────────────────────────
  console.log("\n✅  Seed esencial completo (sin contenido demo)\n");
  console.log("ADMIN");
  console.log("  admin@sat.com          / admin123      (APPROVED)");
  console.log("");
  console.log("TEACHER");
  console.log("  teacher@sat.com        / teacher123    (APPROVED) — SAT Core Program");
  console.log("  teacher.pending@sat.com/ teacher123    (PENDING)  — sin programa");
  console.log("");
  console.log("Contenido académico: se crea promoviendo candidatos de AI Import.");
  console.log("Demo legacy (opcional): SEED_DEMO_ACADEMIC_CONTENT=true tsx prisma/seed.demo.ts");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
