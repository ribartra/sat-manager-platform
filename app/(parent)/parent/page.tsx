import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { scorePercent } from "@/lib/utils";

export default async function ParentDashboardPage() {
  const session = await auth();
  const links = await prisma.parentStudent.findMany({
    where: { parentId: session!.user.id },
    include: { student: { include: { attempts: { where: { status: "SUBMITTED" }, include: { answers: true }, orderBy: { submittedAt: "desc" }, take: 5 } } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Student Progress</h1>
      <div className="grid grid-cols-2 gap-4">
        {links.map((link) => {
          const attempts = link.student.attempts;
          const avg = attempts.length ? Math.round(attempts.reduce((sum, a) => {
            const correct = a.answers.filter((ans) => ans.isCorrect).length;
            return sum + scorePercent(correct, a.answers.length);
          }, 0) / attempts.length) : null;
          return (
            <div key={link.studentId} className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="text-base font-semibold text-gray-900">{link.student.name}</h2>
              <p className="mt-2 text-sm text-gray-600">Recent attempts: {attempts.length}</p>
              <p className="text-sm text-gray-600">Average score: {avg !== null ? `${avg}%` : "—"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
