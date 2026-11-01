import prisma from "@/lib/prisma";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { parseSnapshot, type PracticeSetSnapshot } from "@/lib/attempt-snapshots";
import { difficultyLabel } from "@/lib/domain-meta";
import { formatDate, relativeDay } from "@/lib/utils";
import type { PracticeSetItem } from "@/lib/student-practice";
import type { StudentTestItem } from "@/lib/test-assignments";

/**
 * "Continue where you left off" (mockup `continueCard`): the most recent unfinished practice set
 * or Test, with the first unanswered question as a preview; otherwise the next Test to start.
 */
export interface ContinueWork {
  kind: "Test" | "Practice";
  /** true = nothing in progress, this is the next Test to start ("Up next"). */
  next: boolean;
  title: string;
  sub: string;
  preview: string | null;
  href: string;
  button: string;
}

/** Plain-text preview of a question (no markdown, LaTeX delimiters or table pipes). */
function plain(text: string | null | undefined) {
  return (text ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\$+([^$]*)\$+/g, "$1")
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1")
    .replace(/[*_#>`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function previewOf(q: { stimulus?: string | null; stem: string } | null | undefined) {
  if (!q) return null;
  const text = plain(`${q.stimulus ?? ""} ${q.stem}`);
  return text ? `${text.slice(0, 140)}${text.length > 140 ? "…" : ""}` : null;
}

export async function loadContinueWork(studentId: string, practice: PracticeSetItem[], tests: StudentTestItem[]): Promise<ContinueWork | null> {
  const [openPractice, openTests] = await Promise.all([
    prisma.attempt.findMany({
      where: { studentId, status: "IN_PROGRESS", assignmentId: { not: null } },
      select: { id: true, startedAt: true, assignmentId: true, practiceSetId: true, practiceSetSnapshot: true, answers: { select: { questionId: true, answer: true } } },
    }),
    prisma.fullPracticeTestAttempt.findMany({
      where: { studentId, status: "IN_PROGRESS" },
      select: { id: true, startedAt: true, assignmentId: true, testId: true, testSnapshot: true, answers: { select: { questionId: true, answer: true } } },
    }),
  ]);
  const candidates = [
    ...openPractice.map((a) => ({ kind: "Practice" as const, at: a.startedAt, a })),
    ...openTests.map((a) => ({ kind: "Test" as const, at: a.startedAt, a })),
  ].sort((x, y) => y.at.getTime() - x.at.getTime());

  for (const c of candidates) {
    const answered = new Set(c.a.answers.filter((x) => x.answer && x.answer.trim()).map((x) => x.questionId));
    if (c.kind === "Practice") {
      const a = c.a as (typeof openPractice)[number];
      const item = practice.find((p) => p.assignmentId === a.assignmentId);
      if (!item) continue;
      // Question order as this attempt saw it (snapshot), else the live set order.
      const snapshot = parseSnapshot<PracticeSetSnapshot>(a.practiceSetSnapshot);
      const order = snapshot?.questions?.length
        ? snapshot.questions.map((q) => q.id)
        : (await prisma.practiceSetQuestion.findMany({ where: { practiceSetId: a.practiceSetId }, orderBy: { order: "asc" }, select: { questionId: true } })).map((q) => q.questionId);
      const firstBlank = order.find((id) => !answered.has(id)) ?? order[0];
      const q = firstBlank ? await prisma.question.findUnique({ where: { id: firstBlank }, select: { stem: true, stimulus: true } }) : null;
      return {
        kind: "Practice",
        next: false,
        title: `${item.skill} · ${difficultyLabel(item.difficulty)}`,
        sub: `${answered.size} of ${item.questionCount} answered`,
        preview: previewOf(q),
        href: `/student/practice/assignment/${item.assignmentId}`,
        button: "Continue practice",
      };
    }
    const a = c.a as (typeof openTests)[number];
    const test = tests.find((t) => t.openAttempt?.id === a.id);
    const next = test?.openAttempt?.view?.nextModule;
    if (!test || !next) continue;
    const modules = await fullTestModulesForAttempt(a);
    const mod = modules[next.index];
    const started = mod?.questions.some((q) => answered.has(q.questionId));
    const firstBlank = mod?.questions.find((q) => !answered.has(q.questionId)) ?? mod?.questions[0];
    const doneInModule = mod ? mod.questions.filter((q) => answered.has(q.questionId)).length : 0;
    return {
      kind: "Test",
      next: false,
      title: test.name,
      sub: started ? `${next.name} · ${doneInModule} of ${next.questionCount} answered` : `${next.name} · not started yet`,
      preview: started ? previewOf(firstBlank?.question) : null,
      href: `/student/tests/${test.assignmentId}?module=${next.key}`,
      button: "Continue test",
    };
  }

  const upNext = tests
    .filter((t) => t.state === "todo")
    .sort((x, y) => (x.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (y.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER))[0];
  if (!upNext) return null;
  return {
    kind: "Test",
    next: true,
    title: upNext.name,
    sub: upNext.dueDate ? `Due ${formatDate(upNext.dueDate)} (${relativeDay(upNext.dueDate)})` : "No due date",
    preview: null,
    href: `/student/tests/${upNext.assignmentId}?module=rw1`,
    button: "Start test",
  };
}
