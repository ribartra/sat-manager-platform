import prisma from "@/lib/prisma";
import { isAnswerCorrect } from "@/lib/answer-grading";
import { parseSnapshot, type PracticeSetSnapshot, type QuestionSnapshot } from "@/lib/attempt-snapshots";
import { completedModulesOf } from "@/lib/full-test-progress";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { resolveQuestionType } from "@/lib/question-type";
import { FULL_PRACTICE_TEST_DOMAIN_NAME } from "@/lib/taxonomy";
import { difficultyLabel } from "@/lib/domain-meta";

/**
 * Student history "By session" (mockup `mejorada/history.html`): one session per practice attempt
 * and one per finished Test module, each with its questions (result, skill, difficulty, time).
 */
export type SessionResult = "ok" | "bad" | "blank";

export interface SessionRow {
  n: number;
  result: SessionResult;
  skill: string;
  difficulty: string;
  time: number | null;
}

export interface StudentSession {
  id: string;
  source: "test" | "practice";
  /** Practice area; "rw" for Reading & Writing Test modules. */
  area: PracticeAreaCode | "rw" | "math-test";
  areaLabel: string;
  title: string;
  at: Date;
  done: boolean;
  rows: SessionRow[];
  href: string;
}

const resultOf = (answer: string | null | undefined, correct: boolean): SessionResult => (!answer || !answer.trim() ? "blank" : correct ? "ok" : "bad");

export async function loadStudentSessions(studentId: string): Promise<StudentSession[]> {
  const [practice, tests] = await Promise.all([
    prisma.attempt.findMany({
      where: { studentId, status: { in: ["SUBMITTED", "IN_PROGRESS"] }, assignmentId: { not: null } },
      select: {
        id: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        assignmentId: true,
        practiceSetId: true,
        practiceSetSnapshot: true,
        answers: { select: { questionId: true, answer: true, isCorrect: true, timeSpent: true, questionSnapshot: true } },
        assignment: {
          select: {
            practiceSet: {
              select: {
                difficulty: true,
                topic: { select: { name: true, domain: { select: { practiceArea: true } } } },
                questions: { orderBy: { order: "asc" }, select: { questionId: true, question: { select: { difficulty: true, topic: { select: { name: true } } } } } },
              },
            },
          },
        },
      },
    }),
    prisma.fullPracticeTestAttempt.findMany({
      where: { studentId, status: { in: ["SUBMITTED", "IN_PROGRESS"] } },
      select: {
        id: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        testId: true,
        testSnapshot: true,
        moduleTimerState: true,
        assignmentId: true,
        test: { select: { name: true } },
        answers: { select: { questionId: true, answer: true, isCorrect: true, timeSpent: true } },
      },
    }),
  ]);

  const sessions: StudentSession[] = [];

  for (const a of practice) {
    const set = a.assignment?.practiceSet;
    if (!set) continue;
    const area = (set.topic.domain.practiceArea ?? null) as PracticeAreaCode | null;
    if (!area) continue;
    const snapshot = parseSnapshot<PracticeSetSnapshot>(a.practiceSetSnapshot);
    const live = new Map(set.questions.map((q) => [q.questionId, q.question]));
    const order = snapshot?.questions?.length ? snapshot.questions.map((q) => q.id) : set.questions.map((q) => q.questionId);
    const byQuestion = new Map(a.answers.map((x) => [x.questionId, x]));
    const done = a.status === "SUBMITTED";
    sessions.push({
      id: a.id,
      source: "practice",
      area,
      areaLabel: practiceAreaLabel(area),
      title: `${set.topic.name} · ${difficultyLabel(set.difficulty)}`,
      at: a.submittedAt ?? a.startedAt,
      done,
      href: done ? `/student/results/${a.id}` : `/student/practice/assignment/${a.assignmentId}`,
      rows: order.map((questionId, i) => {
        const ans = byQuestion.get(questionId);
        const snap = parseSnapshot<QuestionSnapshot>(ans?.questionSnapshot);
        const q = live.get(questionId);
        return {
          n: i + 1,
          result: resultOf(ans?.answer, ans?.isCorrect === true),
          skill: snap?.topic?.name ?? q?.topic.name ?? set.topic.name,
          difficulty: snap?.difficulty ?? q?.difficulty ?? set.difficulty,
          time: ans?.timeSpent ?? null,
        };
      }),
    });
  }

  for (const a of tests) {
    const modules = await fullTestModulesForAttempt(a);
    const submitted = a.status === "SUBMITTED";
    const done = submitted ? modules.map((_, i) => i) : completedModulesOf(a.moduleTimerState, modules.length);
    const byQuestion = new Map(a.answers.map((x) => [x.questionId, x]));
    for (const index of done) {
      const m = modules[index];
      if (!m) continue;
      const rw = m.section !== "MATH";
      sessions.push({
        id: `${a.id}-${index}`,
        source: "test",
        area: rw ? "rw" : "math-test",
        areaLabel: rw ? "Reading & Writing" : "Math",
        title: `${a.test.name} · ${m.name}`,
        at: a.submittedAt ?? a.startedAt,
        done: true,
        href: `/student/tests/results/${a.id}#mod-${["rw1", "rw2", "m1", "m2"][index] ?? "rw1"}`,
        rows: m.questions.map((item, i) => {
          const ans = byQuestion.get(item.questionId);
          const correct =
            submitted && ans?.isCorrect != null
              ? ans.isCorrect
              : Boolean(ans?.answer) && isAnswerCorrect(ans!.answer!, item.question.correctAnswer, resolveQuestionType(item.question.type, item.question.options));
          // Test questions use placeholder module topics; show the section instead.
          const placeholder = item.question.topic.domain.name === FULL_PRACTICE_TEST_DOMAIN_NAME;
          return {
            n: i + 1,
            result: resultOf(ans?.answer, correct),
            skill: placeholder ? (rw ? "Reading & Writing" : "Math") : item.question.topic.name,
            difficulty: item.question.difficulty,
            time: ans?.timeSpent ?? null,
          };
        }),
      });
    }
  }

  return sessions.sort((x, y) => y.at.getTime() - x.at.getTime());
}
