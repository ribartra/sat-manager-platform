import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client.js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ─── ADMIN ───────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
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

  // ─── STUDENTS (inscritos, APPROVED) ──────────────────────────────────────────
  const studentHash = await bcrypt.hash("student123", 10);
  const students = await Promise.all(
    ["Ana Torres", "Luis Mora", "Sofia Rea", "Carlos Vera"].map((name, i) =>
      prisma.user.upsert({
        where: { email: `student${i + 1}@sat.com` },
        update: { active: true, validationStatus: "APPROVED" },
        create: {
          name,
          email: `student${i + 1}@sat.com`,
          passwordHash: studentHash,
          role: "STUDENT",
          phone: `+51 9${i}0000000`,
          startDate: new Date("2026-04-01"),
          active: true,
          validationStatus: "APPROVED",
        },
      })
    )
  );

  await Promise.all(
    students.map((student) =>
      prisma.programEnrollment.upsert({
        where: { programId_studentId: { programId: defaultProgram.id, studentId: student.id } },
        update: { active: true, status: "APPROVED" },
        create: {
          programId: defaultProgram.id,
          studentId: student.id,
          status: "APPROVED",
          active: true,
        },
      })
    )
  );

  // ─── STUDENTS (estados intermedios, sin programa) ─────────────────────────────

  // Alumno recién registrado — validación PENDIENTE (esperando aprobación del admin)
  const studentPending = await prisma.user.upsert({
    where: { email: "student.pending@sat.com" },
    update: {},
    create: {
      name: "Marco Díaz",
      email: "student.pending@sat.com",
      passwordHash: studentHash,
      role: "STUDENT",
      phone: "+51 940000000",
      active: true,
      validationStatus: "PENDING",
    },
  });

  // Alumno cuya cuenta fue rechazada (documentos inválidos, etc.)
  await prisma.user.upsert({
    where: { email: "student.rejected@sat.com" },
    update: {},
    create: {
      name: "Valeria Lagos",
      email: "student.rejected@sat.com",
      passwordHash: studentHash,
      role: "STUDENT",
      phone: "+51 950000000",
      active: false,
      validationStatus: "REJECTED",
    },
  });

  // Alumno aprobado pero AÚN SIN INSCRIBIRSE a ningún programa
  // (verá la lista de programas disponibles y podrá solicitar inscripción)
  await prisma.user.upsert({
    where: { email: "student.noenroll@sat.com" },
    update: {},
    create: {
      name: "Diego Fuentes",
      email: "student.noenroll@sat.com",
      passwordHash: studentHash,
      role: "STUDENT",
      phone: "+51 960000000",
      active: true,
      validationStatus: "APPROVED",
    },
  });

  // Alumno con solicitud de inscripción PENDIENTE (esperando aprobación del teacher/admin)
  const studentEnrollPending = await prisma.user.upsert({
    where: { email: "student.enrollpending@sat.com" },
    update: {},
    create: {
      name: "Lucía Paredes",
      email: "student.enrollpending@sat.com",
      passwordHash: studentHash,
      role: "STUDENT",
      phone: "+51 970000000",
      active: true,
      validationStatus: "APPROVED",
    },
  });
  await prisma.programEnrollment.upsert({
    where: { programId_studentId: { programId: defaultProgram.id, studentId: studentEnrollPending.id } },
    update: {},
    create: {
      programId: defaultProgram.id,
      studentId: studentEnrollPending.id,
      status: "PENDING",
      active: false,
    },
  });

  // ─── PADRES ───────────────────────────────────────────────────────────────────
  const parentHash = await bcrypt.hash("parent123", 10);

  // Padre aprobado vinculado a Ana Torres (student1)
  const parent = await prisma.user.upsert({
    where: { email: "parent@sat.com" },
    update: { active: true, validationStatus: "APPROVED" },
    create: {
      name: "Rosa Torres",
      email: "parent@sat.com",
      passwordHash: parentHash,
      role: "PARENT",
      phone: "+51 980000000",
      active: true,
      validationStatus: "APPROVED",
    },
  });
  await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: students[0].id } },
    update: { authorizedAt: new Date("2026-04-01") },
    create: { parentId: parent.id, studentId: students[0].id, authorizedAt: new Date("2026-04-01") },
  });

  // Padre pendiente de validación, sin alumno vinculado aún
  await prisma.user.upsert({
    where: { email: "parent.pending@sat.com" },
    update: {},
    create: {
      name: "Jorge Mora",
      email: "parent.pending@sat.com",
      passwordHash: parentHash,
      role: "PARENT",
      phone: "+51 990000000",
      active: true,
      validationStatus: "PENDING",
    },
  });

  // Vinculación padre pendiente → alumno Marco Díaz
  await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: studentPending.id } },
    update: {},
    create: { parentId: parent.id, studentId: studentPending.id, authorizedAt: null },
  });

  // ─── MENOR DE EDAD + PADRE ───────────────────────────────────────────────────
  //
  // Caso: Carlos Mendoza (16 años) solicita inscripción.
  // Su padre Pedro Mendoza debe aprobar primero; luego el profesor aprueba.
  // Se crean DOS variantes:
  //   (A) student.minor — esperando aprobación del padre (parentApprovalStatus = PENDING)
  //   (B) student.minor2 — padre ya aprobó, esperando al profesor (parentApprovalStatus = APPROVED)

  const studentMinorA = await prisma.user.upsert({
    where: { email: "student.minor@sat.com" },
    update: { active: true, validationStatus: "APPROVED" },
    create: {
      name: "Carlos Mendoza",
      email: "student.minor@sat.com",
      passwordHash: studentHash,
      role: "STUDENT",
      phone: "+51 910000000",
      birthDate: new Date("2009-06-01"), // 16 años en 2026
      active: true,
      validationStatus: "APPROVED",
    },
  });

  const studentMinorB = await prisma.user.upsert({
    where: { email: "student.minor2@sat.com" },
    update: { active: true, validationStatus: "APPROVED" },
    create: {
      name: "Valeria Cano",
      email: "student.minor2@sat.com",
      passwordHash: studentHash,
      role: "STUDENT",
      phone: "+51 911000000",
      birthDate: new Date("2010-03-15"), // 16 años en 2026
      active: true,
      validationStatus: "APPROVED",
    },
  });

  // Padre de Carlos y Valeria
  const parentMinor = await prisma.user.upsert({
    where: { email: "parent.minor@sat.com" },
    update: { active: true, validationStatus: "APPROVED" },
    create: {
      name: "Pedro Mendoza",
      email: "parent.minor@sat.com",
      passwordHash: parentHash,
      role: "PARENT",
      phone: "+51 912000000",
      active: true,
      validationStatus: "APPROVED",
    },
  });

  await Promise.all([
    prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parentMinor.id, studentId: studentMinorA.id } },
      update: {},
      create: { parentId: parentMinor.id, studentId: studentMinorA.id, authorizedAt: new Date("2026-01-10") },
    }),
    prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parentMinor.id, studentId: studentMinorB.id } },
      update: {},
      create: { parentId: parentMinor.id, studentId: studentMinorB.id, authorizedAt: new Date("2026-01-10") },
    }),
  ]);

  // Inscripción A: esperando aprobación del padre
  await prisma.programEnrollment.upsert({
    where: { programId_studentId: { programId: defaultProgram.id, studentId: studentMinorA.id } },
    update: {},
    create: {
      programId: defaultProgram.id,
      studentId: studentMinorA.id,
      status: "PENDING",
      active: false,
      parentApprovalStatus: "PENDING",
    },
  });

  // Inscripción B: padre aprobó, esperando al profesor
  await prisma.programEnrollment.upsert({
    where: { programId_studentId: { programId: defaultProgram.id, studentId: studentMinorB.id } },
    update: {},
    create: {
      programId: defaultProgram.id,
      studentId: studentMinorB.id,
      status: "PENDING",
      active: false,
      parentApprovalStatus: "APPROVED",
      parentApprovedAt: new Date("2026-06-09"),
    },
  });

  // ─── GRUPOS ───────────────────────────────────────────────────────────────────
  const groupA = await prisma.group.upsert({
    where: { id: "group-a" },
    update: {},
    create: { id: "group-a", name: "Group A", schedule: "Monday/Wednesday 9am" },
  });
  const groupB = await prisma.group.upsert({
    where: { id: "group-b" },
    update: {},
    create: { id: "group-b", name: "Group B", schedule: "Tuesday/Thursday 3pm" },
  });

  await Promise.all([
    prisma.groupMembership.upsert({
      where: { userId_groupId: { userId: students[0].id, groupId: groupA.id } },
      update: {},
      create: { userId: students[0].id, groupId: groupA.id },
    }),
    prisma.groupMembership.upsert({
      where: { userId_groupId: { userId: students[1].id, groupId: groupA.id } },
      update: {},
      create: { userId: students[1].id, groupId: groupA.id },
    }),
    prisma.groupMembership.upsert({
      where: { userId_groupId: { userId: students[2].id, groupId: groupB.id } },
      update: {},
      create: { userId: students[2].id, groupId: groupB.id },
    }),
    prisma.groupMembership.upsert({
      where: { userId_groupId: { userId: students[3].id, groupId: groupB.id } },
      update: {},
      create: { userId: students[3].id, groupId: groupB.id },
    }),
  ]);

  // ─── TAXONOMÍA ACADÉMICA ──────────────────────────────────────────────────────
  const mathSection = await prisma.section.upsert({
    where: { name: "MATH" },
    update: {},
    create: { name: "MATH", label: "Mathematics" },
  });
  const rwSection = await prisma.section.upsert({
    where: { name: "READING_WRITING" },
    update: {},
    create: { name: "READING_WRITING", label: "Reading & Writing" },
  });

  const mathDomains = await Promise.all([
    prisma.domain.upsert({ where: { id: "dom-algebra" }, update: {}, create: { id: "dom-algebra", name: "Algebra", sectionId: mathSection.id } }),
    prisma.domain.upsert({ where: { id: "dom-advmath" }, update: {}, create: { id: "dom-advmath", name: "Advanced Math", sectionId: mathSection.id } }),
    prisma.domain.upsert({ where: { id: "dom-psda" }, update: {}, create: { id: "dom-psda", name: "Problem Solving and Data Analysis", sectionId: mathSection.id } }),
    prisma.domain.upsert({ where: { id: "dom-geotrig" }, update: {}, create: { id: "dom-geotrig", name: "Geometry and Trigonometry", sectionId: mathSection.id } }),
  ]);

  const rwDomains = await Promise.all([
    prisma.domain.upsert({ where: { id: "dom-info" }, update: {}, create: { id: "dom-info", name: "Information and Ideas", sectionId: rwSection.id } }),
    prisma.domain.upsert({ where: { id: "dom-craft" }, update: {}, create: { id: "dom-craft", name: "Craft and Structure", sectionId: rwSection.id } }),
    prisma.domain.upsert({ where: { id: "dom-expr" }, update: {}, create: { id: "dom-expr", name: "Expression of Ideas", sectionId: rwSection.id } }),
    prisma.domain.upsert({ where: { id: "dom-sec" }, update: {}, create: { id: "dom-sec", name: "Standard English Conventions", sectionId: rwSection.id } }),
  ]);

  const topicDefs: Record<string, { id: string; name: string }[]> = {
    "dom-algebra": [
      { id: "top-lineq", name: "Linear Equations" },
      { id: "top-syseq", name: "Systems of Equations" },
      { id: "top-ineq", name: "Inequalities" },
      { id: "top-linfn", name: "Linear Functions" },
    ],
    "dom-advmath": [
      { id: "top-quadfn", name: "Quadratic Functions" },
      { id: "top-poly", name: "Polynomials" },
      { id: "top-expfn", name: "Exponential Functions" },
      { id: "top-radeq", name: "Radical Equations" },
    ],
    "dom-psda": [
      { id: "top-ratprop", name: "Ratios and Proportions" },
      { id: "top-pct", name: "Percentages" },
      { id: "top-stats", name: "Statistics" },
      { id: "top-prob", name: "Probability" },
    ],
    "dom-geotrig": [
      { id: "top-circles", name: "Circles" },
      { id: "top-tri", name: "Triangles" },
      { id: "top-trig", name: "Trigonometry" },
      { id: "top-vol", name: "Volume and Area" },
    ],
    "dom-info": [
      { id: "top-central", name: "Central Ideas" },
      { id: "top-textev", name: "Textual Evidence" },
      { id: "top-infer", name: "Inferences" },
      { id: "top-cross", name: "Cross-Text Connections" },
    ],
    "dom-craft": [
      { id: "top-wic", name: "Words in Context" },
      { id: "top-texstr", name: "Text Structure" },
      { id: "top-authpur", name: "Author Purpose" },
    ],
    "dom-expr": [
      { id: "top-rhet", name: "Rhetorical Synthesis" },
      { id: "top-trans", name: "Transitions" },
    ],
    "dom-sec": [
      { id: "top-bound", name: "Boundaries" },
      { id: "top-fss", name: "Form, Structure, and Sense" },
    ],
  };

  const allDomains = [...mathDomains, ...rwDomains];
  for (const domain of allDomains) {
    const defs = topicDefs[domain.id] ?? [];
    await Promise.all(
      defs.map((t) =>
        prisma.topic.upsert({ where: { id: t.id }, update: {}, create: { id: t.id, name: t.name, domainId: domain.id } })
      )
    );
  }

  // ─── PREGUNTAS Y PRACTICE SETS ───────────────────────────────────────────────
  const seedPracticeIds = {
    qLineq1: "0f9b47a1-5f5c-45bb-9df1-0a7f1db3d111",
    qLineq2: "7b26dd75-9ae2-46fc-8bfb-d7e0e4c9f222",
    qLineq3: "b5c7fb90-93d8-4b8d-b58a-75b2cc8cf333",
    qLineq4: "c1e75061-d321-46f8-a07d-0b0f02d4d444",
    qLineq5: "9f15f9de-c32a-4c13-a717-b825ca41f555",
    psLineqEasy1: "7311688e-43ad-4a66-bc1d-a7167ddf6111",
    psLineqMedium1: "e6e8a1db-6f31-4f0e-9f87-b7f0342b6222",
    psLineqEasy2: "e59a4208-e22b-4758-af45-c92a63a26333",
    anaPs1Assignment: "8559bf63-78d4-42da-b9d1-c2f1f61b7111",
    luisPs1Assignment: "24ddf2fb-358e-4760-8df9-cfc27f997222",
    anaPs2Assignment: "6bcbb7d8-7bcf-4a42-9bbb-39c264565333",
    anaPs2UnlockRequest: "1e7d1e54-2bec-4a20-9359-c5a56944c444",
    anaPs1SubmittedAttempt: "03841e9d-b94e-48fe-9d06-5a8d83e08555",
  };

  const q1 = await prisma.question.upsert({
    where: { id: seedPracticeIds.qLineq1 },
    update: { supportsGraph: false },
    create: {
      id: seedPracticeIds.qLineq1,
      stem: "Which value of $x$ satisfies $2x + 6 = 14$?",
      type: "MC", difficulty: "EASY", correctAnswer: "C",
      explanation: "Subtract 6 from both sides: $2x = 8$. Divide by 2: $x = 4$.",
      topicId: "top-lineq", status: "PUBLISHED",
      supportsGraph: false,
      options: { create: [{ label: "A", text: "$x = 2$" }, { label: "B", text: "$x = 3$" }, { label: "C", text: "$x = 4$" }, { label: "D", text: "$x = 5$" }] },
    },
  });
  const q2 = await prisma.question.upsert({
    where: { id: seedPracticeIds.qLineq2 },
    update: { supportsGraph: false },
    create: {
      id: seedPracticeIds.qLineq2,
      stem: "If $3x - 9 = 0$, what is the value of $x$?",
      type: "NUMERIC", difficulty: "EASY", correctAnswer: "3",
      explanation: "Add 9: $3x = 9$. Divide by 3: $x = 3$.",
      topicId: "top-lineq", status: "PUBLISHED",
      supportsGraph: false,
    },
  });
  const q3 = await prisma.question.upsert({
    where: { id: seedPracticeIds.qLineq3 },
    update: { supportsGraph: true },
    create: {
      id: seedPracticeIds.qLineq3,
      stem: "A line passes through $(0, 4)$ and $(2, 0)$. Which equation represents this line?",
      type: "MC", difficulty: "EASY", correctAnswer: "B",
      explanation: "Slope $= -2$. $y = -2x + 4$.",
      topicId: "top-lineq", status: "PUBLISHED",
      supportsGraph: true,
      options: { create: [{ label: "A", text: "$y = 2x + 4$" }, { label: "B", text: "$y = -2x + 4$" }, { label: "C", text: "$y = -2x - 4$" }, { label: "D", text: "$y = 2x - 4$" }] },
    },
  });
  const q4 = await prisma.question.upsert({
    where: { id: seedPracticeIds.qLineq4 },
    update: { supportsGraph: false },
    create: {
      id: seedPracticeIds.qLineq4,
      stem: "The equation $4x + 2y = 16$ in slope-intercept form is:",
      type: "MC", difficulty: "MEDIUM", correctAnswer: "A",
      explanation: "$y = -2x + 8$.",
      topicId: "top-lineq", status: "PUBLISHED",
      supportsGraph: false,
      options: { create: [{ label: "A", text: "$y = -2x + 8$" }, { label: "B", text: "$y = 2x + 8$" }, { label: "C", text: "$y = -2x - 8$" }, { label: "D", text: "$y = 4x + 8$" }] },
    },
  });
  const q5 = await prisma.question.upsert({
    where: { id: seedPracticeIds.qLineq5 },
    update: { supportsGraph: false },
    create: {
      id: seedPracticeIds.qLineq5,
      stem: "If $5(x - 2) = 3x + 4$, what is $x$?",
      type: "NUMERIC", difficulty: "MEDIUM", correctAnswer: "7",
      explanation: "$5x - 10 = 3x + 4$ → $x = 7$.",
      topicId: "top-lineq", status: "PUBLISHED",
      supportsGraph: false,
    },
  });

  const ps1 = await prisma.practiceSet.upsert({
    where: { id: seedPracticeIds.psLineqEasy1 },
    update: {},
    create: {
      id: seedPracticeIds.psLineqEasy1,
      name: "Linear Equations — Easy #1",
      topicId: "top-lineq", difficulty: "EASY", status: "PUBLISHED",
      explanationVisibility: "AFTER_FINISH",
      questions: { create: [{ questionId: q1.id, order: 1 }, { questionId: q2.id, order: 2 }, { questionId: q3.id, order: 3 }] },
    },
  });
  const ps2 = await prisma.practiceSet.upsert({
    where: { id: seedPracticeIds.psLineqMedium1 },
    update: {},
    create: {
      id: seedPracticeIds.psLineqMedium1,
      name: "Linear Equations — Medium #1",
      topicId: "top-lineq", difficulty: "MEDIUM", status: "PUBLISHED",
      explanationVisibility: "HIDDEN",
      questions: { create: [{ questionId: q4.id, order: 1 }, { questionId: q5.id, order: 2 }] },
    },
  });
  const ps3 = await prisma.practiceSet.upsert({
    where: { id: seedPracticeIds.psLineqEasy2 },
    update: {},
    create: {
      id: seedPracticeIds.psLineqEasy2,
      name: "Linear Equations — Easy #2",
      topicId: "top-lineq", difficulty: "EASY", status: "PUBLISHED",
      explanationVisibility: "AFTER_FINISH",
      questions: { create: [{ questionId: q1.id, order: 1 }, { questionId: q2.id, order: 2 }] },
    },
  });

  // Assignments para Ana Torres (student1)
  await prisma.assignment.upsert({
    where: { id: seedPracticeIds.anaPs1Assignment },
    update: {},
    create: {
      id: seedPracticeIds.anaPs1Assignment,
      practiceSetId: ps1.id, studentId: students[0].id,
      assignedById: teacher.id, dueDate: new Date("2026-06-15"),
      status: "PENDING", locked: false,
    },
  });
  await prisma.assignment.upsert({
    where: { id: seedPracticeIds.luisPs1Assignment },
    update: { dueDate: new Date("2026-06-01"), status: "PENDING", locked: false },
    create: {
      id: seedPracticeIds.luisPs1Assignment,
      practiceSetId: ps1.id, studentId: students[1].id,
      assignedById: teacher.id, dueDate: new Date("2026-06-01"), status: "PENDING", locked: false,
    },
  });
  const anaLockedAssignment = await prisma.assignment.upsert({
    where: { id: seedPracticeIds.anaPs2Assignment },
    update: { status: "PENDING", locked: true },
    create: {
      id: seedPracticeIds.anaPs2Assignment,
      practiceSetId: ps2.id, studentId: students[0].id,
      assignedById: teacher.id, status: "PENDING", locked: true,
    },
  });

  await prisma.unlockRequest.upsert({
    where: { id: seedPracticeIds.anaPs2UnlockRequest },
    update: { status: "PENDING", resolvedAt: null },
    create: {
      id: seedPracticeIds.anaPs2UnlockRequest,
      assignmentId: anaLockedAssignment.id,
      studentId: students[0].id,
      status: "PENDING",
    },
  });

  const ps1Snapshot = JSON.stringify({
    id: ps1.id,
    name: "Linear Equations — Easy #1",
    difficulty: "EASY",
    explanationVisibility: "AFTER_FINISH",
    topic: { id: "top-lineq", name: "Linear Equations" },
    questions: [
      { id: q1.id, order: 1 },
      { id: q2.id, order: 2 },
      { id: q3.id, order: 3 },
    ],
  });
  const questionSnapshots = new Map([
    [q1.id, JSON.stringify({ id: q1.id, stem: q1.stem, stimulus: q1.stimulus, type: q1.type, difficulty: q1.difficulty, correctAnswer: q1.correctAnswer, explanation: q1.explanation, topic: { id: "top-lineq", name: "Linear Equations" }, options: [{ label: "A", text: "$x = 2$" }, { label: "B", text: "$x = 3$" }, { label: "C", text: "$x = 4$" }, { label: "D", text: "$x = 5$" }] })],
    [q2.id, JSON.stringify({ id: q2.id, stem: q2.stem, stimulus: q2.stimulus, type: q2.type, difficulty: q2.difficulty, correctAnswer: q2.correctAnswer, explanation: q2.explanation, topic: { id: "top-lineq", name: "Linear Equations" } })],
    [q3.id, JSON.stringify({ id: q3.id, stem: q3.stem, stimulus: q3.stimulus, type: q3.type, difficulty: q3.difficulty, correctAnswer: q3.correctAnswer, explanation: q3.explanation, topic: { id: "top-lineq", name: "Linear Equations" }, options: [{ label: "A", text: "$y = 2x + 4$" }, { label: "B", text: "$y = -2x + 4$" }, { label: "C", text: "$y = -2x - 4$" }, { label: "D", text: "$y = 2x - 4$" }] })],
  ]);

  const anaSubmittedAttempt = await prisma.attempt.upsert({
    where: { id: seedPracticeIds.anaPs1SubmittedAttempt },
    update: {
      status: "SUBMITTED",
      submittedAt: new Date("2026-06-05T15:00:00Z"),
      totalTime: 420,
      practiceSetSnapshot: ps1Snapshot,
    },
    create: {
      id: seedPracticeIds.anaPs1SubmittedAttempt,
      assignmentId: seedPracticeIds.anaPs1Assignment,
      studentId: students[0].id,
      practiceSetId: ps1.id,
      practiceSetSnapshot: ps1Snapshot,
      attemptNumber: 1,
      status: "SUBMITTED",
      submittedAt: new Date("2026-06-05T15:00:00Z"),
      totalTime: 420,
    },
  });
  await Promise.all([
    prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: anaSubmittedAttempt.id, questionId: q1.id } },
      update: { answer: "C", isCorrect: true, timeSpent: 80, questionSnapshot: questionSnapshots.get(q1.id) },
      create: { attemptId: anaSubmittedAttempt.id, questionId: q1.id, answer: "C", isCorrect: true, timeSpent: 80, questionSnapshot: questionSnapshots.get(q1.id) },
    }),
    prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: anaSubmittedAttempt.id, questionId: q2.id } },
      update: { answer: "3", isCorrect: true, timeSpent: 120, questionSnapshot: questionSnapshots.get(q2.id) },
      create: { attemptId: anaSubmittedAttempt.id, questionId: q2.id, answer: "3", isCorrect: true, timeSpent: 120, questionSnapshot: questionSnapshots.get(q2.id) },
    }),
    prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: anaSubmittedAttempt.id, questionId: q3.id } },
      update: { answer: null, isCorrect: false, timeSpent: 90, questionSnapshot: questionSnapshots.get(q3.id) },
      create: { attemptId: anaSubmittedAttempt.id, questionId: q3.id, answer: null, isCorrect: false, timeSpent: 90, questionSnapshot: questionSnapshots.get(q3.id) },
    }),
  ]);

  await prisma.assignment.update({
    where: { id: seedPracticeIds.anaPs1Assignment },
    data: { status: "COMPLETED" },
  });

  await prisma.auditLog.upsert({
    where: { id: "audit-seed-transition-note" },
    update: {},
    create: {
      id: "audit-seed-transition-note",
      userId: admin.id,
      action: "SEED_QA_TRANSITION_READY",
      targetType: "PracticeSet",
      targetId: ps3.id,
      metadata: JSON.stringify({
        sameLevelTarget: ps3.id,
        nextDifficultyTarget: ps2.id,
        note: "Submit a valid >=70% attempt on the first easy linear-equations Practice Set to auto-create/unlock Easy #2; >=75% attempts should not bypass Ana's manual lock on Medium #1.",
      }),
    },
  });

  // ─── FULL PRACTICE TESTS / MOCK EXAMS ────────────────────────────────────────
  const rwTopicIds = [
    "top-central",
    "top-textev",
    "top-infer",
    "top-cross",
    "top-wic",
    "top-texstr",
    "top-authpur",
    "top-rhet",
    "top-trans",
    "top-bound",
    "top-fss",
  ];
  const mathTopicIds = [
    "top-lineq",
    "top-syseq",
    "top-ineq",
    "top-linfn",
    "top-quadfn",
    "top-poly",
    "top-expfn",
    "top-radeq",
    "top-ratprop",
    "top-pct",
    "top-stats",
    "top-prob",
    "top-circles",
    "top-tri",
    "top-trig",
    "top-vol",
  ];
  const difficulties = ["EASY", "MEDIUM", "HARD"] as const;

  for (const section of ["RW", "MATH"] as const) {
    const maxRaw = section === "RW" ? 54 : 44;
    for (let rawCorrect = 0; rawCorrect <= maxRaw; rawCorrect += 1) {
      const score = Math.round((200 + (rawCorrect / maxRaw) * 600) / 10) * 10;
      await prisma.fullPracticeTestScoreConversion.upsert({
        where: { section_rawCorrect: { section, rawCorrect } },
        update: { score },
        create: { section, rawCorrect, score },
      });
    }
  }

  async function createMockQuestion({
    id,
    section,
    testNumber,
    moduleNumber,
    order,
  }: {
    id: string;
    section: "RW" | "MATH";
    testNumber: number;
    moduleNumber: number;
    order: number;
  }) {
    const topicIds = section === "RW" ? rwTopicIds : mathTopicIds;
    const topicId = topicIds[(testNumber + moduleNumber + order) % topicIds.length];
    const difficulty = difficulties[(testNumber + order) % difficulties.length];
    const isNumeric = section === "MATH" && order % 4 === 0;
    const correctAnswer = isNumeric ? String((testNumber + moduleNumber + order) % 9 + 1) : ["A", "B", "C", "D"][order % 4];
    const stem =
      section === "RW"
        ? `Full Practice Test ${testNumber}, RW Module ${moduleNumber}, Question ${order}: Which choice best supports the claim in the passage?`
        : isNumeric
        ? `Full Practice Test ${testNumber}, Math Module ${moduleNumber}, Question ${order}: If $x + ${order} = ${order + Number(correctAnswer)}$, what is $x$?`
        : `Full Practice Test ${testNumber}, Math Module ${moduleNumber}, Question ${order}: Which expression is equivalent to $${order}(x + 2)$?`;
    const stimulus =
      section === "RW"
        ? `Passage for mock ${testNumber}.${moduleNumber}.${order}: A short academic paragraph is provided here so QA can validate long reading content in a fixed SAT module.`
        : null;

    return prisma.question.upsert({
      where: { id },
      update: {},
      create: {
        id,
        stem,
        stimulus,
        type: isNumeric ? "NUMERIC" : "MC",
        difficulty,
        correctAnswer,
        explanation:
          section === "RW"
            ? "The correct choice is the one that most directly supports the stated claim."
            : isNumeric
            ? `Subtract ${order} from both sides to get ${correctAnswer}.`
            : "Distribute the coefficient across the parentheses and compare with the choices.",
        topicId,
        status: "PUBLISHED",
        options: isNumeric
          ? undefined
          : {
              create: [
                { label: "A", text: section === "RW" ? "Choice A" : `$${order}x + ${order * 2}$` },
                { label: "B", text: section === "RW" ? "Choice B" : `$${order}x + 2$` },
                { label: "C", text: section === "RW" ? "Choice C" : `$x + ${order * 2}$` },
                { label: "D", text: section === "RW" ? "Choice D" : `$${order + 2}x$` },
              ],
            },
      },
    });
  }

  async function seedFullPracticeTest(testNumber: number) {
    const testId = `fpt-mock-${testNumber}`;
    const test = await prisma.fullPracticeTest.upsert({
      where: { id: testId },
      update: { name: `Full Practice Test #${testNumber}`, status: "PUBLISHED", reviewEnabled: true },
      create: {
        id: testId,
        name: `Full Practice Test #${testNumber}`,
        status: "PUBLISHED",
        reviewEnabled: true,
      },
    });

    const moduleDefs = [
      { id: `${testId}-rw-m1`, name: "Reading & Writing Module 1", section: "RW" as const, order: 0, timeLimit: 32 * 60, count: 27, moduleNumber: 1 },
      { id: `${testId}-rw-m2`, name: "Reading & Writing Module 2", section: "RW" as const, order: 1, timeLimit: 32 * 60, count: 27, moduleNumber: 2 },
      { id: `${testId}-math-m1`, name: "Math Module 1", section: "MATH" as const, order: 2, timeLimit: 35 * 60, count: 22, moduleNumber: 1 },
      { id: `${testId}-math-m2`, name: "Math Module 2", section: "MATH" as const, order: 3, timeLimit: 35 * 60, count: 22, moduleNumber: 2 },
    ];

    for (const moduleDef of moduleDefs) {
      const testModule = await prisma.fullPracticeTestModule.upsert({
        where: { id: moduleDef.id },
        update: {
          name: moduleDef.name,
          section: moduleDef.section,
          order: moduleDef.order,
          timeLimit: moduleDef.timeLimit,
        },
        create: {
          id: moduleDef.id,
          testId: test.id,
          name: moduleDef.name,
          section: moduleDef.section,
          order: moduleDef.order,
          timeLimit: moduleDef.timeLimit,
        },
      });
      await prisma.fullPracticeTestQuestion.deleteMany({ where: { moduleId: testModule.id } });

      for (let order = 1; order <= moduleDef.count; order += 1) {
        const question = await createMockQuestion({
          id: `${testModule.id}-q${String(order).padStart(2, "0")}`,
          section: moduleDef.section,
          testNumber,
          moduleNumber: moduleDef.moduleNumber,
          order,
        });
        await prisma.fullPracticeTestQuestion.create({
          data: { moduleId: testModule.id, questionId: question.id, order },
        });
      }
    }

    return test;
  }

  const fullPracticeTests: { id: string; name: string }[] = [];
  for (let testNumber = 1; testNumber <= 8; testNumber += 1) {
    fullPracticeTests.push(await seedFullPracticeTest(testNumber));
  }

  const seedExamIds = {
    anaMock1Assignment: "7e3c3c2a-1f20-4e5b-8bd6-f74d3df8a111",
    luisMock2Assignment: "1c4ee09a-c011-40bf-8c63-e76323f9b222",
    sofiaMock3Assignment: "f9b47a79-28c7-4516-b24a-83f7a9d44333",
    anaMock1SubmittedAttempt: "ae32b9f7-c68b-4498-8ec2-88fd7eeb7444",
    sofiaMock3ProgressAttempt: "41c5c04f-28a5-4322-9326-c884ca574555",
  };

  const fptAssigned = await prisma.fullPracticeTestAssignment.upsert({
    where: { id: seedExamIds.anaMock1Assignment },
    update: { status: "COMPLETED", dueDate: new Date("2026-06-30") },
    create: {
      id: seedExamIds.anaMock1Assignment,
      testId: fullPracticeTests[0].id,
      studentId: students[0].id,
      assignedById: teacher.id,
      dueDate: new Date("2026-06-30"),
      status: "COMPLETED",
    },
  });
  await prisma.fullPracticeTestAssignment.upsert({
    where: { id: seedExamIds.luisMock2Assignment },
    update: { status: "PENDING", dueDate: new Date("2026-07-15") },
    create: {
      id: seedExamIds.luisMock2Assignment,
      testId: fullPracticeTests[1].id,
      studentId: students[1].id,
      assignedById: teacher.id,
      dueDate: new Date("2026-07-15"),
      status: "PENDING",
    },
  });
  const fptInProgressAssignment = await prisma.fullPracticeTestAssignment.upsert({
    where: { id: seedExamIds.sofiaMock3Assignment },
    update: { status: "IN_PROGRESS", dueDate: new Date("2026-07-20") },
    create: {
      id: seedExamIds.sofiaMock3Assignment,
      testId: fullPracticeTests[2].id,
      studentId: students[2].id,
      assignedById: teacher.id,
      dueDate: new Date("2026-07-20"),
      status: "IN_PROGRESS",
    },
  });

  const fptSubmittedAttempt = await prisma.fullPracticeTestAttempt.upsert({
    where: { id: seedExamIds.anaMock1SubmittedAttempt },
    update: {
      status: "SUBMITTED",
      submittedAt: new Date("2026-06-10T16:00:00Z"),
      rwScore: 620,
      mathScore: 650,
      totalScore: 1270,
      timeExpiredEvents: 1,
      extraTimeUsed: 180,
      moduleTimerState: JSON.stringify([0, 0, 0, 0]),
    },
    create: {
      id: seedExamIds.anaMock1SubmittedAttempt,
      testId: fullPracticeTests[0].id,
      assignmentId: fptAssigned.id,
      studentId: students[0].id,
      status: "SUBMITTED",
      submittedAt: new Date("2026-06-10T16:00:00Z"),
      rwScore: 620,
      mathScore: 650,
      totalScore: 1270,
      timeExpiredEvents: 1,
      extraTimeUsed: 180,
      moduleTimerState: JSON.stringify([0, 0, 0, 0]),
    },
  });

  const submittedModules = await prisma.fullPracticeTestModule.findMany({
    where: { testId: fullPracticeTests[0].id },
    include: { questions: { include: { question: true }, orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });
  for (const testModule of submittedModules) {
    for (const item of testModule.questions) {
      const shouldBeCorrect = item.order % 5 !== 0;
      await prisma.fullPracticeTestAnswer.upsert({
        where: { attemptId_questionId: { attemptId: fptSubmittedAttempt.id, questionId: item.questionId } },
        update: {
          moduleId: testModule.id,
          answer: shouldBeCorrect ? item.question.correctAnswer : item.question.type === "NUMERIC" ? "0" : "A",
          isCorrect: shouldBeCorrect,
          timeSpent: 55 + (item.order % 6) * 12,
        },
        create: {
          attemptId: fptSubmittedAttempt.id,
          moduleId: testModule.id,
          questionId: item.questionId,
          answer: shouldBeCorrect ? item.question.correctAnswer : item.question.type === "NUMERIC" ? "0" : "A",
          isCorrect: shouldBeCorrect,
          timeSpent: 55 + (item.order % 6) * 12,
        },
      });
    }
  }

  const fptInProgressAttempt = await prisma.fullPracticeTestAttempt.upsert({
    where: { id: seedExamIds.sofiaMock3ProgressAttempt },
    update: {
      status: "IN_PROGRESS",
      currentModule: 1,
      currentQuestion: 8,
      timeExpiredEvents: 0,
      extraTimeUsed: 0,
      moduleTimerState: JSON.stringify([0, 1090, 2100, 2100]),
    },
    create: {
      id: seedExamIds.sofiaMock3ProgressAttempt,
      testId: fullPracticeTests[2].id,
      assignmentId: fptInProgressAssignment.id,
      studentId: students[2].id,
      status: "IN_PROGRESS",
      currentModule: 1,
      currentQuestion: 8,
      moduleTimerState: JSON.stringify([0, 1090, 2100, 2100]),
    },
  });
  const progressModule = await prisma.fullPracticeTestModule.findFirst({
    where: { testId: fullPracticeTests[2].id, order: 0 },
    include: { questions: { include: { question: true }, orderBy: { order: "asc" }, take: 6 } },
  });
  if (progressModule) {
    for (const item of progressModule.questions) {
      await prisma.fullPracticeTestAnswer.upsert({
        where: { attemptId_questionId: { attemptId: fptInProgressAttempt.id, questionId: item.questionId } },
        update: { moduleId: progressModule.id, answer: item.question.correctAnswer, isCorrect: null, timeSpent: 70 },
        create: {
          attemptId: fptInProgressAttempt.id,
          moduleId: progressModule.id,
          questionId: item.questionId,
          answer: item.question.correctAnswer,
          isCorrect: null,
          timeSpent: 70,
        },
      });
    }
  }

  await prisma.auditLog.upsert({
    where: { id: "audit-seed-fpt-mocks-ready" },
    update: {},
    create: {
      id: "audit-seed-fpt-mocks-ready",
      userId: admin.id,
      action: "SEED_QA_FPT_MOCKS_READY",
      targetType: "FullPracticeTest",
      targetId: fullPracticeTests[0].id,
      metadata: JSON.stringify({
        tests: fullPracticeTests.length,
        modulesPerTest: 4,
        distribution: "RW 27+27, MATH 22+22",
        assignments: ["completed", "pending", "in_progress"],
        scoreTables: "RW 0-54, MATH 0-44",
      }),
    },
  });

  // ─── RESUMEN ──────────────────────────────────────────────────────────────────
  console.log("\n✅  Seed completo\n");
  console.log("ADMIN");
  console.log("  admin@sat.com          / admin123      (APPROVED)");
  console.log("");
  console.log("TEACHER");
  console.log("  teacher@sat.com        / teacher123    (APPROVED) — SAT Core Program");
  console.log("  teacher.pending@sat.com/ teacher123    (PENDING)  — sin programa");
  console.log("");
  console.log("PARENT");
  console.log("  parent@sat.com         / parent123     (APPROVED) — vinculado a Ana Torres");
  console.log("  parent.pending@sat.com / parent123     (PENDING)  — sin alumno aprobado");
  console.log("");
  console.log("STUDENT");
  console.log("  student1@sat.com       / student123    (APPROVED) — inscrito en SAT Core");
  console.log("  student2@sat.com       / student123    (APPROVED) — inscrito en SAT Core");
  console.log("  student3@sat.com       / student123    (APPROVED) — inscrito en SAT Core");
  console.log("  student4@sat.com       / student123    (APPROVED) — inscrito en SAT Core");
  console.log("  student.pending@sat.com/ student123    (PENDING)  — sin programa");
  console.log("  student.rejected@sat.com/student123   (REJECTED)  — cuenta rechazada");
  console.log("  student.noenroll@sat.com/student123   (APPROVED)  — aprobado, sin inscribirse");
  console.log("  student.enrollpending@ / student123   (APPROVED)  — solicitud inscripción PENDING");
  console.log("");
  console.log("MENORES (inscripción requiere aprobación del padre)");
  console.log("  student.minor@sat.com  / student123   (APPROVED, 16 años) — esperando padre");
  console.log("  student.minor2@sat.com / student123   (APPROVED, 16 años) — padre aprobó, esperando profesor");
  console.log("  parent.minor@sat.com   / parent123    (APPROVED) — padre de Carlos y Valeria");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
