import prisma from "@/lib/prisma";

/**
 * Attempts store only the student's answer (the option letter, or the typed value) and read the
 * question from the bank. So once a question has been answered, it can be fixed (text, images,
 * explanation, answer key: a new key re-grades the attempts) but not turned into another question:
 * its type and its choice letters must keep meaning the same thing. For a different question, Duplicate.
 */

/** How many times students answered this question (practice + Tests, any status). */
export async function questionAnswerCount(questionId: string) {
  const [practice, tests] = await Promise.all([
    prisma.attemptAnswer.count({ where: { questionId, answer: { not: null } } }),
    prisma.fullPracticeTestAnswer.count({ where: { questionId, answer: { not: null } } }),
  ]);
  return practice + tests;
}

type ChoiceShape = { type: string; options: { label: string; text: string; imageUrl?: string | null }[] };

const hasContent = (option: { text: string; imageUrl?: string | null }) => Boolean(option.text?.trim() || option.imageUrl?.trim());
const norm = (text: string) => text.replace(/\s+/g, " ").trim();

/** Why this edit would change what past answers mean (empty when it is safe). */
export function answerMeaningIssues(before: ChoiceShape, after: ChoiceShape, answeredCount: number): string[] {
  if (answeredCount === 0) return [];
  const why = `Students answered this question ${answeredCount} ${answeredCount === 1 ? "time" : "times"}`;
  const issues: string[] = [];
  if (before.type !== after.type) {
    issues.push(`${why}: its type can't change. To make a different question, use Duplicate.`);
    return issues;
  }
  if (before.type !== "MC") return issues;
  const beforeLabels = before.options.filter(hasContent).map((o) => o.label).sort().join(",");
  const afterLabels = after.options.filter(hasContent).map((o) => o.label).sort().join(",");
  if (beforeLabels !== afterLabels) {
    issues.push(`${why}: keep the same choices (${beforeLabels.replace(/,/g, ", ")}); you can fix their text, not add or remove letters. To make a different question, use Duplicate.`);
    return issues;
  }
  const beforeByLabel = new Map(before.options.map((o) => [o.label, norm(o.text)]));
  for (const option of after.options) {
    const text = norm(option.text);
    if (!text || text === beforeByLabel.get(option.label)) continue;
    const movedFrom = [...beforeByLabel].find(([label, old]) => label !== option.label && old && old === text);
    if (movedFrom) {
      issues.push(`${why}: choice ${movedFrom[0]} can't move to ${option.label} (past answers keep their letter). To reorder the choices, use Duplicate.`);
    }
  }
  return issues;
}
