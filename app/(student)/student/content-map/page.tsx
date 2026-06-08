import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

export default async function ContentMapPage() {
  const session = await auth();
  const userId = session!.user.id;

  const sections = await prisma.section.findMany({
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Content Map</h1>

      {sections.map((section) => (
        <div key={section.id} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            {section.label}
          </h2>
          <div className="space-y-2">
            {section.domains.map((domain) => (
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
                        <div
                          key={topic.id}
                          className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-100 opacity-60"
                        >
                          <div className="flex items-center gap-2">
                            <Lock size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-500">{topic.name}</span>
                          </div>
                        </div>
                      );
                    }

                    if (topic.practiceSets.length === 0) return null;

                    return (
                      <div
                        key={topic.id}
                        className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
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
                                href={`/student/content-map/${topic.id}/${diff.toLowerCase()}`}
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
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
