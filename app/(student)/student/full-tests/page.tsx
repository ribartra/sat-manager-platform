import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function StudentFullTestsPage() {
  const session = await auth();
  const assignments = await prisma.fullPracticeTestAssignment.findMany({
    where: { studentId: session!.user.id },
    include: { test: true, attempts: { orderBy: { startedAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Exams</h1>
        <p className="mt-1 text-sm text-gray-500">Full Practice Tests with SAT-style modules and scoring.</p>
      </div>
      <div className="space-y-3">
        {assignments.map((assignment) => {
          const attempt = assignment.attempts[0];
          return (
            <Card key={assignment.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{assignment.test.name}</p>
                <p className="text-xs text-gray-500">{assignment.dueDate ? `Due ${formatDate(assignment.dueDate)}` : "No due date"}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={assignment.status === "COMPLETED" ? "success" : "warning"}>{assignment.status}</Badge>
                {attempt?.status === "SUBMITTED" ? (
                  <Link href={`/student/full-tests/results/${attempt.id}`} className="text-sm text-blue-600 hover:underline">Review</Link>
                ) : (
                  <Link href={`/student/full-tests/${assignment.id}`} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                    {attempt ? "Continue" : "Start"}
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
        {assignments.length === 0 && <Card padding="lg" className="text-center text-sm text-gray-400">No Exams assigned.</Card>}
      </div>
    </div>
  );
}
