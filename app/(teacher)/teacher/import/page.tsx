import { redirect } from "next/navigation";
import { PageHeader, PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { requireContentImporter } from "@/lib/rbac";
import { listSources } from "@/lib/content-source";
import { officialSkillsFor } from "@/lib/taxonomy-order";
import { ImportTargetForm } from "./import-target-form";
import { ImportSteps } from "@/components/sat/import-steps";

interface PageProps {
  searchParams: Promise<{ kind?: string; topic?: string; difficulty?: string; source?: string; number?: string }>;
}

/**
 * "Import with AI", step 1 (admin and master teacher): what is imported — a new Practice Set for one
 * skill × level, or a new Test — its source, and the original PDF. Practice › By skill and Tests open
 * it pre-filled (?kind, topic, difficulty, source, number).
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
    <PageShell>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/teacher" },
          query.kind === "FULL_PRACTICE_TEST" ? { label: "Tests", href: "/teacher/tests" } : { label: "Practice", href: "/teacher/practice-sets" },
          { label: "Import with AI" },
          { label: "Step 1 · What & PDF" },
        ]}
      />
      <PageHeader
        title="Import with AI"
        description={
          <>
            Choose what you import and upload the PDF, ask an AI (ChatGPT, Claude, Gemini…) to turn it into a CSV, then check the questions, crop the figures and
            create the Draft.
          </>
        }
      />
      <ImportSteps current={1} />
      <ImportTargetForm
        skills={{ MATH: math, READING: reading, WRITING: writing }}
        practiceSources={practiceSources.map((s) => ({ id: s.id, name: s.name }))}
        testSources={testSources.map((s) => ({ id: s.id, name: s.name }))}
        initial={{
          kind: query.kind === "FULL_PRACTICE_TEST" ? "FULL_PRACTICE_TEST" : "PRACTICE_SET",
          topicId: query.topic ?? "",
          difficulty: ["EASY", "MEDIUM", "HARD"].includes(query.difficulty ?? "") ? query.difficulty! : "",
          sourceId: query.source ?? "",
          // Tests › an empty TEST N "+ Import TEST N" (with its source).
          testNumber: /^[1-9]\d{0,2}$/.test(query.number ?? "") ? query.number : "",
        }}
      />
    </PageShell>
  );
}
