import { redirect } from "next/navigation";
import { PageHeader, PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { requireContentImporter } from "@/lib/rbac";
import { listSources } from "@/lib/content-source";
import { officialSkillsFor } from "@/lib/taxonomy-order";
import { ImportTargetForm } from "./import-target-form";
import { ImportSteps } from "@/components/sat/import-steps";
import { Alert } from "@/components/sat/alert";
import Link from "next/link";
import { openQuickImports } from "@/lib/quick-import.server";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ kind?: string; topic?: string; difficulty?: string; source?: string; number?: string }>;
}

/**
 * "Import with AI", step 1 (admin and master teacher): what is imported — a new Practice Set for one
 * skill × level, or a new Test — its source, and the original PDF. Practice › By skill and Tests open
 * it pre-filled (?kind, topic, difficulty, source, number).
 */
export default async function QuickImportPage({ searchParams }: PageProps) {
  const session = await requireContentImporter();
  if (!session) redirect("/teacher");
  const query = await searchParams;
  const [math, reading, writing, practiceSources, testSources] = await Promise.all([
    officialSkillsFor("MATH"),
    officialSkillsFor("READING"),
    officialSkillsFor("WRITING"),
    listSources({ activeOnly: true, kind: "practice" }),
    listSources({ activeOnly: true, kind: "tests" }),
  ]);
  // Imports already started (everything is saved as it goes): continue them instead of a second one.
  const open = await openQuickImports(session.user);
  const kind = query.kind === "FULL_PRACTICE_TEST" ? "FULL_PRACTICE_TEST" : "PRACTICE_SET";
  const sameTarget = open.find((item) =>
    item.kind === kind &&
    (!query.source || item.sourceId === query.source) &&
    (kind === "FULL_PRACTICE_TEST"
      ? Boolean(query.number) && String(item.testNumber ?? "") === query.number
      : Boolean(query.topic) && item.topicId === query.topic && item.difficulty === query.difficulty),
  );
  const loadedText = (n: number) => (n === 0 ? "no questions loaded yet" : `${n} question${n === 1 ? "" : "s"} loaded`);
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
      {sameTarget ? (
        <Alert tone="warning" title={`You already started importing ${sameTarget.label}`} className="mb-4">
          Started {formatDate(sameTarget.createdAt)} · {loadedText(sameTarget.questionsLoaded)}. Your files are saved:{" "}
          <Link href={sameTarget.href} className="font-semibold text-[var(--sat-primary)] hover:underline">Continue that import</Link>. Uploading
          the files again below starts a second import.
        </Alert>
      ) : null}
      {open.length > 0 ? (
        <section aria-labelledby="open-imports" className="mb-6 rounded-[10px] border border-[var(--sat-border)] bg-white p-4">
          <h2 id="open-imports" className="text-sm font-semibold text-[var(--sat-text)]">Imports in progress</h2>
          <p className="mt-0.5 text-xs text-[var(--sat-muted)]">Started and saved, no Draft yet. Continue one where you left it.</p>
          <ul className="mt-3 divide-y divide-[var(--sat-border)]">
            {open.slice(0, 10).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{item.label}</span>
                  <span className="text-[var(--sat-muted)]"> · started {formatDate(item.createdAt)} · {loadedText(item.questionsLoaded)}</span>
                </span>
                <Link href={item.href} className="rounded-lg border border-[var(--sat-border)] px-2.5 py-1 text-xs font-semibold hover:border-[var(--sat-primary)] hover:text-[var(--sat-primary)]">
                  Continue
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
