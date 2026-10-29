import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { ImportMediaPanel } from "@/components/sat/import-media-panel";
import { Card } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { requireContentImporter } from "@/lib/rbac";
import { contentScopeFor } from "@/lib/program-scope";
import { importSourcesFor } from "@/lib/import-media.server";
import { formatDate } from "@/lib/utils";

type Question = { id: string; label: string; stem: string; imageUrl: string | null; optionImages: number };

/**
 * "Images & source files" of a Practice Set / Test (shortcut from its editor): for the imports its
 * questions came from, the artifacts zip, the image prompt and the images-zip upload; then each
 * question with its images and the Crop-from-PDF shortcut (the AI Import review page on it).
 */
export default async function ContentMediaPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await requireContentImporter();
  if (!session) redirect("/teacher");
  const { kind, id } = await params;
  if (kind !== "practice-sets" && kind !== "tests") notFound();
  const scope = contentScopeFor(session.user);
  const questionSelect = { id: true, stem: true, imageUrl: true, options: { select: { imageUrl: true } } } as const;

  let title = "";
  let editHref = "";
  let questions: Question[] = [];
  if (kind === "practice-sets") {
    const set = await prisma.practiceSet.findFirst({
      where: { id, ...scope },
      select: { name: true, questions: { orderBy: { order: "asc" }, select: { question: { select: questionSelect } } } },
    });
    if (!set) notFound();
    title = set.name;
    editHref = `/teacher/practice-sets/${id}/edit`;
    questions = set.questions.map((item, index) => ({
      id: item.question.id,
      label: `Q${index + 1}`,
      stem: item.question.stem,
      imageUrl: item.question.imageUrl,
      optionImages: item.question.options.filter((o) => o.imageUrl).length,
    }));
  } else {
    const test = await prisma.fullPracticeTest.findFirst({
      where: { id, ...scope },
      select: {
        name: true,
        modules: { orderBy: { order: "asc" }, select: { name: true, questions: { orderBy: { order: "asc" }, select: { question: { select: questionSelect } } } } },
      },
    });
    if (!test) notFound();
    title = test.name;
    editHref = `/teacher/tests/${id}/edit`;
    questions = test.modules.flatMap((module) =>
      module.questions.map((item, index) => ({
        id: item.question.id,
        label: `${module.name} · Q${index + 1}`,
        stem: item.question.stem,
        imageUrl: item.question.imageUrl,
        optionImages: item.question.options.filter((o) => o.imageUrl).length,
      })),
    );
  }
  const { batches, byQuestion } = await importSourcesFor(questions.map((q) => q.id));
  const isTest = kind === "tests";

  return (
    <PageShell width="wide">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/teacher" },
          isTest ? { label: "Tests", href: "/teacher/tests" } : { label: "Practice", href: "/teacher/practice-sets" },
          { label: title, href: editHref },
          { label: "Images & source files" },
        ]}
      />
      <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Images &amp; source files</h1>
      <p className="mb-5 mt-1 text-sm text-gray-500">
        {title} · Recover figures with an AI from the original files, or crop them from the PDF question by question.
      </p>

      {batches.length === 0 ? (
        <Card padding="md" className="mb-5 text-sm text-gray-500">These questions weren&apos;t imported, so there are no source files. Edit their images in each question.</Card>
      ) : (
        <div className="mb-6 space-y-4">
          {batches.map((batch) => (
            <Card key={batch.id} padding="lg" className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900">{batch.name}</h2>
                <span className="text-xs text-gray-500">
                  {batch.importMode === "AI_CSV" ? "Import with AI" : "AI Import"} · {formatDate(batch.createdAt)} · {batch.questions} question{batch.questions === 1 ? "" : "s"}
                  {batch.importMode === "AI_CSV" ? (
                    <>
                      {" · "}
                      <Link href={`/teacher/import/${batch.id}`} className="text-blue-600 hover:underline">Open the import</Link>
                    </>
                  ) : null}
                </span>
              </div>
              <ImportMediaPanel
                artifactsHref={`/api/import/batches/${batch.id}/artifacts`}
                imagesUrl={`/api/import/batches/${batch.id}/images?scope=${kind}:${id}`}
                imagePrompt={batch.imagePrompt}
                isTest={isTest}
              />
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold text-gray-900">Questions</h2>
      <div className="overflow-hidden rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white">
        <ul className="divide-y divide-gray-100">
          {questions.map((question) => {
            const source = byQuestion.get(question.id);
            return (
              <li key={question.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="w-28 shrink-0 text-xs font-medium text-gray-500">
                  {question.label}
                  {source?.fileName ? <span className="block font-mono text-[10px] text-gray-400" title="Image file name in the zip">{source.fileName}</span> : null}
                </span>
                {question.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={question.imageUrl} alt="" className="h-10 w-14 shrink-0 rounded border border-gray-200 object-contain" />
                ) : (
                  <span className="grid h-10 w-14 shrink-0 place-items-center rounded border border-dashed border-gray-200 text-[10px] text-gray-400">no image</span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{question.stem.replace(/\s+/g, " ").slice(0, 140) || "(image only)"}</span>
                {question.optionImages ? <span className="text-xs text-gray-500">{question.optionImages} choice image{question.optionImages === 1 ? "" : "s"}</span> : null}
                {source ? (
                  <Link href={source.reviewHref} className="shrink-0 text-xs font-semibold text-[var(--sat-primary)] hover:underline">
                    Crop from PDF / images ›
                  </Link>
                ) : (
                  <Link href={`/teacher/questions/${question.id}/edit`} className="shrink-0 text-xs text-gray-500 hover:underline">
                    Edit question ›
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}
