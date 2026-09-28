import { PageShell, PracticeAreaTabs } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { fullTestAttemptProgress } from "@/lib/attempt-progress";
import { parseFullTestProgressState } from "@/lib/full-test-progress";
import { scoreBandBarClass, scoreBandTextClass } from "@/lib/score-band";
import { activeAreaTab, practiceAreaFromTab, practiceAreaLabel, practiceAreaTopicWhere, resolvePracticeArea } from "@/lib/practice-area";
import { academicTopicWhere, buildTaxonomyTree, type TaxonomyTreeNode } from "@/lib/taxonomy";

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

interface PageProps {
  searchParams: Promise<{ area?: string }>;
}

export default async function ContentMapPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session!.user.id;
  const params = await searchParams;
  const area = activeAreaTab(params.area, "math");
  const practiceArea = practiceAreaFromTab(area);

  if (area === "mocks") {
    const assignments = await prisma.fullPracticeTestAssignment.findMany({
      where: { studentId: userId },
      include: {
        test: {
          include: {
            modules: {
              include: { questions: { select: { questionId: true } } },
              orderBy: { order: "asc" },
            },
          },
        },
        attempts: {
          orderBy: { startedAt: "desc" },
          take: 1,
          include: { answers: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return (
      <PageShell width="wide" density="compact" className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900">Content Map</h1>
          <p className="mt-1 text-sm text-gray-500">Open assigned practice by area.</p>
        </header>
        <PracticeAreaTabs basePath="/student/content-map" active={area} />
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const attempt = assignment.attempts[0];
            const total = assignment.test.modules.reduce((sum, module) => sum + module.questions.length, 0);
            const progress = attempt && attempt.status === "IN_PROGRESS"
              ? fullTestAttemptProgress({
                  modules: assignment.test.modules.map((module) => ({
                    name: module.name,
                    section: module.section,
                    questionIds: module.questions.map((item) => item.questionId),
                  })),
                  answers: attempt.answers,
                  currentModule: attempt.currentModule,
                  currentQuestion: attempt.currentQuestion,
                  status: attempt.status,
                  phase: parseFullTestProgressState(attempt.moduleTimerState, assignment.test.modules.length)?.phase,
                })
              : null;

            return (
              <Card key={assignment.id} className="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{assignment.test.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {assignment.dueDate ? `Due ${formatDate(assignment.dueDate)}` : "No due date"} · {total} questions
                  </p>
                  {progress && (
                    <div className="mt-2 max-w-xl space-y-1">
                      <p className="text-xs text-gray-700">
                        <span className={`font-semibold ${scoreBandTextClass(progress.percent)}`}>Progress {progress.percent}%</span>{" "}
                        ({progress.answered}/{progress.total})
                      </p>
                      <div className="h-2 w-full rounded-full bg-gray-100" aria-label={`Progress ${progress.percent}%`}>
                        <div className={`h-2 rounded-full ${scoreBandBarClass(progress.percent)}`} style={{ width: `${progress.percent}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {attempt?.status === "SUBMITTED" ? (
                    <>
                      <Link href={`/student/full-tests/results/${attempt.id}?area=mocks`} className="text-sm font-medium text-blue-600 hover:underline">
                        Review
                      </Link>
                      {/* Reassigned by the teacher after a submission: allow a fresh attempt. */}
                      {assignment.status !== "COMPLETED" && (
                        <Link href={`/student/full-tests/${assignment.id}?area=mocks`} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                          Start
                        </Link>
                      )}
                    </>
                  ) : (
                    <Link href={`/student/full-tests/${assignment.id}?area=mocks`} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                      {attempt ? "Continue" : "Start"}
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
          {assignments.length === 0 && (
            <Card padding="lg" className="text-center text-sm text-gray-400">
              No Full Practice Tests assigned yet.
            </Card>
          )}
        </div>
      </PageShell>
    );
  }

  const areaLabel = practiceAreaLabel(practiceArea);

  const [taxonomyNodes, topics] = await Promise.all([
    prisma.taxonomyNode.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.topic.findMany({
      where: {
        AND: [academicTopicWhere, ...(practiceArea ? [practiceAreaTopicWhere(practiceArea)] : [])],
      },
      include: {
        taxonomyNode: true,
        domain: true,
        practiceSets: {
          where: { status: "PUBLISHED" },
          select: { id: true, difficulty: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const { roots } = buildTaxonomyTree(taxonomyNodes);
  const topicsByNodeId = new Map<string, typeof topics>();
  for (const topic of topics) {
    if (!topic.taxonomyNodeId) continue;
    const items = topicsByNodeId.get(topic.taxonomyNodeId) ?? [];
    items.push(topic);
    topicsByNodeId.set(topic.taxonomyNodeId, items);
  }
  // Topics are already scoped to the active area by the query; hide topics with no
  // published sets and any section/domain heading whose subtree is then empty.
  const topicShown = (t: (typeof topics)[number]) => t.practiceSets.length > 0;
  function subtreeShown(node: TaxonomyTreeNode): boolean {
    const own = (topicsByNodeId.get(node.id) ?? []).some(topicShown);
    return own || node.children.some(subtreeShown);
  }
  const visibleRoots = roots.filter(subtreeShown);

  const legacySections = taxonomyNodes.length
    ? []
    : await prisma.section.findMany({
    include: {
      domains: {
        include: {
          topics: {
            include: {
              practiceSets: {
                where: { status: "PUBLISHED" },
                select: { id: true, difficulty: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get all assignment IDs for this student (to know what's available)
  const assignments = await prisma.assignment.findMany({
    where: { studentId: userId },
    select: { practiceSetId: true, locked: true },
  });
  const unlockedSetIds = new Set(assignments.filter((a) => !a.locked).map((a) => a.practiceSetId));

  function renderTopicRow(topic: (typeof topics)[number]) {
    const setsByDiff: Record<string, typeof topic.practiceSets> = {};
    DIFFICULTIES.forEach((d) => {
      setsByDiff[d] = topic.practiceSets.filter((ps) => ps.difficulty === d);
    });
    const hasAnyUnlocked = topic.practiceSets.some((ps) => unlockedSetIds.has(ps.id));
    if (!hasAnyUnlocked && topic.practiceSets.length > 0) {
      return (
        <Card key={topic.id} variant="subtle" className="flex items-center justify-between px-4 py-2.5 opacity-60">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-gray-400" />
            <span className="text-sm text-gray-500">{topic.name}</span>
          </div>
        </Card>
      );
    }
    if (topic.practiceSets.length === 0) return null;
    return (
      <Card key={topic.id} className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-gray-50">
        <div className="flex items-center gap-2">
          <ChevronRight size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-800">{topic.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {DIFFICULTIES.map((diff) => {
            const sets = setsByDiff[diff];
            const available = sets.filter((ps) => unlockedSetIds.has(ps.id)).length;
            if (sets.length === 0) return null;
            return (
              <Link
                key={diff}
                href={`/student/content-map/${topic.id}/${diff.toLowerCase()}?area=${area}`}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  available > 0
                    ? diff === "EASY"
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : diff === "MEDIUM"
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-gray-100 text-gray-400"
                )}
              >
                {diff.charAt(0) + diff.slice(1).toLowerCase()} ({available})
              </Link>
            );
          })}
        </div>
      </Card>
    );
  }

  function renderNode(node: TaxonomyTreeNode, depth = 0) {
    const nodeTopics = (topicsByNodeId.get(node.id) ?? []).filter(topicShown);
    const childNodes = node.children.map((child) => renderNode(child, depth + 1)).filter(Boolean);
    if (nodeTopics.length === 0 && childNodes.length === 0) return null;
    return (
      <div key={node.id} className={depth === 0 ? "mb-8" : "mt-4"}>
        {depth === 0 ? (
          <h2 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">{areaLabel}</h2>
        ) : (
          <h3 className={cn("mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500", depth > 1 && "normal-case tracking-normal text-gray-600")}>
            {node.label}
          </h3>
        )}
        <div className={cn("space-y-2", depth > 0 && "pl-3")}>
          {nodeTopics.map((topic) => renderTopicRow(topic))}
          {childNodes}
        </div>
      </div>
    );
  }

  return (
      <PageShell width="wide" density="compact" className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Content Map</h1>
        <p className="mt-1 text-sm text-gray-500">Choose an area to find your next practice set.</p>
      </header>
      <PracticeAreaTabs basePath="/student/content-map" active={area} />

      {visibleRoots.length > 0
        ? visibleRoots.map((node) => renderNode(node))
        : legacySections.map((section) => (
        <div key={section.id} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            {areaLabel}
          </h2>
          <div className="space-y-2">
            {section.domains
              .filter((domain) => !practiceArea || resolvePracticeArea({
                practiceArea: domain.practiceArea,
                sectionName: section.name,
                sectionLabel: section.label,
                domainName: domain.name,
              }) === practiceArea)
              .filter((domain) => domain.topics.some((t) => t.practiceSets.length > 0))
              .map((domain) => (
              <div key={domain.id}>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mt-4 mb-2 px-1">
                  {domain.name}
                </h3>
                <div className="space-y-1">
                  {domain.topics.map((topic) => {
                    const setsByDiff: Record<string, typeof topic.practiceSets> = {};
                    DIFFICULTIES.forEach((d) => {
                      setsByDiff[d] = topic.practiceSets.filter((ps) => ps.difficulty === d);
                    });

                    const hasAnyUnlocked = topic.practiceSets.some((ps) => unlockedSetIds.has(ps.id));
                    if (!hasAnyUnlocked && topic.practiceSets.length > 0) {
                      return (
                        <Card
                          key={topic.id}
                          variant="subtle"
                          className="flex items-center justify-between px-4 py-2.5 opacity-60"
                        >
                          <div className="flex items-center gap-2">
                            <Lock size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-500">{topic.name}</span>
                          </div>
                        </Card>
                      );
                    }

                    if (topic.practiceSets.length === 0) return null;

                    return (
                      <Card
                        key={topic.id}
                        className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight size={14} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-800">{topic.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {DIFFICULTIES.map((diff) => {
                            const sets = setsByDiff[diff];
                            const available = sets.filter((ps) => unlockedSetIds.has(ps.id)).length;
                            if (sets.length === 0) return null;
                            return (
                              <Link
                                key={diff}
                                href={`/student/content-map/${topic.id}/${diff.toLowerCase()}?area=${area}`}
                                className={cn(
                                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                                  available > 0
                                    ? diff === "EASY"
                                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                                      : diff === "MEDIUM"
                                      ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                      : "bg-red-100 text-red-700 hover:bg-red-200"
                                    : "bg-gray-100 text-gray-400"
                                )}
                              >
                                {diff.charAt(0) + diff.slice(1).toLowerCase()} ({available})
                              </Link>
                            );
                          })}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </PageShell>
  );
}
