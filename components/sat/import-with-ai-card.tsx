import Link from "next/link";
import { Download, FileSearch, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export type ImportArtifacts = { wizardHref: string; reviewHref: string | null; zipHref: string };

/**
 * Practice Set / Test editors: "Import with AI" (admin and master teacher, pre-filled with the item's
 * skill, level and source) and, for content that came from an import, its artifacts (the import,
 * the review / crop page and the zip with the original PDF and prompts).
 */
export function ImportWithAiCard({ importHref, artifacts }: { importHref: string | null; artifacts: ImportArtifacts | null }) {
  if (!importHref && !artifacts) return null;
  return (
    <Card padding="md" className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{artifacts ? "Imported with AI" : "Import with AI"}</h2>
        <p className="mt-1 text-xs text-gray-500">
          {artifacts
            ? "Open the import to see its PDF, crop more figures or download the original files and prompts."
            : "Turn a PDF into a new Draft with an AI chat: copy a prompt, upload the CSV it makes, check and crop."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {artifacts ? (
          <>
            <Link href={artifacts.wizardHref} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sat-border)] px-3 py-1.5 font-semibold hover:bg-[var(--sat-primary-soft)]">
              <Sparkles size={14} /> Open the import
            </Link>
            {artifacts.reviewHref ? (
              <Link href={artifacts.reviewHref} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sat-border)] px-3 py-1.5 font-semibold hover:bg-[var(--sat-primary-soft)]">
                <FileSearch size={14} /> Review and crop
              </Link>
            ) : null}
            <a href={artifacts.zipHref} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sat-border)] px-3 py-1.5 font-semibold hover:bg-[var(--sat-primary-soft)]">
              <Download size={14} /> Artifacts (zip)
            </a>
          </>
        ) : null}
        {importHref ? (
          <Link href={importHref} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sat-primary)] px-3 py-1.5 font-semibold text-white hover:bg-[var(--sat-primary-dark)]">
            <Sparkles size={14} /> {artifacts ? "New import" : "Import with AI"}
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
