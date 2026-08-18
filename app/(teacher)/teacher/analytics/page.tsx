import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface PageProps {
  searchParams: Promise<{ studentId?: string; q?: string }>;
}

interface Bucket {
  key: string;
  label: string;
  section: string;
  difficulty: string;
  correct: number;
  total: number;
  totalTime: number;
  timed: number;
}

export default async function TeacherAnalyticsPage({ searchParams }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) notFound();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const studentScope = studentAccessWhereFor(session.user);

  const students = await prisma.user.findMany({
    where: studentScope,
    orderBy: { name: "asc" },
    select: { id: true, name: true, lastActiveAt: true },
  });
  const filteredStudents = students.filter((student) => !q || student.name.toLowerCase().includes(q.toLowerCase()));
  // Keep the currently selected student visible even if the search filter excludes them.
  const matchedStudents =
    params.studentId && students.some((student) => student.id === params.studentId) && !filteredStudents.some((student) => student.id === params.studentId)
      ? [students.find((student) => student.id === params.studentId)!, ...filteredStudents]
      : filteredStudents;
  // Never render an empty student dropdown when the teacher has students:
  // if search yields no matches, fall back to the full list and show a hint.
  const searchHadNoMatches = Boolean(q) && filteredStudents.length === 0 && students.length > 0;
  const selectableStudents = matchedStudents.length > 0 ? matchedStudents : students;
  const selectedStudentId = params.studentId && students.some((student) => student.id === params.studentId)
    ? params.studentId
    : selectableStudents[0]?.id;

  const answers = selectedStudentId
    ? await prisma.attemptAnswer.findMany({
        where: {
          attempt: { studentId: selectedStudentId, status: "SUBMITTED" },
        },
        include: {
          question: {
            include: {
              subskill: true,
              topic: { include: { domain: { include: { section: true } } } },
            },
          },
          attempt: {
            select: {
              id: true,
              submittedAt: true,
              totalTime: true,
              assignment: { select: { practiceSet: { select: { name: true } } } },
            },
          },
        },
        orderBy: { attempt: { submittedAt: "desc" } },
      })
    : [];

  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const nowMs = new Date().getTime();
  const staleStudents = students.filter((student) => {
    if (!student.lastActiveAt) return true;
    return nowMs - student.lastActiveAt.getTime() >= 5 * 24 * 60 * 60 * 1000;
  });
  const buckets = new Map<string, Bucket>();

  for (const answer of answers) {
    const section = answer.question.topic.domain.section.label;
    const subtopic = answer.question.subskill?.name ?? answer.question.topic.name;
    const key = `${section}:${subtopic}:${answer.question.difficulty}`;
    const bucket = buckets.get(key) ?? {
      key,
      label: subtopic,
      section,
      difficulty: answer.question.difficulty,
      correct: 0,
      total: 0,
      totalTime: 0,
      timed: 0,
    };
    bucket.total += 1;
    if (answer.isCorrect) bucket.correct += 1;
    if (answer.timeSpent) {
      bucket.totalTime += answer.timeSpent;
      bucket.timed += 1;
    }
    buckets.set(key, bucket);
  }

  const weakSubtopics = [...buckets.values()]
    .filter((bucket) => bucket.total > 0)
    .sort((a, b) => scorePercent(a.correct, a.total) - scorePercent(b.correct, b.total) || b.total - a.total)
    .slice(0, 12);
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const avgAccuracy = answers.length ? scorePercent(correct, answers.length) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Student Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Individual progress, weak skills and reinforcement focus.</p>
        </div>
        <form method="get" className="flex flex-col items-stretch gap-1 sm:items-end">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-gray-500">
              Search
              <input
                name="q"
                defaultValue={q}
                placeholder="Type a student name..."
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
              />
            </label>
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-medium text-gray-500">
              Student
              <select
                name="studentId"
                defaultValue={selectedStudentId ?? ""}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                aria-label="Select a student to view analytics"
              >
                {students.length === 0 ? (
                  <option value="">No students available</option>
                ) : (
                  selectableStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name.trim() || "Unnamed student"}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              View
            </button>
          </div>
          {searchHadNoMatches && (
            <p className="text-xs text-amber-700">
              No students match “{q}”. Showing the full student list below.
            </p>
          )}
        </form>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <Metric label="Student" value={selectedStudent?.name ?? "-"} />
        <Metric label="Answers" value={answers.length.toString()} />
        <Metric label="Average Accuracy" value={avgAccuracy !== null ? `${avgAccuracy}%` : "-"} />
        <Metric label="Inactive 5+ Days" value={staleStudents.length.toString()} />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Skills With Most Errors</h2>
          <Link href="/teacher/compare" className="text-sm text-blue-600 hover:underline">Compare students</Link>
        </div>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Skill</th>
                <th className="px-4 py-3 text-left">Area</th>
                <th className="px-4 py-3 text-left">Difficulty</th>
                <th className="px-4 py-3 text-right">Accuracy</th>
                <th className="px-4 py-3 text-right">Avg Time</th>
                <th className="px-4 py-3 text-left">Reinforcement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {weakSubtopics.map((bucket) => {
                const pct = scorePercent(bucket.correct, bucket.total);
                return (
                  <tr key={bucket.key}>
                    <td className="px-4 py-3 font-medium text-gray-800">{bucket.label}</td>
                    <td className="px-4 py-3 text-gray-500">{bucket.section}</td>
                    <td className="px-4 py-3 text-gray-500">{bucket.difficulty}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">{pct}% ({bucket.correct}/{bucket.total})</td>
                    <td className="px-4 py-3 text-right text-gray-500">{bucket.timed ? formatTime(Math.round(bucket.totalTime / bucket.timed)) : "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{recommendation(bucket.label, pct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {weakSubtopics.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No submitted answers for this student yet.</p>}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Students inactive for 5+ days</h2>
        <Card>
          {staleStudents.slice(0, 12).map((student) => (
            <div key={student.id} className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-sm last:border-b-0">
              <span className="font-medium text-gray-800">{student.name}</span>
              <span className="text-gray-500">{student.lastActiveAt ? formatDate(student.lastActiveAt) : "No activity"}</span>
            </div>
          ))}
          {staleStudents.length === 0 && <p className="p-6 text-center text-sm text-gray-400">All students have recent activity.</p>}
        </Card>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium uppercase text-gray-400">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold text-gray-900">{value}</p>
    </Card>
  );
}

function recommendation(label: string, pct: number) {
  if (pct < 50) return `Re-teach ${label} and assign Easy targeted practice.`;
  if (pct < 75) return `Review mistakes in ${label} before moving difficulty.`;
  return `Monitor ${label}; assign a short reinforcement set.`;
}
