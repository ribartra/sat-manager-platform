import prisma from "@/lib/prisma";
import { ForbiddenError } from "@/lib/api-error";

/**
 * A program is the tenant: several teachers can teach it (the master teacher invites them into his
 * program) and its bank is shared by them. Students are NOT shared: each enrollment has an owner
 * teacher (the one who invited the student), and a teacher sees and manages only the students they
 * own, in a running program they still teach.
 */
export function teacherProgramEnrollmentScope(teacherId: string, now = new Date()) {
  return {
    some: {
      status: "APPROVED",
      active: true,
      // Owner teacher: within a shared program each teacher sees only their own students.
      teacherId,
      program: {
        teachers: { some: { teacherId, endDate: null, teacher: { active: true } } },
        active: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
    },
  };
}

export function studentAccessWhereFor(user: { id: string; role: string }, now = new Date()) {
  if (user.role === "ADMIN") {
    return { role: "STUDENT", active: true, validationStatus: "APPROVED" };
  }

  return {
    role: "STUDENT",
    active: true,
    validationStatus: "APPROVED",
    programEnrollments: teacherProgramEnrollmentScope(user.id, now),
  };
}

/** The program used for content and invitations when nothing else says otherwise. */
export const DEFAULT_PROGRAM_ID = "program-sat-core";

/** Programs a teacher teaches now (ProgramTeacher without end date, program not deleted). */
export function teachingProgramWhere(teacherId: string) {
  return { deletedAt: null, teachers: { some: { teacherId, endDate: null } } };
}

/**
 * Bank scope (Question, PracticeSet, FullPracticeTest, StudyMaterial): the content of the programs
 * the teacher teaches — shared by every teacher of the program. ADMIN sees every program's bank.
 */
export function contentScopeFor(user: { id: string; role: string }) {
  if (user.role === "ADMIN") return {};
  return { program: teachingProgramWhere(user.id) };
}

/** Ids of the programs a teacher teaches (ADMIN: every non-deleted program). */
export async function teacherProgramIds(user: { id: string; role: string }) {
  const programs = await prisma.program.findMany({
    where: user.role === "ADMIN" ? { deletedAt: null } : teachingProgramWhere(user.id),
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return programs.map((p) => p.id);
}

/**
 * The program new content goes to: the requested one if the user may write there, else the user's
 * first program (ADMIN: the default program). Throws 403 when a teacher teaches no program.
 */
export async function contentProgramFor(user: { id: string; role: string }, requested?: string | null) {
  const ids = await teacherProgramIds(user);
  if (requested) {
    if (!ids.includes(requested)) throw new ForbiddenError("You can only add content to a program you teach.");
    return requested;
  }
  if (user.role === "ADMIN") return ids.includes(DEFAULT_PROGRAM_ID) ? DEFAULT_PROGRAM_ID : ids[0] ?? DEFAULT_PROGRAM_ID;
  if (!ids[0]) throw new ForbiddenError("You don't teach any program yet.");
  return ids[0];
}

/** Throws 403 unless the user may work with content of that program (ADMIN always may). */
export async function assertContentProgram(user: { id: string; role: string }, programId: string | null | undefined) {
  if (user.role === "ADMIN") return;
  if (!programId || !(await teacherProgramIds(user)).includes(programId)) {
    throw new ForbiddenError("This content belongs to a program you don't teach.");
  }
}

/**
 * Content a teacher may assign to a student: from a program the teacher teaches AND the student is
 * enrolled in (APPROVED, active). ADMIN: any program the student is enrolled in.
 */
export function assignableContentWhere(user: { id: string; role: string }, studentId: string) {
  const teaching = user.role === "ADMIN" ? { deletedAt: null } : teachingProgramWhere(user.id);
  return { program: { ...teaching, enrollments: { some: { studentId, active: true, status: "APPROVED" } } } };
}

/** A practice set / Test only links questions of its own program's bank. Returns an issue or null. */
export async function sameProgramQuestionsIssue(questionIds: string[] | null | undefined, programId: string | null | undefined) {
  const ids = [...new Set((questionIds ?? []).filter(Boolean))];
  if (!ids.length) return null;
  const inProgram = await prisma.question.count({ where: { id: { in: ids }, programId: programId ?? "__none__" } });
  return inProgram === ids.length ? null : "All questions must come from this program's question bank.";
}
