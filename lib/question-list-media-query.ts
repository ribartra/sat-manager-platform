import prisma from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

/** SQLite default max bind vars ~999; keep headroom for other clause params. */
const IN_CHUNK = 400;

export type QuestionListMediaRow = {
  id: string;
  stem: string;
  imageUrl: string | null;
  stimulus: string | null;
  topicId: string;
  difficulty: string;
  type: string;
  status: string;
  optionImageUrls: string[];
};

function chunkIds<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function loadOptionImageUrlsByQuestionId(questionIds: string[]): Promise<Map<string, string[]>> {
  const byQuestion = new Map<string, string[]>();
  for (const ids of chunkIds(questionIds, IN_CHUNK)) {
    if (ids.length === 0) continue;
    const rows = await prisma.questionOption.findMany({
      where: {
        questionId: { in: ids },
        imageUrl: { not: null },
      },
      select: { questionId: true, imageUrl: true },
    });
    for (const row of rows) {
      if (!row.imageUrl?.trim()) continue;
      const list = byQuestion.get(row.questionId) ?? [];
      list.push(row.imageUrl);
      byQuestion.set(row.questionId, list);
    }
  }
  return byQuestion;
}

/**
 * Load questions for picker/list UIs without nested `include options`
 * (avoids Prisma P2029 / SQLite variable limit on large banks).
 */
export async function findQuestionsWithOptionMedia(
  where: Prisma.QuestionWhereInput,
  options?: { orderBy?: Prisma.QuestionOrderByWithRelationInput; take?: number }
): Promise<QuestionListMediaRow[]> {
  const questions = await prisma.question.findMany({
    where,
    select: {
      id: true,
      stem: true,
      imageUrl: true,
      stimulus: true,
      topicId: true,
      difficulty: true,
      type: true,
      status: true,
    },
    orderBy: options?.orderBy ?? { createdAt: "desc" },
    take: options?.take,
  });

  const byQuestion = await loadOptionImageUrlsByQuestionId(questions.map((q) => q.id));

  return questions.map((q) => ({
    ...q,
    optionImageUrls: byQuestion.get(q.id) ?? [],
  }));
}

export type QuestionListMediaWithSection = QuestionListMediaRow & {
  section: "MATH" | "RW";
  label: string;
};

function plainMathLabel(content: string, maxLength: number) {
  const label = content
    .replace(/\$\$([\s\S]+?)\$\$/g, "$1")
    .replace(/\\\[([\s\S]+?)\\\]/g, "$1")
    .replace(/\$([^$\n]+?)\$/g, "$1")
    .replace(/\\\(([\s\S]+?)\\\)/g, "$1");
  return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;
}

/** Full-test picker: questions + section from topic taxonomy. */
export async function findQuestionsWithOptionMediaAndSection(
  where: Prisma.QuestionWhereInput
): Promise<QuestionListMediaWithSection[]> {
  const questions = await prisma.question.findMany({
    where,
    select: {
      id: true,
      stem: true,
      imageUrl: true,
      stimulus: true,
      topicId: true,
      difficulty: true,
      type: true,
      status: true,
      topic: { select: { domain: { select: { section: { select: { name: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byQuestion = await loadOptionImageUrlsByQuestionId(questions.map((q) => q.id));

  return questions.map((q) => {
    const section = q.topic.domain.section.name === "MATH" ? "MATH" : "RW";
    return {
      id: q.id,
      stem: q.stem,
      imageUrl: q.imageUrl,
      stimulus: q.stimulus,
      topicId: q.topicId,
      difficulty: q.difficulty,
      type: q.type,
      status: q.status,
      optionImageUrls: byQuestion.get(q.id) ?? [],
      section,
      label: `${section} · ${q.difficulty} · ${plainMathLabel(q.stem, 100)}`,
    };
  });
}
