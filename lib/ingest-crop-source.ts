import prisma from "@/lib/prisma";

// The crop tool needs a source that actually has renderable pages. Some ingest
// files hold the question *candidates* while the matching *images* live in a
// sibling file of the same batch (e.g. Test 1 R&W: candidates come from the
// "Answer Explanations.docx" which has no page images, while the passages/figures
// live in the "… R&W.docx"). This resolver maps every source file in a batch to
// the best source to crop from, plus the page numbers that can actually be
// rendered there.

export interface CropImageSource {
  imageSourceFileId: string;
  pageNumbers: number[];
}

function sectionKind(section: string | null): string | null {
  if (!section) return null;
  return section.toUpperCase().includes("MATH") ? "MATH" : "RW";
}

/**
 * @returns a map keyed by source file id → the source to crop from and its
 * renderable page numbers. Files with no usable image source anywhere in the
 * batch are omitted.
 */
export async function computeCropImageSources(batchId: string): Promise<Record<string, CropImageSource>> {
  const [files, imageRows] = await Promise.all([
    prisma.ingestSourceFile.findMany({
      where: { batchId },
      select: { id: true, extension: true, section: true, testNumber: true, pageCount: true },
    }),
    prisma.ingestImageArtifact.groupBy({
      by: ["sourceFileId", "pageNumber"],
      where: { batchId, origin: { notIn: ["MANUAL_CROP", "AI_CROP", "AI_ZIP"] } },
      _count: { _all: true },
    }),
  ]);

  // Pages that carry an extracted (non-manual) image, per source — the only pages
  // a DOCX/image source can render/crop.
  const pagesWithImage = new Map<string, Set<number>>();
  for (const row of imageRows) {
    if (row.pageNumber == null) continue;
    let set = pagesWithImage.get(row.sourceFileId);
    if (!set) {
      set = new Set();
      pagesWithImage.set(row.sourceFileId, set);
    }
    set.add(row.pageNumber);
  }

  function ownPages(file: (typeof files)[number]): number[] {
    const isPdf = (file.extension ?? "").toLowerCase() === "pdf";
    // A PDF renders any page directly via pdfplumber; a DOCX/image source can only
    // render pages that have an extracted image.
    if (isPdf && (file.pageCount ?? 0) > 0) {
      return Array.from({ length: file.pageCount as number }, (_, i) => i + 1);
    }
    const set = pagesWithImage.get(file.id);
    return set ? Array.from(set).sort((a, b) => a - b) : [];
  }

  const withPages = files.map((file) => ({ file, pages: ownPages(file) }));
  const usable = withPages.filter((entry) => entry.pages.length > 0);

  const result: Record<string, CropImageSource> = {};
  for (const { file, pages } of withPages) {
    if (pages.length > 0) {
      result[file.id] = { imageSourceFileId: file.id, pageNumbers: pages };
      continue;
    }
    // No renderable pages of its own → borrow the best sibling that has some,
    // preferring the same section then the same test number, then more pages.
    const wantSection = sectionKind(file.section);
    const score = (other: (typeof files)[number]) =>
      (sectionKind(other.section) === wantSection ? 2 : 0) +
      (file.testNumber != null && other.testNumber === file.testNumber ? 1 : 0);
    const best = usable
      .filter((entry) => entry.file.id !== file.id)
      .sort((a, b) => score(b.file) - score(a.file) || b.pages.length - a.pages.length)[0];
    if (best) {
      result[file.id] = { imageSourceFileId: best.file.id, pageNumbers: best.pages };
    }
  }
  return result;
}
