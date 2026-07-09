const MODULE_RULES = [
  { section: "RW", expectedCount: 27 },
  { section: "RW", expectedCount: 27 },
  { section: "MATH", expectedCount: 22 },
  { section: "MATH", expectedCount: 22 },
] as const;

export function fullTestModuleRules() {
  return MODULE_RULES;
}

export function validateFullPracticeTestStructure({
  status,
  moduleQuestionIds,
  questionSections,
}: {
  status: string;
  moduleQuestionIds: string[][];
  questionSections: Map<string, string>;
}) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const publish = status === "PUBLISHED";

  MODULE_RULES.forEach((rule, moduleIndex) => {
    const ids = moduleQuestionIds[moduleIndex] ?? [];
    const label = `${rule.section} Module ${rule.section === "RW" ? moduleIndex + 1 : moduleIndex - 1}`;

    if (publish && ids.length !== rule.expectedCount) {
      errors.push(`${label} must contain exactly ${rule.expectedCount} questions to publish.`);
    } else if (!publish && ids.length !== rule.expectedCount) {
      warnings.push(`${label} currently has ${ids.length}/${rule.expectedCount} questions.`);
    }

    ids.forEach((questionId) => {
      if (seen.has(questionId)) {
        errors.push(`Question ${questionId} is duplicated across modules.`);
      }
      seen.add(questionId);

      const section = questionSections.get(questionId);
      if (!section) {
        errors.push(`Question ${questionId} does not exist or is not published.`);
      } else if (section !== rule.section) {
        errors.push(`Question ${questionId} belongs to ${section}, but ${label} requires ${rule.section}.`);
      }
    });
  });

  return { errors, warnings };
}
