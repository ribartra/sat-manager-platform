// Attempts grouped per practice set / per Test for the shared accordions (components/sat/attempts-table.tsx).
// One rule for every role (teacher, student, parent): the row shows the LAST counted attempt, never the
// best one or an average; practice opens to its last 3 tries with the change vs. the previous counted
// try of the SAME set; a Test opens to every try. Older tries are kept (History), only not listed here.
import type { PracticeAttemptRow, PracticeSetAttempts, TestAttempts } from "@/components/sat/attempts-table";
import type { ReportAttempt } from "@/lib/student-report";
import { shortSetName } from "@/lib/student-report";
import type { PracticeSetItem } from "@/lib/student-practice";
import type { StudentTestItem, TestAttemptRow } from "@/lib/test-assignments";
import { difficultyLabel } from "@/lib/domain-meta";

export interface GroupableTry {
  id: string;
  tryNumber: number;
  submittedAt: Date | null;
  correct: number;
  total: number;
  pct: number | null;
  time: number | null;
  /** SUBMITTED counts; INVALIDATED is listed crossed out but never "last" nor a change baseline. */
  status: string;
  /** Classroom try: no score; shows what was answered. */
  answered?: number;
}

export interface GroupableSet {
  key: string;
  title: string;
  tries: GroupableTry[];
  /** The practice set and its level (History links of the set). */
  practiceSetId?: string | null;
  difficulty?: string | null;
  /** Skill and source of the set: with them the accordion opens skill → source → sets. */
  skillId?: string | null;
  skillName?: string | null;
  sourceName?: string | null;
  sourceOrder?: number | null;
  /** Classroom (no scores) or Homework. */
  context?: "CLASSROOM" | "HOMEWORK";
}

const newestFirst = (a: { submittedAt: Date | null; id: string }, b: { submittedAt: Date | null; id: string }) =>
  (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0) || b.id.localeCompare(a.id);

/** One accordion row per set (most recently practiced first). */
export function practiceSetGroups(sets: GroupableSet[], recentLimit = 3): PracticeSetAttempts[] {
  return sets
    .filter((set) => set.tries.length > 0)
    .map((set) => {
      const tries = [...set.tries].sort(newestFirst);
      const counted = (t: GroupableTry) => t.status === "SUBMITTED" && t.pct !== null;
      const row = (t: GroupableTry, index: number): PracticeAttemptRow => {
        const previous = counted(t) ? tries.slice(index + 1).find(counted) : undefined;
        return {
          id: t.id,
          tryNumber: t.tryNumber,
          submittedAt: t.submittedAt,
          correct: t.correct,
          total: t.total,
          pct: t.pct,
          time: t.time,
          status: t.status,
          change: previous ? t.pct! - previous.pct! : null,
          ...(set.context === "CLASSROOM" ? { classroom: true, answered: t.answered ?? 0 } : {}),
        };
      };
      const lastIndex = Math.max(0, tries.findIndex((t) => t.status === "SUBMITTED"));
      return {
        key: set.key,
        title: set.title,
        practiceSetId: set.practiceSetId ?? null,
        difficulty: set.difficulty ?? null,
        skillId: set.skillId ?? null,
        skillName: set.skillName ?? null,
        sourceName: set.sourceName ?? null,
        sourceOrder: set.sourceOrder ?? null,
        context: set.context,
        tryCount: Math.max(...tries.map((t) => t.tryNumber)),
        last: row(tries[lastIndex], lastIndex),
        recent: tries.slice(0, recentLimit).map(row),
      };
    })
    .sort((a, b) => (b.recent[0].submittedAt?.getTime() ?? 0) - (a.recent[0].submittedAt?.getTime() ?? 0));
}

/** "Nonlinear Functions (Easy)"; the level is added when the set name does not carry it. */
export function practiceSetTitle(name: string, difficulty: string | null | undefined) {
  const short = shortSetName(name);
  return difficulty && !short.includes(`(${difficultyLabel(difficulty)})`) ? `${short} (${difficultyLabel(difficulty)})` : short;
}

/** Teacher report attempts (SUBMITTED + INVALIDATED), grouped by assignment. */
export function setsFromReportAttempts(attempts: ReportAttempt[]): GroupableSet[] {
  const bySet = new Map<string, GroupableSet>();
  for (const a of attempts) {
    const key = a.assignmentId ?? a.id;
    const set =
      bySet.get(key) ??
      bySet
        .set(key, { key, title: practiceSetTitle(a.name, a.difficulty), tries: [], practiceSetId: a.practiceSetId, difficulty: a.difficulty, skillId: a.skillId, skillName: a.skillName, sourceName: a.sourceName, sourceOrder: a.sourceOrder, context: a.context })
        .get(key)!;
    set.tries.push({ id: a.id, tryNumber: a.attemptNumber ?? 1, submittedAt: a.submittedAt, correct: a.correct, total: a.total, pct: a.percent, time: a.totalTime, status: a.status, answered: a.answered });
  }
  return [...bySet.values()];
}

/** A student's own practice sets (counted tries). */
export function setsFromStudentPractice(items: PracticeSetItem[]): GroupableSet[] {
  return items.map((item) => ({
    key: item.assignmentId,
    title: practiceSetTitle(item.name, item.difficulty),
    skillId: item.skillId,
    skillName: item.skill,
    sourceName: item.sourceName,
    sourceOrder: item.sourceOrder,
    context: item.context,
    tries: item.tries.map((t) => ({ id: t.id, tryNumber: t.tryNumber, submittedAt: t.submittedAt, correct: t.correct, total: t.total, pct: t.pct, time: t.time, status: "SUBMITTED", answered: t.answered })),
  }));
}

/** One accordion row per Test (most recently taken first); `keep` filters tries (e.g. a date range). */
export function testGroups(tests: StudentTestItem[], keep: (attempt: TestAttemptRow) => boolean = () => true): TestAttempts[] {
  return tests
    .map((t) => ({ t, tries: t.attempts.filter(keep).sort((x, y) => (y.submittedAt ?? y.startedAt).getTime() - (x.submittedAt ?? x.startedAt).getTime() || y.id.localeCompare(x.id)) }))
    .filter(({ tries }) => tries.length > 0)
    .map(({ t, tries }) => ({
      key: t.assignmentId,
      title: t.name,
      number: t.number,
      sourceName: t.sourceName,
      sourceOrder: t.sourceOrder,
      tries,
      last: tries.find((a) => a.status === "SUBMITTED") ?? tries[0],
    }))
    .sort((x, y) => (y.tries[0].submittedAt ?? y.tries[0].startedAt).getTime() - (x.tries[0].submittedAt ?? x.tries[0].startedAt).getTime());
}
