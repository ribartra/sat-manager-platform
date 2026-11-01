import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import Link from "next/link";
import { PageHeader, PageShell } from "@/components/sat";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getFeatureSetting } from "@/lib/app-settings";
import { rawMaxForPretestExclusion, scoringExamples, sectionScore } from "@/lib/full-test-scoring";

const SECTION_LABEL = { RW: "Reading & Writing", MATH: "Math" } as const;

export default async function FullTestScoringPage() {
  const session = await auth();
  const excludePretest = await getFeatureSetting("FPT_PRETEST_EXCLUSION");
  const counted = rawMaxForPretestExclusion(excludePretest);
  const other = rawMaxForPretestExclusion(!excludePretest);
  const examples = scoringExamples(excludePretest);
  const isAdmin = session?.user.role === "ADMIN";
  const rwExample = Math.round(counted.RW * 0.75);
  const mathExample = Math.round(counted.MATH * 0.75);
  const rwExampleScore = sectionScore(rwExample, counted.RW);
  const mathExampleScore = sectionScore(mathExample, counted.MATH);
  const exampleTotal = `${rwExample} of ${counted.RW} in Reading & Writing (${rwExampleScore}) + ${mathExample} of ${counted.MATH} in Math (${mathExampleScore}) = ${rwExampleScore + mathExampleScore}.`;

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Tests", href: "/teacher/tests" }, { label: "How scores work" }]} />
      <PageHeader
        title="How test scores are calculated"
        description="Tests report a Reading & Writing score and a Math score from 200 to 800 each, and a total from 400 to 1600. Scores are calculated automatically when the student submits; there is nothing to set up here."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card padding="md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">1 · Count correct answers</p>
          <p className="mt-2 text-sm text-gray-700">
            For each section, add up the correct answers from Module 1 and Module 2. Unanswered questions count as incorrect.
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">2 · Divide by the questions that count</p>
          <p className="mt-2 text-sm text-gray-700">
            Right now <span className="font-semibold">{counted.RW} Reading &amp; Writing</span> and{" "}
            <span className="font-semibold">{counted.MATH} Math</span> questions count
            {excludePretest
              ? " (the 2 pretest questions at the start of each module are left out)."
              : " (every question, including the 2 pretest questions at the start of each module)."}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">3 · Place it on the 200–800 scale</p>
          <p className="mt-2 text-sm text-gray-700">
            Section score = 200 + 600 × (correct ÷ questions that count), rounded to the nearest 10. Total = Reading &amp; Writing + Math.
          </p>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-base font-semibold text-gray-900">Examples</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {examples.map((section) => (
          <Card key={section.section} padding="md">
            <p className="mb-3 text-sm font-semibold text-gray-900">
              {SECTION_LABEL[section.section]} <span className="font-normal text-gray-500">· out of {section.counted}</span>
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="py-1.5 font-medium">Correct answers</th>
                  <th className="py-1.5 font-medium">Share</th>
                  <th className="py-1.5 text-right font-medium">Section score</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.correct} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 text-gray-900">{row.correct} of {section.counted}</td>
                    <td className="py-1.5 text-gray-600">{row.percent}%</td>
                    <td className="py-1.5 text-right font-semibold text-gray-900">{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>

      <Card padding="md" className="mt-4">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Example total:</span> {exampleTotal}
        </p>
        <p className="mt-2 text-sm text-gray-700">
          <span className="font-semibold">Pretest setting:</span>{" "}
          {excludePretest
            ? `pretest questions are excluded. If they were included, ${other.RW} and ${other.MATH} questions would count.`
            : `every question counts. If the 2 pretest questions per module were excluded, ${other.RW} and ${other.MATH} questions would count.`}{" "}
          {isAdmin ? (
            <Link href="/admin/settings" className="text-blue-600 hover:underline">
              Change in Admin settings
            </Link>
          ) : (
            "An administrator can change this in Settings."
          )}
        </p>
      </Card>

      <p className="mt-4 text-xs text-gray-500">
        This is an estimate. The official SAT uses adaptive, form-specific scoring, so an official score can differ from this proportional estimate.
      </p>
    </PageShell>
  );
}
