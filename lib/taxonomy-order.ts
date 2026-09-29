// Official display order of domains and skills (Topic table = SKILL level).
// Math follows the "SAT Math — Skills Tracker" (College Board order and names); Reading follows
// the College Board list (Information and Ideas; Craft and Structure, incl. Cross-Text
// Connections). Writing keeps its current order. Only these skills are shown in filters,
// content maps and reports; legacy topics without content stay in the DB but are hidden.
import prisma from "@/lib/prisma";
import type { PracticeAreaCode } from "@/lib/practice-area";

export const TAXONOMY_ORDER: Array<{ domainId: string; domain: string; skills: Array<{ id: string; name: string }> }> = [
  // ---- Math
  {
    domainId: "dom-algebra",
    domain: "Algebra",
    skills: [
      { id: "top-lineq-one-var", name: "Linear equations in one variable" },
      { id: "top-linfn", name: "Linear functions" },
      { id: "top-lineq-two-var", name: "Linear equations in two variables" },
      { id: "top-systems-two-linear", name: "Systems of two linear equations in two variables" },
      { id: "top-linineq", name: "Linear inequalities in one or two variables" },
    ],
  },
  {
    domainId: "dom-advmath",
    domain: "Advanced Math",
    skills: [
      { id: "top-nonlinfn", name: "Nonlinear functions" },
      { id: "top-nonlinear-equations", name: "Nonlinear equations in one variable and systems of equations in two variables" },
      { id: "top-equivalent-expressions", name: "Equivalent expressions" },
    ],
  },
  {
    domainId: "dom-psda",
    domain: "Problem-Solving and Data Analysis",
    skills: [
      { id: "top-ratios-rates-units", name: "Ratios, rates, proportional relationships, and units" },
      { id: "top-pct", name: "Percentages" },
      { id: "top-data-mean", name: "One-variable data: Distributions and measures of center and spread" },
      { id: "top-two-var-data", name: "Two-variable data: Models and scatterplots" },
      { id: "top-prob", name: "Probability and conditional probability" },
      { id: "top-inference-margin", name: "Inference from Statistics and Margin of Error" },
      { id: "top-statistical-claims", name: "Statistical Claims" },
    ],
  },
  {
    domainId: "dom-geotrig",
    domain: "Geometry and Trigonometry",
    skills: [
      { id: "top-area-volume", name: "Area and volume" },
      { id: "top-lines-angles-triangles", name: "Lines, angles, and triangles" },
      { id: "top-right-tri-trig", name: "Right triangles and trigonometry" },
      { id: "top-circles", name: "Circles" },
    ],
  },
  // ---- Reading
  {
    domainId: "dom-info",
    domain: "Information and Ideas",
    skills: [
      { id: "top-central-details", name: "Main Ideas and Details" },
      { id: "top-command-evidence", name: "Command of Evidence" },
      { id: "top-infer", name: "Inferences" },
    ],
  },
  {
    domainId: "dom-craft",
    domain: "Craft and Structure",
    skills: [
      { id: "top-wic", name: "Words in Context" },
      { id: "top-text-structure-purpose", name: "Text Structure and Purpose" },
      { id: "top-cross", name: "Cross-Text Connections" },
    ],
  },
  // ---- Writing (unchanged order and names)
  {
    domainId: "dom-expr",
    domain: "Expression of Ideas",
    skills: [
      { id: "top-rhet", name: "Rhetorical Synthesis" },
      { id: "top-trans", name: "Transitions" },
    ],
  },
  {
    domainId: "dom-sec",
    domain: "Standard English Conventions",
    skills: [
      { id: "top-bound", name: "Boundaries" },
      { id: "top-fss", name: "Grammar and Structure" },
    ],
  },
];

const DOMAIN_RANK = new Map(TAXONOMY_ORDER.map((entry, index) => [entry.domainId, index]));
const SKILL_RANK = new Map(
  TAXONOMY_ORDER.flatMap((entry, domainIndex) => entry.skills.map((skill, index) => [skill.id, domainIndex * 100 + index] as const)),
);
const DIFFICULTY_RANK: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

export function isOfficialSkill(topicId: string) {
  return SKILL_RANK.has(topicId);
}

export function domainRank(domainId: string) {
  return DOMAIN_RANK.get(domainId) ?? Number.MAX_SAFE_INTEGER;
}

export function skillRank(topicId: string) {
  return SKILL_RANK.get(topicId) ?? Number.MAX_SAFE_INTEGER;
}

export function compareSkills(a: { id: string; name?: string }, b: { id: string; name?: string }) {
  return skillRank(a.id) - skillRank(b.id) || (a.name ?? "").localeCompare(b.name ?? "");
}

export function compareDomains(a: { id: string; name?: string }, b: { id: string; name?: string }) {
  return domainRank(a.id) - domainRank(b.id) || (a.name ?? "").localeCompare(b.name ?? "");
}

/** Sort key for practice sets: domain → skill → difficulty → name. */
export function comparePracticeSets(
  a: { topicId: string; difficulty: string; name: string },
  b: { topicId: string; difficulty: string; name: string },
) {
  return (
    skillRank(a.topicId) - skillRank(b.topicId) ||
    (DIFFICULTY_RANK[a.difficulty] ?? 9) - (DIFFICULTY_RANK[b.difficulty] ?? 9) ||
    a.name.localeCompare(b.name)
  );
}

/** Official skills of a practice area in display order, with their domain for grouping. */
export async function officialSkillsFor(practiceArea: PracticeAreaCode) {
  const topics = await prisma.topic.findMany({
    where: { domain: { practiceArea } },
    select: { id: true, name: true, domainId: true, domain: { select: { name: true } } },
  });
  return topics
    .filter((topic) => isOfficialSkill(topic.id))
    .sort(compareSkills)
    .map((topic) => ({ id: topic.id, name: topic.name, domainId: topic.domainId, domain: topic.domain.name }));
}
