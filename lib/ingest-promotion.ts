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

function imageUrlOrBase64(image: ImageLinkForDraft["image"]) {
  if (image.fileUrl) return image.fileUrl;
  if (!image.base64Data) return null;
  if (image.base64Data.startsWith("data:")) return image.base64Data;
  return `data:${image.mimeType || "image/jpeg"};base64,${image.base64Data}`;
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
    explanation: stripMarkdownImageRefs(candidate.explanation),
    imageUrl: questionImage,
    supportsGraph: false,
    correctAnswer: candidate.correctAnswer ?? "",
    status: "DRAFT",
    options: normalizedOptions,
  };
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
