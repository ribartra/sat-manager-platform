import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Pct } from "@/components/sat/work-status";
import { difficultyLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import type { StudentOverview } from "@/lib/teacher-overview";
import { formatDate, relativeDay } from "@/lib/utils";

/** "What {First} has done" — context shown while assigning (practice in %, Tests with section scores). */
export function StudentDonePanel({ overview, studentId, focus }: { overview: StudentOverview; studentId: string; focus: "practice" | "tests" }) {
  const first = overview.name.split(" ")[0];
  const weak = (Object.keys(overview.areas) as PracticeAreaCode[])
    // Attempt level only: each skill's % is its set's last counted attempt, never a pooled average.
    .map((area) => ({ area, w: overview.areas[area].weakestLast }))
    .filter((x): x is { area: PracticeAreaCode; w: NonNullable<StudentOverview["areas"]["MATH"]["weakestLast"]> } => Boolean(x.w))
    .sort((a, b) => a.w.pct - b.w.pct);
  return (
    <Card padding="md" variant="subtle" className="mb-4 text-sm">
      <h2 className="text-sm font-semibold text-gray-900">What {first} has done</h2>
      <p className="mt-1 text-xs text-gray-600">
        Last active: {overview.lastActiveAt ? `${formatDate(overview.lastActiveAt)} (${relativeDay(overview.lastActiveAt)})` : "never"}
        {focus === "tests" ? (
          <>
            {" · "}Latest test:{" "}
            {overview.tests.latest
              ? `${overview.tests.latest.name} · R&W ${overview.tests.latest.rw ?? "—"} · Math ${overview.tests.latest.math ?? "—"}`
              : "none"}
          </>
        ) : null}
        {/* Practice pages never show SAT scores (rule: scores belong to Tests). */}
        {overview.tests.pending.length ? ` · ${overview.tests.pending.length} test${overview.tests.pending.length === 1 ? "" : "s"} pending` : ""}
      </p>
      {focus === "practice" ? (
        weak.length ? (
          <p className="mt-1 text-xs text-gray-600">
            Weakest practice skills:{" "}
            {weak.slice(0, 4).map(({ area, w }, i) => (
              <span key={`${w.topicId}-${w.difficulty}`}>
                {i > 0 ? ", " : ""}
                {w.name} ({difficultyLabel(w.difficulty)}, {practiceAreaLabel(area)}) <Pct value={w.pct} className="font-medium" />
              </span>
            ))}
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">No practice results yet.</p>
        )
      ) : (
        <p className="mt-1 text-xs text-gray-500">
          {overview.tests.latest ? "Section scores are from the latest finished test." : "No finished test yet. A first test is a good diagnostic."}
        </p>
      )}
      <Link href={`/teacher/students/${studentId}`} className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">
        See full summary →
      </Link>
    </Card>
  );
}
