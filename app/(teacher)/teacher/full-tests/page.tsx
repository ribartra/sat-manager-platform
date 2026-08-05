import prisma from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FullTestActions } from "./full-test-actions-client";

export default async function FullTestsPage() {
  const tests = await prisma.fullPracticeTest.findMany({
    include: { modules: { include: { questions: true } }, assignments: true, attempts: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Exams</h1>
          <p className="mt-1 text-sm text-gray-500">Full Practice Tests with SAT-style modules and score conversion.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/teacher/full-tests/scoring" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Scoring Table</Link>
          <Link href="/teacher/full-tests/new" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">New Exam</Link>
        </div>
      </div>
      <Card>
        {tests.map((test) => (
          <div key={test.id} className="grid gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-gray-900" title={test.name}>{test.name}</p>
                <Badge variant={test.status === "PUBLISHED" ? "success" : test.status === "ARCHIVED" ? "default" : "warning"}>{test.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {test.modules.length} modules · {test.modules.reduce((sum, m) => sum + m.questions.length, 0)} questions · {test.assignments.length} assignments · {test.attempts.length} attempts · review {test.reviewEnabled ? "on" : "off"}
              </p>
            </div>
            <FullTestActions testId={test.id} status={test.status} hasAssignments={test.assignments.length > 0} hasAttempts={test.attempts.length > 0} />
          </div>
        ))}
        {tests.length === 0 && <div className="p-10 text-center text-sm text-gray-400">No Exams yet.</div>}
      </Card>
    </div>
  );
}
