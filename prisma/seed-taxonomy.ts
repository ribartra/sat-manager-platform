import type { PrismaClient } from "../app/generated/prisma/client.js";

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

  const mathDomains = await Promise.all([
    prisma.domain.upsert({
      where: { id: "dom-algebra" },
      update: { name: "Algebra", practiceArea: "MATH", sectionId: mathSection.id },
      create: { id: "dom-algebra", name: "Algebra", sectionId: mathSection.id, practiceArea: "MATH" },
    }),
    prisma.domain.upsert({
      where: { id: "dom-advmath" },
      update: { name: "Advanced Math", practiceArea: "MATH", sectionId: mathSection.id },
      create: { id: "dom-advmath", name: "Advanced Math", sectionId: mathSection.id, practiceArea: "MATH" },
    }),
    prisma.domain.upsert({
      where: { id: "dom-psda" },
      update: { name: "Problem-Solving and Data Analysis", practiceArea: "MATH", sectionId: mathSection.id },
      create: { id: "dom-psda", name: "Problem-Solving and Data Analysis", sectionId: mathSection.id, practiceArea: "MATH" },
    }),
    prisma.domain.upsert({
      where: { id: "dom-geotrig" },
      update: { name: "Geometry and Trigonometry", practiceArea: "MATH", sectionId: mathSection.id },
      create: { id: "dom-geotrig", name: "Geometry and Trigonometry", sectionId: mathSection.id, practiceArea: "MATH" },
    }),
  ]);

  const rwDomains = await Promise.all([
    prisma.domain.upsert({
      where: { id: "dom-info" },
      update: { name: "Information and Ideas", practiceArea: "READING", sectionId: readingSection.id },
      create: { id: "dom-info", name: "Information and Ideas", sectionId: readingSection.id, practiceArea: "READING" },
    }),
    prisma.domain.upsert({
      where: { id: "dom-craft" },
      update: { name: "Craft and Structure", practiceArea: "READING", sectionId: readingSection.id },
      create: { id: "dom-craft", name: "Craft and Structure", sectionId: readingSection.id, practiceArea: "READING" },
    }),
    prisma.domain.upsert({
      where: { id: "dom-expr" },
      update: { name: "Expression of Ideas", practiceArea: "WRITING", sectionId: writingSection.id },
      create: { id: "dom-expr", name: "Expression of Ideas", sectionId: writingSection.id, practiceArea: "WRITING" },
    }),
    prisma.domain.upsert({
      where: { id: "dom-sec" },
      update: { name: "Standard English Conventions", practiceArea: "WRITING", sectionId: writingSection.id },
      create: { id: "dom-sec", name: "Standard English Conventions", sectionId: writingSection.id, practiceArea: "WRITING" },
    }),
  ]);

  const topicDefs: Record<string, { id: string; name: string }[]> = {
    "dom-algebra": [
      { id: "top-lineq", name: "Linear Equations" },
      { id: "top-lineq-one-var", name: "Linear equations in one variable" },
      { id: "top-lineq-two-var", name: "Linear equations in two variables" },
      { id: "top-syseq", name: "Systems of Equations" },
      { id: "top-systems-two-linear", name: "Systems of two linear equations in two variables" },
      { id: "top-ineq", name: "Inequalities" },
      { id: "top-linineq", name: "Linear inequalities in one or two variables" },
      { id: "top-linfn", name: "Linear functions" },
    ],
    "dom-advmath": [
      { id: "top-equivalent-expressions", name: "Equivalent expressions" },
      { id: "top-nonlinear-equations", name: "Nonlinear equations in one variable and systems of equations in two variables" },
      { id: "top-quadfn", name: "Quadratic Functions" },
      { id: "top-nonlinfn", name: "Nonlinear functions" },
      { id: "top-poly", name: "Polynomials" },
      { id: "top-expfn", name: "Exponential Functions" },
      { id: "top-radeq", name: "Radical Equations" },
    ],
    "dom-psda": [
      { id: "top-ratprop", name: "Ratios and Proportions" },
      { id: "top-ratios-rates-units", name: "Ratios, rates, proportional relationships, and units" },
      { id: "top-pct", name: "Percentages" },
      { id: "top-stats", name: "Statistics" },
      { id: "top-data-mean", name: "One-variable data: Distributions and measures of center and spread" },
      { id: "top-two-var-data", name: "Two-variable data: Models and scatterplots" },
      { id: "top-inference-margin", name: "Inference from Statistics and Margin of Error" },
      { id: "top-statistical-claims", name: "Statistical Claims" },
      { id: "top-prob", name: "Probability and conditional probability" },
    ],
    "dom-geotrig": [
      { id: "top-circles", name: "Circles" },
      { id: "top-tri", name: "Triangles" },
      { id: "top-lines-angles-triangles", name: "Lines, angles, and triangles" },
      { id: "top-area-volume", name: "Area and volume" },
      { id: "top-right-tri-trig", name: "Right triangles and trigonometry" },
      { id: "top-trig", name: "Trigonometry" },
      { id: "top-vol", name: "Volume and Area" },
    ],
    "dom-info": [
      { id: "top-central", name: "Central Ideas" },
      { id: "top-central-details", name: "Main Ideas and Details" },
      { id: "top-command-evidence", name: "Command of Evidence" },
      { id: "top-textev", name: "Textual Evidence" },
      { id: "top-infer", name: "Inferences" },
    ],
    "dom-craft": [
      // College Board: Cross-Text Connections belongs to Craft and Structure.
      { id: "top-cross", name: "Cross-Text Connections" },
      { id: "top-wic", name: "Words in Context" },
      { id: "top-texstr", name: "Text Structure" },
      { id: "top-text-structure-purpose", name: "Text Structure and Purpose" },
      { id: "top-authpur", name: "Author Purpose" },
    ],
    "dom-expr": [
      { id: "top-rhet", name: "Rhetorical Synthesis" },
      { id: "top-trans", name: "Transitions" },
    ],
    "dom-sec": [
      { id: "top-bound", name: "Boundaries" },
      { id: "top-fss", name: "Grammar and Structure" },
    ],
  };
  // Subskill level = intended home of the real "Topic" level below Skill; empty until the
  // topic catalogue is defined (the old test entry was removed 2026-09-29).
  const subskillDefs: Record<string, { id: string; name: string }[]> = {};

  const allDomains = [...mathDomains, ...rwDomains];
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
  const seededTopics = await prisma.topic.findMany({ include: { subskills: true } });
  await Promise.all(
    seededTopics.map((topic, index) =>
      prisma.taxonomyNode.upsert({
        where: { id: `tax-skill-${topic.id}` },
        update: { name: topic.name, label: topic.name, type: "SKILL", parentId: `tax-topic-${topic.domainId}`, sortOrder: index, active: true },
        create: { id: `tax-skill-${topic.id}`, name: topic.name, label: topic.name, type: "SKILL", parentId: `tax-topic-${topic.domainId}`, sortOrder: index, active: true },
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
