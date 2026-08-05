import crypto from "crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { formatDate, scorePercent } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { accessWindow, areasLabel, parseAreas, sectionMatchesAreas } from "@/lib/parent-access";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export default async function ParentTemporaryAccessPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  if (!token) notFound();

  const access = await prisma.parentAccessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      student: {
        include: {
          attempts: {
            where: { status: "SUBMITTED" },
            include: {
              answers: true,
              assignment: { include: { practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } } } },
            },
            orderBy: { submittedAt: "desc" },
            take: 30,
          },
        },
      },
    },
  });

  if (!access) notFound();

  const wasActivated = Boolean(access.usedAt);
  const state = accessWindow(access);
  if (!state.active) notFound();

  // First open activates the link and starts the 7-day access window.
  if (!wasActivated) {
    await prisma.parentAccessToken.update({ where: { id: access.id }, data: { usedAt: new Date() } });
  }

  const areas = parseAreas(access.areas);
  const allAreas = areas.length === 3;

  const attempts = access.student.attempts
    .filter((attempt) => {
      const sectionLabel = attempt.assignment?.practiceSet.topic.domain.section.label ?? null;
      return sectionLabel ? sectionMatchesAreas(sectionLabel, areas) : allAreas;
    })
    .slice(0, 10);

  const totalAnswers = attempts.flatMap((attempt) => attempt.answers);
  const correct = totalAnswers.filter((answer) => answer.isCorrect).length;
  const pct = scorePercent(correct, totalAnswers.length);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase text-gray-400">Progress report · {areasLabel(areas)}</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">{access.student.name}</h1>
        <p className="mt-1 text-sm text-gray-500">Access available until {formatDate(state.effectiveExpiresAt)}</p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Metric label="Completed attempts" value={attempts.length.toString()} />
        <Metric label="Answered questions" value={totalAnswers.length.toString()} />
        <Metric label="Average accuracy" value={totalAnswers.length ? `${pct}%` : "-"} />
      </div>

      <Card>
        {attempts.map((attempt) => {
          const attemptCorrect = attempt.answers.filter((answer) => answer.isCorrect).length;
          const total = attempt.answers.length;
          return (
            <div key={attempt.id} className="border-b border-gray-100 px-4 py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{attempt.assignment?.practiceSet.name ?? "Practice Set"}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {attempt.assignment?.practiceSet.topic.domain.section.label} · {attempt.assignment?.practiceSet.topic.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{attemptCorrect}/{total} · {scorePercent(attemptCorrect, total)}%</p>
                  <p className="text-xs text-gray-400">{attempt.submittedAt ? formatDate(attempt.submittedAt) : ""}</p>
                </div>
              </div>
            </div>
          );
        })}
        {attempts.length === 0 && <p className="p-8 text-center text-sm text-gray-400">No completed practice in the selected sections yet.</p>}
      </Card>

      <Link href="/login" className="mt-6 inline-block text-sm text-blue-600 hover:underline">Return to login</Link>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </Card>
  );
}
