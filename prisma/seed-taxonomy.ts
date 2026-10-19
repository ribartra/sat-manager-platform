import type { PrismaClient } from "../app/generated/prisma/client.js";
import { SAT_TAXONOMY } from "../lib/taxonomy-reference";

// Canonical academic taxonomy (Section → Domain → Topic[=Skill] → Subskill) plus
// the parallel TaxonomyNode tree. Shared by both the demo seed (prisma/seed.ts)
// and the production seed (prisma/seed.prod.ts) so there is a single source of
// truth. See CLAUDE.md "Taxonomía" for the Topic↔Skill divergence this encodes.
export async function seedTaxonomy(prisma: PrismaClient): Promise<void> {
  // Official sections. Practice: MATH, READING, WRITING (Domain.practiceArea = section name, enforced
  // by triggers from migration 20261018_practice_sections). READING_WRITING only holds the Test
  // placeholder domain (Tests have 2 sections: Math and Reading & Writing).
  const mathSection = await prisma.section.upsert({
    where: { name: "MATH" },
    update: { label: "Math" },
    create: { name: "MATH", label: "Math" },
  });
  const readingSection = await prisma.section.upsert({
    where: { name: "READING" },
    update: { label: "Reading" },
    create: { id: "sec-reading", name: "READING", label: "Reading" },
  });
  const writingSection = await prisma.section.upsert({
    where: { name: "WRITING" },
    update: { label: "Writing" },
    create: { id: "sec-writing", name: "WRITING", label: "Writing" },
  });
  const rwSection = await prisma.section.upsert({
    where: { name: "READING_WRITING" },
    update: { label: "Reading & Writing" },
    create: { name: "READING_WRITING", label: "Reading & Writing" },
  });

  // Domains and skills from the reference taxonomy (lib/taxonomy-reference.ts ← Taxonomia-SAT.md).
  const sectionByCode = { MATH: mathSection, READING: readingSection, WRITING: writingSection };
  const allDomains: Array<{ id: string; name: string; sectionId: string }> = [];
  for (const ref of SAT_TAXONOMY) {
    const section = sectionByCode[ref.section];
    allDomains.push(
      await prisma.domain.upsert({
        where: { id: ref.domainId },
        update: { name: ref.domain, practiceArea: ref.section, sectionId: section.id },
        create: { id: ref.domainId, name: ref.domain, sectionId: section.id, practiceArea: ref.section },
      }),
    );
  }
  const topicDefs: Record<string, { id: string; name: string }[]> = Object.fromEntries(SAT_TAXONOMY.map((ref) => [ref.domainId, ref.skills]));
  // Subskill level = intended home of the real "Topic" level below Skill; empty until the
  // topic catalogue is defined (the old test entry was removed 2026-09-29).
  const subskillDefs: Record<string, { id: string; name: string }[]> = {};

  for (const domain of allDomains) {
    const defs = topicDefs[domain.id] ?? [];
    await Promise.all(
      defs.map((t) =>
        prisma.topic.upsert({
          where: { id: t.id },
          update: { name: t.name, domainId: domain.id },
          create: { id: t.id, name: t.name, domainId: domain.id },
        })
      )
    );
  }
  for (const [topicId, defs] of Object.entries(subskillDefs)) {
    await Promise.all(
      defs.map((subskill) =>
        prisma.subskill.upsert({
          where: { id: subskill.id },
          update: { name: subskill.name, topicId },
          create: { id: subskill.id, name: subskill.name, topicId },
        })
      )
    );
  }

  const allSections = [mathSection, readingSection, writingSection, rwSection];
  await Promise.all(
    allSections.map((section, index) =>
      prisma.taxonomyNode.upsert({
        where: { id: `tax-area-${section.id}` },
        // READING_WRITING only holds the Test placeholder domain: not part of the practice tree.
        update: { name: section.name, label: section.label, type: "AREA", parentId: null, sortOrder: index, active: section.name !== "READING_WRITING" },
        create: { id: `tax-area-${section.id}`, name: section.name, label: section.label, type: "AREA", sortOrder: index, active: section.name !== "READING_WRITING" },
      })
    )
  );
  await Promise.all(
    allDomains.map((domain, index) =>
      prisma.taxonomyNode.upsert({
        where: { id: `tax-topic-${domain.id}` },
        update: { name: domain.name, label: domain.name, type: "DOMAIN", parentId: `tax-area-${domain.sectionId}`, sortOrder: index, active: true },
        create: { id: `tax-topic-${domain.id}`, name: domain.name, label: domain.name, type: "DOMAIN", parentId: `tax-area-${domain.sectionId}`, sortOrder: index, active: true },
      })
    )
  );
  const skillOrder = new Map(SAT_TAXONOMY.flatMap((ref) => ref.skills).map((skill, index) => [skill.id, index]));
  // Only reference skills get a SKILL node (Test placeholder topics "M1"/"M2" have none by design).
  const seededTopics = await prisma.topic.findMany({
    where: { domainId: { in: allDomains.map((domain) => domain.id) } },
    include: { subskills: true },
  });
  await Promise.all(
    seededTopics.map((topic, index) =>
      prisma.taxonomyNode.upsert({
        where: { id: `tax-skill-${topic.id}` },
        update: { name: topic.name, label: topic.name, type: "SKILL", parentId: `tax-topic-${topic.domainId}`, sortOrder: skillOrder.get(topic.id) ?? index, active: true },
        create: { id: `tax-skill-${topic.id}`, name: topic.name, label: topic.name, type: "SKILL", parentId: `tax-topic-${topic.domainId}`, sortOrder: skillOrder.get(topic.id) ?? index, active: true },
      })
    )
  );
  await Promise.all(
    seededTopics.map((topic) =>
      prisma.topic.update({
        where: { id: topic.id },
        data: { taxonomyNodeId: `tax-skill-${topic.id}` },
      })
    )
  );
  const seededSubskills = seededTopics.flatMap((topic) => topic.subskills.map((subskill) => ({ ...subskill, topicId: topic.id })));
  await Promise.all(
    seededSubskills.map((subskill, index) =>
      prisma.taxonomyNode.upsert({
        where: { id: `tax-subskill-${subskill.id}` },
        update: { name: subskill.name, label: subskill.name, type: "SUBSKILL", parentId: `tax-skill-${subskill.topicId}`, sortOrder: index, active: true },
        create: { id: `tax-subskill-${subskill.id}`, name: subskill.name, label: subskill.name, type: "SUBSKILL", parentId: `tax-skill-${subskill.topicId}`, sortOrder: index, active: true },
      })
    )
  );
  await Promise.all(
    seededSubskills.map((subskill) =>
      prisma.subskill.update({
        where: { id: subskill.id },
        data: { taxonomyNodeId: `tax-subskill-${subskill.id}` },
      })
    )
  );
}

// SAT raw→scaled score conversion tables for Full Practice Tests. Production-safe
// (no synthetic questions), required for FPT scoring. Shared by both seeds.
export async function seedScoreConversions(prisma: PrismaClient): Promise<void> {
  for (const section of ["RW", "MATH"] as const) {
    const maxRaw = section === "RW" ? 54 : 44;
    for (let rawCorrect = 0; rawCorrect <= maxRaw; rawCorrect += 1) {
      const score = Math.round((200 + (rawCorrect / maxRaw) * 600) / 10) * 10;
      await prisma.fullPracticeTestScoreConversion.upsert({
        where: { section_rawCorrect: { section, rawCorrect } },
        update: { score },
        create: { section, rawCorrect, score },
      });
    }
  }
}
