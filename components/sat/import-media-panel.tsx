"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/sat/alert";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { cn } from "@/lib/utils";

/**
 * Recover images with an external AI (Import with AI step 2 and the editors' "Images & source files"):
 * download the artifacts zip (original files, pages, questions, prompts), copy the image prompt, and
 * upload the zip of images it returns — each image goes to its question.
 */
export function ImportMediaPanel({
  artifactsHref,
  imagesUrl,
  imagePrompt,
  isTest = false,
  disabledReason = null,
}: {
  artifactsHref: string;
  imagesUrl: string;
  /** Shown with a Copy button (also inside the zip as PROMPT-images.md). */
  imagePrompt?: string;
  isTest?: boolean;
  /** Upload not possible yet (e.g. no questions loaded). */
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ linked: number; propagated?: number; skipped: string[] } | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("file", file);
    try {
      setResult(await apiFetch<{ linked: number; propagated?: number; skipped: string[] }>(imagesUrl, { method: "POST", body: form }));
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // The image prompt as a file, to attach it to the AI chat next to the zip.
  function downloadPrompt() {
    if (!imagePrompt) return;
    const url = URL.createObjectURL(new Blob([imagePrompt], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "PROMPT-images.md";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copy() {
    if (!imagePrompt) return;
    try {
      await navigator.clipboard.writeText(imagePrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      notify.error("Could not copy: select the prompt text and copy it by hand.");
    }
  }

  return (
    <div className="space-y-3 text-sm text-gray-700">
      <p>
        Download the zip (original PDF, every page as an image, the questions and the prompts) and give it to your AI with <b>PROMPT-images.md</b>. Best
        quality: ask it for <code>crops.json</code> (where each figure is), and the platform cuts every figure from the original PDF itself — sharp at any size. It may
        also return images named <code>Q3_STEM.png</code>, <code>Q5_A.png</code>
        {isTest ? <> (Tests: <code>RW1_Q3_STEM.png</code>, <code>MATH2_Q12_A.png</code>)</> : null}. Upload its zip here: each figure goes to its question.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary">
          <a href={artifactsHref}>
            <Download size={14} /> Download artifacts (zip)
          </a>
        </Button>
        {imagePrompt ? (
          <>
            <Button type="button" variant="secondary" onClick={downloadPrompt}>
              <FileText size={14} /> Download PROMPT-images.md
            </Button>
            <Button type="button" variant="secondary" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Prompt copied" : "Copy image prompt"}
            </Button>
          </>
        ) : null}
        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--sat-border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--sat-primary-soft)]",
            (busy || disabledReason) && "pointer-events-none text-gray-400",
          )}
        >
          <Upload size={14} /> {busy ? "Uploading…" : "Upload images (zip)"}
          <input
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            disabled={busy || Boolean(disabledReason)}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        {disabledReason ? <span className="text-xs text-gray-500">{disabledReason}</span> : null}
      </div>
      {imagePrompt ? (
        <details>
          <summary className="cursor-pointer text-xs text-blue-600">See the image prompt</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">{imagePrompt}</pre>
        </details>
      ) : null}
      {result ? (
        <div>
          <p>
            {result.linked} image{result.linked === 1 ? "" : "s"} linked
            {result.propagated ? ` · ${result.propagated} copied to the published questions` : ""}.
          </p>
          {result.skipped.length ? (
            <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
              {result.skipped.slice(0, 10).map((s) => <li key={s}>{s}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
      <InlineError>{error}</InlineError>
    </div>
  );
}
