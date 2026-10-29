import Link from "next/link";
import { Images } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Shortcuts of an imported Practice Set / Test: its images and source files, and crop per question. */
export type ContentMediaLinks = {
  /** "Images & source files" page (artifacts zip, image prompt, images upload, per-question crop). */
  href: string;
  /** Question id → its review / crop page (the AI Import review on that question). */
  cropByQuestion: Record<string, string>;
};

export function ContentMediaCard({ links }: { links: ContentMediaLinks | null }) {
  if (!links) return null;
  return (
    <Card padding="md" className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Images &amp; source files</h2>
        <p className="mt-1 text-xs text-gray-500">These questions were imported: recover figures with an AI from the original files, or crop them from the PDF.</p>
      </div>
      <Link href={links.href} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sat-border)] px-3 py-1.5 text-sm font-semibold hover:bg-[var(--sat-primary-soft)]">
        <Images size={14} /> Open
      </Link>
    </Card>
  );
}

/** Per-question shortcut to crop / assign its images from the source PDF. */
export function CropShortcut({ href }: { href: string | undefined }) {
  if (!href) return null;
  return (
    <Link href={href} className="shrink-0 whitespace-nowrap text-xs font-medium text-[var(--sat-primary)] hover:underline" title="See this question's image artifacts and crop from the PDF">
      Images / crop
    </Link>
  );
}
