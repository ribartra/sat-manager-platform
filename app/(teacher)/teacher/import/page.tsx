import { redirect } from "next/navigation";
import { PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { requireContentImporter } from "@/lib/rbac";
import { listSources } from "@/lib/content-source";
import { officialSkillsFor } from "@/lib/taxonomy-order";
import { ImportTargetForm } from "./import-target-form";

interface PageProps {
  searchParams: Promise<{ kind?: string; topic?: string; difficulty?: string; source?: string }>;
}

/**
 * "Import with AI", step 1 (admin and master teacher): what is imported — a new Practice Set for one
 * skill × level, or a new Test — its source, and the original PDF. Practice › By skill and Tests open
 * it pre-filled (?kind, topic, difficulty, source).
 */
export default async function QuickImportPage({ searchParams }: PageProps) {
  if (!(await requireContentImporter())) redirect("/teacher");
  const query = await searchParams;
  const [math, reading, writing, practiceSources, testSources] = await Promise.all([
    officialSkillsFor("MATH"),
    officialSkillsFor("READING"),
    officialSkillsFor("WRITING"),
    listSources({ activeOnly: true, kind: "practice" }),
    listSources({ activeOnly: true, kind: "tests" }),
  ]);
  return (
    <PageShell width="default">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Import with AI" }]} />
      <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Import with AI</h1>
      <p className="mb-5 mt-1 text-sm text-gray-500">
        Three steps: 1. choose what you import and upload the PDF · 2. ask an AI (ChatGPT, Claude, Gemini…) to turn it into a CSV and upload it · 3. check the
        questions, crop the figures and create the Draft.
      </p>
      <ImportTargetForm
        skills={{ MATH: math, READING: reading, WRITING: writing }}
        practiceSources={practiceSources.map((s) => ({ id: s.id, name: s.name }))}
        testSources={testSources.map((s) => ({ id: s.id, name: s.name }))}
        initial={{
          kind: query.kind === "FULL_PRACTICE_TEST" ? "FULL_PRACTICE_TEST" : "PRACTICE_SET",
          topicId: query.topic ?? "",
          difficulty: ["EASY", "MEDIUM", "HARD"].includes(query.difficulty ?? "") ? query.difficulty! : "",
          sourceId: query.source ?? "",
        }}
      />
    </PageShell>
  );
}
