import prisma from "@/lib/prisma";
import crypto from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type TopicWithRelations = {
  id: string;
  name: string;
  domain: { name: string; section: { name: string; label: string } };
  subskills: { id: string; name: string }[];
};

type CandidateForDraft = {
  id: string;
  batchId: string;
  sourceFileId: string;
  stem: string | null;
  stimulus: string | null;
  optionsJson: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  type: string;
  difficulty: string | null;
  section: string | null;
  domainName: string | null;
  topicName: string | null;
  subskillName: string | null;
};

type ImageLinkForDraft = {
  targetType: string;
  optionLabel: string | null;
  sortOrder: number;
  image: { fileUrl: string | null; base64Data?: string | null; mimeType?: string | null };
};

const DIFFICULTY_MAP: Record<string, string> = {
  EASY: "EASY",
  MED: "MEDIUM",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
};

const PRIVATE_ASSET_PATTERN = /^\/api\/admin\/ai-import\/assets\/(batch_[a-f0-9]+)\/(img_[a-f0-9]+-[a-f0-9]+\.(?:jpg|jpeg|png|webp))$/i;
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\([^)]+\)/g;

function stripMarkdownImageRefs(value: string | null | undefined) {
  return (value ?? "").replace(MARKDOWN_IMAGE_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
}

// Leading boilerplate from the answer-explanation docx (title page + module
// headers) that some ingests captured into the FIRST question's explanation,
// e.g. "INNOVATOR TEST 9 / Math — Answer Explanations / MATH MODULE 1 (22
// Questions)". Drops those leading lines up to the first real explanation line so
// the header never lands in an official Question. Only strips from the top; a
// normal explanation (which never starts with these) is returned unchanged.
const EXPLANATION_HEADER_LINE = [
  /^(?:INNOVATOR\s+)?TEST\s+\d+\s+INNOVATOR\b/i,
  /^INNOVATOR\s+TEST\s+\d+\b/i,
  /^TEST\s+\d+\s+INNOVATOR\b/i,
  /^(?:Math|Reading\s*(?:and|&)\s*Writing)\s*[—–-]\s*Answer\s+Explanations\b/i,
  /^Answer\s+Explanations\b/i,
  /^MATH\s+MODULE\b/i,
  /^MODULE\s+\d/i,
  /^Math\s+Module\s+\d\s*\|/i,
  /Module\s*2A/i,
  /\(\s*\d+\s+Questions?\s*\)/i,
  /^Solution\s*$/i,
];

export function sanitizeExplanation(value: string | null | undefined): string {
  const text = (value ?? "").replace(/\r\n/g, "\n");
  if (!text.trim()) return "";
  const lines = text.split("\n");
  let start = 0;
  while (start < lines.length) {
    const line = lines[start].trim();
    if (line === "" || EXPLANATION_HEADER_LINE.some((re) => re.test(line))) {
      start += 1;
      continue;
    }
    break;
  }
  return lines.slice(start).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function imageUrlOrBase64(image: ImageLinkForDraft["image"]) {
  if (image.fileUrl) return image.fileUrl;
  if (!image.base64Data) return null;
  if (image.base64Data.startsWith("data:")) return image.base64Data;
  return `data:${image.mimeType || "image/jpeg"};base64,${image.base64Data}`;
}

// When a reviewer crop-assigns an image to a candidate whose question is ALREADY
// promoted, the assignment only writes an IngestCandidateImageLink — the official
// Question/QuestionOption that students (and the conjunto completeness view) read
// stays unchanged, so the set keeps showing "sin opciones" / "revisar". This
// propagates a just-assigned crop to the official row: STEM → Question.imageUrl,
// OPTION → the matching QuestionOption.imageUrl (marking the question MC). Other
// targets (OCR/text ones) have no official image slot and are skipped. Safe to
// call for non-promoted candidates — it no-ops.
export async function propagateAssignedImageToOfficial(args: {
  candidateId: string;
  imageArtifactId: string;
  targetType: string;
  optionLabel?: string | null;
}): Promise<{ propagated: boolean; reason?: string; target?: string; imageUrl?: string }> {
  const { candidateId, imageArtifactId, targetType } = args;
  const target = (targetType || "").toUpperCase();
  const optionLabel = (args.optionLabel ?? "").toUpperCase() || null;

  if (target !== "STEM" && target !== "OPTION") return { propagated: false, reason: "unsupported-target" };
  if (target === "OPTION" && !optionLabel) return { propagated: false, reason: "missing-option-label" };

  const candidate = await prisma.ingestQuestionCandidate.findUnique({
    where: { id: candidateId },
    select: { officialQuestionId: true },
  });
  if (!candidate?.officialQuestionId) return { propagated: false, reason: "not-promoted" };
  const questionId = candidate.officialQuestionId;

  const artifact = await prisma.ingestImageArtifact.findUnique({
    where: { id: imageArtifactId },
    select: { fileUrl: true, base64Data: true, mimeType: true },
  });
  if (!artifact) return { propagated: false, reason: "artifact-not-found" };

  const publicUrl = await materializeOfficialImageUrl(imageUrlOrBase64(artifact));
  if (!publicUrl) return { propagated: false, reason: "materialize-failed" };

  if (target === "STEM") {
    await prisma.question.update({ where: { id: questionId }, data: { imageUrl: publicUrl } });
    return { propagated: true, target, imageUrl: publicUrl };
  }

  // OPTION: update the matching option row (create it if the promoted question has
  // none for this label), and ensure the question reads as MC.
  const existing = await prisma.questionOption.findFirst({ where: { questionId, label: optionLabel! }, select: { id: true } });
  if (existing) {
    await prisma.questionOption.update({ where: { id: existing.id }, data: { imageUrl: publicUrl } });
  } else {
    await prisma.questionOption.create({ data: { questionId, label: optionLabel!, text: "", imageUrl: publicUrl } });
  }
  await prisma.question.update({ where: { id: questionId }, data: { type: "MC" } });
  return { propagated: true, target: `OPTION ${optionLabel}`, imageUrl: publicUrl };
}

export async function materializeOfficialImageUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) return null;
  const match = PRIVATE_ASSET_PATTERN.exec(imageUrl);
  if (!match) return imageUrl;

  const [, batchId, fileName] = match;
  const privateRoot = path.resolve(process.env.INGEST_PUBLIC_UPLOAD_ROOT ?? path.join(process.cwd(), ".private", "uploads", "ingest"));
  const sourcePath = path.resolve(privateRoot, batchId, fileName);
  if (!sourcePath.startsWith(`${privateRoot}${path.sep}`)) return null;

  const data = await readFile(sourcePath);
  const extension = path.extname(fileName).toLowerCase() || ".jpg";
  const digest = crypto.createHash("sha256").update(data).digest("hex").slice(0, 24);
  const publicDir = path.join(process.cwd(), "public", "uploads", "questions");
  const publicName = `${digest}${extension}`;
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, publicName), data);
  return `/uploads/questions/${publicName}`;
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ");
}

function normalizeLoose(value: string | null | undefined) {
  return normalize(value)
    .replace(/non[\s-]*linear/g, "nonlinear")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.length > 3 && part.endsWith("s") ? part.slice(0, -1) : part)
    .join(" ");
}

function sameTaxonomyName(left: string | null | undefined, right: string | null | undefined) {
  return normalize(left) === normalize(right) || normalizeLoose(left) === normalizeLoose(right);
}

export function parseIngestOptions(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((option, index) => ({
        label: String(option?.label ?? String.fromCharCode(65 + index)).trim().toUpperCase(),
        text: String(option?.text ?? option?.value ?? "").trim(),
        imageUrl: option?.imageUrl ? String(option.imageUrl) : null,
      }))
      .filter((option) => option.label);
  } catch {
    return [];
  }
}

export function normalizeIngestDifficulty(value: string | null | undefined) {
  const key = (value ?? "").trim().toUpperCase();
  return DIFFICULTY_MAP[key] ?? "EASY";
}

export function resolveTopicFromCandidate(candidate: CandidateForDraft, topics: TopicWithRelations[]) {
  // Full Practice Tests carry no per-question skill — the only classification is
  // (test number, Math/R&W). Route their questions to the section's Full Practice
  // Test placeholder topic so they can be promoted without a real skill node.
  if (normalize(candidate.domainName) === "full practice test") {
    const wantsMath = normalize(candidate.section).includes("math");
    const placeholder = topics.find((item) => {
      if (normalize(item.domain.name) !== "full practice test") return false;
      return normalize(item.domain.section.name).includes("math") === wantsMath;
    });
    if (placeholder) return { topicId: placeholder.id, subskillId: "" };
  }

  const topicTerm = normalize(candidate.topicName);
  const domainTerm = normalize(candidate.domainName);
  const sectionTerm = normalize(candidate.section);
  const topic = topics.find((item) => {
    if (!topicTerm || !sameTaxonomyName(item.name, candidate.topicName)) return false;
    if (domainTerm && !sameTaxonomyName(item.domain.name, candidate.domainName)) return false;
    if (sectionTerm) {
      const sectionName = normalize(item.domain.section.name);
      const sectionLabel = normalize(item.domain.section.label);
      // Acepta el código interno de la ingesta ("RW"/"MATH") además del nombre/label
      // oficial, para que el candidato resuelva sin importar cómo quedó guardada la sección.
      const accepted = new Set([sectionName, sectionLabel]);
      if (sectionName.includes("reading") || sectionLabel.includes("reading")) {
        accepted.add("rw").add("r and w").add("reading and writing");
      }
      if (sectionName.includes("math") || sectionLabel.includes("math")) {
        accepted.add("math");
      }
      return accepted.has(sectionTerm);
    }
    return true;
  });
  if (!topic) return { topicId: "", subskillId: "" };

  const subskillTerm = normalize(candidate.subskillName);
  const subskill = subskillTerm ? topic.subskills.find((item) => sameTaxonomyName(item.name, candidate.subskillName)) : null;
  return { topicId: topic.id, subskillId: subskill?.id ?? "" };
}

export function imageUrlsFromLinks(links: ImageLinkForDraft[]) {
  const sorted = [...links].sort((a, b) => a.sortOrder - b.sortOrder);
  const questionImage = imageUrlOrBase64(sorted.find((link) =>
    ["STEM", "STIMULUS", "ANSWER_FIELD", "PAGE_CONTEXT"].includes(link.targetType) && imageUrlOrBase64(link.image)
  )?.image ?? { fileUrl: null }) ?? "";
  const optionImages = new Map<string, string>();
  for (const link of sorted) {
    const imageUrl = imageUrlOrBase64(link.image);
    if (link.targetType !== "OPTION" || !link.optionLabel || !imageUrl) continue;
    if (!optionImages.has(link.optionLabel)) optionImages.set(link.optionLabel, imageUrl);
  }
  return { questionImage, optionImages };
}

export function buildQuestionDraft({
  candidate,
  topics,
  imageLinks,
}: {
  candidate: CandidateForDraft;
  topics: TopicWithRelations[];
  imageLinks: ImageLinkForDraft[];
}) {
  const resolved = resolveTopicFromCandidate(candidate, topics);
  const { questionImage, optionImages } = imageUrlsFromLinks(imageLinks);
  const options = parseIngestOptions(candidate.optionsJson);
  const normalizedOptions = ["A", "B", "C", "D"].map((label) => {
    const existing = options.find((option) => option.label === label);
    return {
      label,
      text: stripMarkdownImageRefs(existing?.text),
      imageUrl: optionImages.get(label) ?? existing?.imageUrl ?? null,
    };
  });

  return {
    topicId: resolved.topicId,
    subskillId: resolved.subskillId,
    difficulty: normalizeIngestDifficulty(candidate.difficulty),
    type: candidate.type === "NUMERIC" ? "NUMERIC" : "MC",
    stem: stripMarkdownImageRefs(candidate.stem),
    stimulus: stripMarkdownImageRefs(candidate.stimulus),
    explanation: sanitizeExplanation(stripMarkdownImageRefs(candidate.explanation)),
    imageUrl: questionImage,
    supportsGraph: false,
    correctAnswer: candidate.correctAnswer ?? "",
    status: "DRAFT",
    options: normalizedOptions,
  };
}

export type QuestionDraft = ReturnType<typeof buildQuestionDraft>;

type OfficialOptionSnapshot = { label: string; text: string | null; imageUrl: string | null };
export type OfficialQuestionSnapshot = {
  stem: string | null;
  stimulus: string | null;
  explanation: string | null;
  correctAnswer: string | null;
  imageUrl: string | null;
  options: OfficialOptionSnapshot[];
};

export type ReconcileResult = {
  changed: string[];
  questionData: Record<string, unknown>;
  /** null = leave options untouched; array = delete+recreate with these */
  replaceOptions: { label: string; text: string; imageUrl: string | null }[] | null;
};

const LATEX_PATTERN = /\$|\\\(|\\\[|\\frac|\\sqrt/;
const OPTION_JUNK_PATTERN = /\]\(|---\s*$|\btbl-\d/;
const hasLatex = (value: string | null | undefined) => LATEX_PATTERN.test(value ?? "");
const normalizeSpace = (value: string | null | undefined) => stripMarkdownImageRefs(value).replace(/\s+/g, " ").trim();
const isValidAnswerShape = (value: string) =>
  /^[A-D](\|[A-D])*$/.test(value) || /^[-0-9][-0-9.,/|\s]*$/.test(value);

/**
 * Reconcile an already-promoted official question against a fresh draft built
 * from the (possibly edited-after-promotion) candidate. STRICTLY additive /
 * corrective — it never degrades official data:
 *  - stimulus/explanation: fill only when official is empty.
 *  - stem: fill when empty, or restore LaTeX the official stem lost (candidate
 *    has `$…$`/`\(…\)`, official does not) — never replace a richer plain stem.
 *  - imageUrl: fill only when official has none.
 *  - correctAnswer: set only when the draft answer is a valid MC/numeric shape
 *    and differs (never blanks a value).
 *  - options (MC): replace only when the draft has 4 clean A–D text options
 *    (no images), the official set is degraded (fewer than 4 texts or carries
 *    leaked markdown-link junk), and official has no option images to protect.
 * Returns the exact field/option changes so callers can apply them in a tx.
 */
export function reconcileOfficialUpdate(draft: QuestionDraft, official: OfficialQuestionSnapshot): ReconcileResult {
  const changed: string[] = [];
  const questionData: Record<string, unknown> = {};

  const draftStimulus = (draft.stimulus ?? "").trim();
  if (draftStimulus && !normalizeSpace(official.stimulus)) {
    questionData.stimulus = draftStimulus;
    changed.push("stimulus");
  }

  const draftExplanation = (draft.explanation ?? "").trim();
  if (draftExplanation && !normalizeSpace(official.explanation)) {
    questionData.explanation = draftExplanation;
    changed.push("explanation");
  }

  const draftStem = (draft.stem ?? "").trim();
  if (
    draftStem &&
    normalizeSpace(draftStem) !== normalizeSpace(official.stem) &&
    (!normalizeSpace(official.stem) || (hasLatex(draftStem) && !hasLatex(official.stem)))
  ) {
    questionData.stem = draftStem;
    changed.push("stem");
  }

  if (draft.imageUrl && !official.imageUrl) {
    questionData.imageUrl = draft.imageUrl;
    changed.push("imageUrl");
  }

  const draftAnswer = (draft.correctAnswer ?? "").trim();
  if (draftAnswer && draftAnswer !== (official.correctAnswer ?? "") && isValidAnswerShape(draftAnswer)) {
    questionData.correctAnswer = draftAnswer;
    changed.push("correctAnswer");
  }

  let replaceOptions: ReconcileResult["replaceOptions"] = null;
  if (draft.type === "MC") {
    const labels = ["A", "B", "C", "D"] as const;
    const draftByLabel = new Map(draft.options.map((option) => [option.label, option]));
    const draftClean4 = labels.every((label) => {
      const option = draftByLabel.get(label);
      return Boolean(option && option.text && option.text.trim() && !option.imageUrl);
    });
    const officialByLabel = new Map(official.options.map((option) => [option.label, option]));
    const officialTextCount = official.options.filter((option) => option.text && option.text.trim()).length;
    const officialHasImage = official.options.some((option) => option.imageUrl);
    const officialJunk = official.options.some((option) => OPTION_JUNK_PATTERN.test(option.text ?? ""));
    const differs = labels.some((label) => {
      const draftOption = draftByLabel.get(label);
      const officialOption = officialByLabel.get(label);
      return !officialOption || normalizeSpace(officialOption.text) !== normalizeSpace(draftOption?.text);
    });
    if (draftClean4 && differs && !officialHasImage && (officialTextCount < 4 || officialJunk)) {
      replaceOptions = labels.map((label) => ({ label, text: draftByLabel.get(label)!.text, imageUrl: null }));
      changed.push("options");
    }
  }

  return { changed, questionData, replaceOptions };
}

export async function loadCandidateQuestionDraft(candidateId: string) {
  const [candidate, topics, rawLinks] = await Promise.all([
    prisma.ingestQuestionCandidate.findUnique({ where: { id: candidateId } }),
    prisma.topic.findMany({ include: { domain: { include: { section: true } }, subskills: true }, orderBy: { name: "asc" } }),
    prisma.ingestCandidateImageLink.findMany({
      where: { candidateId },
      orderBy: [{ targetType: "asc" }, { sortOrder: "asc" }],
    }),
  ]);
  if (!candidate) return null;
  const images = rawLinks.length
    ? await prisma.ingestImageArtifact.findMany({
        where: { id: { in: rawLinks.map((link) => link.imageArtifactId) } },
        select: { id: true, fileUrl: true, base64Data: true, mimeType: true },
      })
    : [];
  const imageById = new Map(images.map((image) => [image.id, image]));
  const imageLinks = rawLinks.map((link) => ({
    targetType: link.targetType,
    optionLabel: link.optionLabel,
    sortOrder: link.sortOrder,
    image: {
      fileUrl: imageById.get(link.imageArtifactId)?.fileUrl ?? null,
      base64Data: imageById.get(link.imageArtifactId)?.base64Data ?? null,
      mimeType: imageById.get(link.imageArtifactId)?.mimeType ?? null,
    },
  }));
  return {
    candidate,
    topics,
    initial: buildQuestionDraft({ candidate, topics, imageLinks }),
  };
}
