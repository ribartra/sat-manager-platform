"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InlineError } from "@/components/sat/alert";
import { ImportMediaPanel } from "@/components/sat/import-media-panel";
import { ImportStepHeader } from "@/components/sat/import-steps";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { ApiClientError, apiFetch, errorMessage } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

export type QuickQuestionRow = {
  id: string;
  number: number;
  module: string | null;
  stem: string;
  status: string;
  promoted: boolean;
  /** classifyQuestion level, as in the AI Import set-load module. */
  level: "ok" | "info" | "warn" | "crit";
  notes: string[];
  images: number;
  /** Review (edit and crop) on the PDF this question comes from. */
  reviewHref: string | null;
};

/** One Test module in step 2: its PDF, its prompt and what is loaded. */
export type ModuleCardInfo = {
  code: string;
  name: string;
  expected: number;
  /** The module's questions file (null: none was uploaded for it). */
  questionsFile: string | null;
  /** The questions file also holds the section's other module. */
  combined: boolean;
  /** Its section's answers / explanations and the Test's answer key. */
  answerFiles: string[];
  prompt: string;
  loaded: number;
  ready: number;
  inDraft: number;
};

type Preview = {
  module: string | null;
  expected: number | null;
  total: number;
  valid: number;
  ready: number;
  dryRun: boolean;
  rows: Array<{
    rowNumber: number;
    number: number;
    module: string | null;
    errors: string[];
    warnings: string[];
    stem: string;
  }>;
};

const LEVEL: Record<QuickQuestionRow["level"], { label: string; variant: "danger" | "warning" | "success" | "info" }> = {
  crit: { label: "Missing content", variant: "danger" },
  warn: { label: "Check", variant: "warning" },
  info: { label: "OK (no explanation)", variant: "info" },
  ok: { label: "OK", variant: "success" },
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function QuickImportWorkspace({
  batchId,
  kind,
  prompt,
  modules,
  rows,
  reviewLinks,
  draftHref,
  imagePrompt,
}: {
  batchId: string;
  kind: "PRACTICE_SET" | "FULL_PRACTICE_TEST";
  /** Practice Set: the one prompt. A Test uses one prompt per module (`modules`). */
  prompt: string;
  modules: ModuleCardInfo[] | null;
  rows: QuickQuestionRow[];
  reviewLinks: Array<{ label: string; href: string }>;
  draftHref: string | null;
  /** The prompt for the images (also PROMPT-images.md in the artifacts zip). */
  imagePrompt?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const counts = {
    crit: rows.filter((r) => r.level === "crit").length,
    warn: rows.filter((r) => r.level === "warn").length,
    needsReview: rows.filter((r) => r.status === "NEEDS_REVIEW" && !r.promoted).length,
  };
  // A Test's Draft grows module by module: questions loaded after it was created can be added.
  const notInDraft = rows.filter((r) => !r.promoted).length;

  async function createDraft(allowPartial = false) {
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch<{
        href: string;
        questions?: number;
        added?: boolean;
      }>(`/api/import/quick/${batchId}/promote`, {
        method: "POST",
        json: { allowPartial },
      });
      notify.success(
        result.added
          ? `${plural(result.questions ?? 0, "question")} added to the Draft.`
          : result.questions
            ? `Draft created with ${plural(result.questions, "question")}.`
            : "Draft opened.",
      );
      router.push(result.href);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiClientError && err.code === "NEEDS_REVIEW" && !allowPartial) {
        const ok = await confirm({
          title: draftHref ? "Add only the ready questions?" : "Create a partial Draft?",
          description: `${err.message} The questions left out stay in this import; you can review them and add them later.`,
          confirmLabel: draftHref ? "Add the ready ones" : "Create partial Draft",
        });
        if (ok) await createDraft(true);
        return;
      }
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      {/* Step 2 */}
      <Card id="step-2" padding="lg" className="scroll-mt-6 space-y-4">
        <ImportStepHeader
          step={2}
          title="Ask an AI for the CSV"
          help={
            modules
              ? "One module at a time: copy its prompt, give it to your AI with the files its card lists, and upload the CSV it makes."
              : "Copy the prompt, give it to your AI with the PDF, and upload the CSV it makes."
          }
          aside={rows.length ? `${plural(rows.length, "question")} loaded` : null}
        />
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li>Copy the prompt{modules ? " of the module" : ""} and open your AI chat (ChatGPT, Claude, Gemini…).</li>
          <li>
            {modules
              ? "Attach the files listed under “Give the AI” in the module's card, paste the prompt and send it."
              : "Attach the PDF(s) you uploaded in step 1, paste the prompt and send it."}
          </li>
          <li>
            Download the <b>import.csv</b> file the AI makes (ask for it again if it only shows text).
          </li>
          <li>
            Upload it here, check the preview and import it.
            {modules ? " Then go on with the next module." : ""}
          </li>
        </ol>

        {modules ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {modules.map((module) => (
              <ModuleCard key={module.code} batchId={batchId} module={module} />
            ))}
          </div>
        ) : (
          <div className="border-t border-gray-100 pt-4">
            <CsvLoader
              batchId={batchId}
              module={null}
              prompt={prompt}
              hasRows={rows.length > 0}
              lockedReason={draftHref ? "The Draft was already created from this import." : null}
            />
          </div>
        )}

        <details className="rounded-md border border-gray-200 bg-white text-sm">
          <summary className="cursor-pointer px-3 py-2 font-medium text-gray-800">Reprocess with AI (artifacts and images)</summary>
          <div className="border-t border-gray-100 p-3">
            <ImportMediaPanel
              artifactsHref={`/api/import/quick/${batchId}/artifacts`}
              imagesUrl={`/api/import/quick/${batchId}/images`}
              isTest={kind === "FULL_PRACTICE_TEST"}
              imagePrompt={rows.length ? imagePrompt : undefined}
              disabledReason={rows.length ? null : "Load the CSV first."}
            />
          </div>
        </details>
      </Card>

      {/* Step 3 */}
      <Card id="step-3" padding="lg" className="scroll-mt-6 space-y-4">
        <ImportStepHeader
          step={3}
          title="Review, crop figures and create the Draft"
          help={
            modules
              ? "Fix what the check flags, crop figures from each section's PDF, then create the Draft; add later modules to it the same way."
              : "Fix what the check flags, crop figures from the PDF, then create the Draft."
          }
          aside={
            rows.length ? (
              <>
                {counts.crit ? <span className="text-red-600">{counts.crit} missing content · </span> : null}
                {counts.warn ? <span className="text-amber-700">{counts.warn} to check · </span> : null}
                {counts.needsReview} need review
              </>
            ) : null
          }
        />
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">Load the CSV in step 2 first.</p>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              Open <b>Review</b> to fix text, answers and choices, and to crop figures from the PDF (Crop → assign to the question, the passage or a choice). Mark each fixed
              question as <i>Reviewed</i>. Only questions that are Ready or Reviewed go into the Draft.
            </p>
            <div className="flex flex-wrap gap-2">
              {reviewLinks.map((link) => (
                <Button key={link.href} asChild variant="secondary">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
              {draftHref && kind === "FULL_PRACTICE_TEST" && notInDraft > 0 ? (
                <Button onClick={() => createDraft(false)} disabled={busy}>
                  Add {plural(notInDraft, "question")} to the Draft
                </Button>
              ) : null}
              {draftHref ? (
                <Button asChild variant={kind === "FULL_PRACTICE_TEST" && notInDraft > 0 ? "secondary" : "default"}>
                  <Link href={draftHref}>Open the Draft</Link>
                </Button>
              ) : (
                <Button onClick={() => createDraft(false)} disabled={busy}>
                  Create Draft {kind === "PRACTICE_SET" ? "Practice Set" : "Test"}
                </Button>
              )}
            </div>
            <QuestionTable rows={rows} />
          </>
        )}
        <InlineError>{error}</InlineError>
      </Card>
    </div>
  );
}

/** A Test module in step 2: its PDF, its prompt, its CSV and how far it got. */
function ModuleCard({ batchId, module }: { batchId: string; module: ModuleCardInfo }) {
  const state =
    module.inDraft > 0
      ? {
          label: `In the Draft · ${module.inDraft}/${module.expected}`,
          variant: "success" as const,
        }
      : module.loaded > 0
        ? {
            label: `${module.loaded}/${module.expected} loaded · ${module.ready} ready`,
            variant: module.loaded === module.expected ? ("info" as const) : ("warning" as const),
          }
        : { label: "Not loaded", variant: "default" as const };
  return (
    <section className="space-y-3 rounded-[var(--sat-radius)] border border-[var(--sat-border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{module.name}</h3>
          <p className="text-xs text-gray-500">{module.expected} questions</p>
        </div>
        <Badge variant={state.variant}>{state.label}</Badge>
      </div>
      {module.questionsFile ? (
        <div className="text-xs text-gray-600">
          <p className="font-medium text-gray-700">Give the AI:</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
            <li>
              <b>{module.questionsFile}</b> {module.combined ? "(questions, Module 1 + 2: the prompt says which one)" : "(questions)"}
            </li>
            {module.answerFiles.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <CsvLoader
        batchId={batchId}
        module={module}
        prompt={module.prompt}
        hasRows={module.loaded > 0}
        lockedReason={
          module.inDraft > 0
            ? "This module is in the Draft: fix its questions in the Test editor (figures can still be cropped in Review)."
            : !module.questionsFile
              ? "No questions file was uploaded for this module."
              : null
        }
      />
    </section>
  );
}

/** Copy the prompt, upload the AI's CSV, check the preview and import it (the whole set, or one module). */
function CsvLoader({
  batchId,
  module,
  prompt,
  hasRows,
  lockedReason,
}: {
  batchId: string;
  module: ModuleCardInfo | null;
  prompt: string;
  hasRows: boolean;
  lockedReason: string | null;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      notify.error("Could not copy: select the prompt text and copy it by hand.");
    }
  }

  async function sendCsv(dryRun: boolean, text = csv?.text ?? "") {
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch<Preview>(`/api/import/quick/${batchId}/csv`, { method: "POST", json: { csv: text, dryRun, module: module?.code } });
      setPreview(result);
      if (!dryRun) {
        notify.success(`${plural(result.valid, "question")} imported${module ? ` into ${module.name}` : ""}.`);
        setCsv(null);
        setPreview(null);
        router.refresh();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={copyPrompt}
          variant={copied ? "secondary" : "default"}
          disabled={Boolean(lockedReason) && !hasRows}
          disabledReason={lockedReason && !hasRows ? lockedReason : null}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Prompt copied" : module ? `Copy prompt (${module.code})` : "Copy prompt"}
        </Button>
        <details className="w-full text-sm">
          <summary className="cursor-pointer text-blue-600">See the prompt</summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">{prompt}</pre>
        </details>
      </div>
      {lockedReason ? null : (
        <label className="block text-sm font-medium text-gray-700">
          {hasRows ? "Replace with a new CSV" : "Upload the CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const text = await file.text();
              setCsv({ name: file.name, text });
              await sendCsv(true, text);
            }}
          />
        </label>
      )}
      {lockedReason ? <p className="text-xs text-gray-500">{lockedReason}</p> : null}
      {preview ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            <b>{csv?.name}</b>: {plural(preview.total, "row")} · <b>{preview.valid}</b> can be imported · {preview.ready} ready without changes
            {preview.total - preview.valid ? (
              <>
                {" "}
                · <span className="text-red-600">{preview.total - preview.valid} with errors (left out)</span>
              </>
            ) : null}
          </p>
          {preview.expected && preview.valid !== preview.expected ? (
            <p className="text-sm text-amber-700">
              This module should have {preview.expected} questions and the CSV brings {preview.valid}. Check that the AI used only this module and did not skip any question.
            </p>
          ) : null}
          <PreviewTable rows={preview.rows} />
          <div className="flex gap-2">
            <Button onClick={() => sendCsv(false)} disabled={busy} disabledReason={!preview.valid ? "No valid row to import." : null}>
              Import {plural(preview.valid, "question")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setPreview(null);
                setCsv(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <InlineError>{error}</InlineError>
    </div>
  );
}

function PreviewTable({ rows }: { rows: Preview["rows"] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-md border border-gray-200">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-gray-50 text-gray-500">
          <tr>
            <th className="px-2 py-1.5 font-medium">#</th>
            <th className="px-2 py-1.5 font-medium">Question</th>
            <th className="px-2 py-1.5 font-medium">Problems</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.rowNumber} className={row.errors.length ? "bg-red-50" : undefined}>
              <td className="whitespace-nowrap px-2 py-1.5 text-gray-700">{row.module ? `${row.module} · ` : ""}{row.number}</td>
              <td className="px-2 py-1.5 text-gray-700">{row.stem || <span className="text-gray-400">(no text)</span>}</td>
              <td className="px-2 py-1.5">
                {row.errors.map((e) => <p key={e} className="text-red-700">{e}</p>)}
                {row.warnings.map((w) => <p key={w} className="text-amber-700">{w}</p>)}
                {!row.errors.length && !row.warnings.length ? <span className="text-green-700">OK</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuestionTable({ rows }: { rows: QuickQuestionRow[] }) {
  return (
    <div className="max-h-[32rem] overflow-auto rounded-md border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Question</th>
            <th className="px-3 py-2 font-medium">Check</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap px-3 py-2 text-gray-700">{row.module ? `${row.module} · ` : ""}{row.number}</td>
              <td className="px-3 py-2">
                {row.reviewHref ? (
                  <Link href={`${row.reviewHref}?candidate=${row.id}`} className="text-gray-900 hover:underline">{row.stem || "(image only)"}</Link>
                ) : (
                  row.stem
                )}
                {row.images ? <span className="ml-1 text-xs text-gray-500">· {row.images} image{row.images === 1 ? "" : "s"}</span> : null}
                {row.notes.length ? <p className="text-xs text-gray-500">{row.notes.slice(0, 3).join(" · ")}</p> : null}
              </td>
              <td className="px-3 py-2"><Badge variant={LEVEL[row.level].variant}>{LEVEL[row.level].label}</Badge></td>
              <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">{row.promoted ? "In the Draft" : row.status === "NEEDS_REVIEW" ? "Needs review" : row.status === "READY" ? "Ready" : row.status === "REVIEWED" ? "Reviewed" : row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
