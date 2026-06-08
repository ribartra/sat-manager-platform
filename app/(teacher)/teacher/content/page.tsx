import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function TeacherContentPage() {
  const sections = await prisma.section.findMany({
    include: {
      domains: {
        include: {
          topics: {
            include: {
              practiceSets: {
                select: { id: true, status: true, difficulty: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const countByStatus = (sets: { status: string }[]) => ({
    published: sets.filter((s) => s.status === "PUBLISHED").length,
    draft: sets.filter((s) => s.status === "DRAFT").length,
    total: sets.length,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Content Map</h1>
        <Link
          href="/teacher/practice-sets/new"
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={14} /> New Practice Set
        </Link>
      </div>

      {sections.map((section) => (
        <div key={section.id} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            {section.label}
          </h2>
          {section.domains.map((domain) => (
            <div key={domain.id} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                {domain.name}
              </h3>
              <div className="space-y-1">
                {domain.topics.map((topic) => {
                  const counts = countByStatus(topic.practiceSets);
                  const byDiff = ["EASY", "MEDIUM", "HARD"].map((d) => ({
                    d,
                    count: topic.practiceSets.filter((ps) => ps.difficulty === d && ps.status === "PUBLISHED").length,
                    draft: topic.practiceSets.filter((ps) => ps.difficulty === d && ps.status === "DRAFT").length,
                  }));

                  return (
                    <Link
                      key={topic.id}
                      href={`/teacher/content/${topic.id}`}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-800">{topic.name}</span>
                      <div className="flex items-center gap-3">
                        {byDiff.map(({ d, count, draft }) =>
                          count + draft > 0 ? (
                            <span key={d} className="text-xs text-gray-500">
                              <span className={d === "EASY" ? "text-green-600" : d === "MEDIUM" ? "text-yellow-600" : "text-red-600"}>
                                {d.charAt(0) + d.slice(1).toLowerCase()}
                              </span>
                              : {count} pub{draft > 0 ? ` / ${draft} draft` : ""}
                            </span>
                          ) : null
                        )}
                        {counts.total === 0 && (
                          <span className="text-xs text-gray-400">No sets yet</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
