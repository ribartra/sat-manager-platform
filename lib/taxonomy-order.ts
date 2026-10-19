// Official display order of domains and skills (Topic table = SKILL level), from the reference
// taxonomy (lib/taxonomy-reference.ts ← Taxonomia-SAT.md). Only these skills are shown in filters,
// Practice and reports.
import prisma from "@/lib/prisma";
import type { PracticeAreaCode } from "@/lib/practice-area";
import { SAT_TAXONOMY } from "@/lib/taxonomy-reference";

export const TAXONOMY_ORDER: Array<{ domainId: string; domain: string; skills: Array<{ id: string; name: string }> }> = SAT_TAXONOMY;

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
