// Reference SAT practice taxonomy: Section → Domain → Skill (Topic table), each skill with an Easy,
// Medium and Hard set. Source: "SAT platform/Documentacion de negocio/Referencias de taxonomía SAT/"
// — Taxonomia-SAT.md gives the names shown in the platform and their order; the PDFs (Reading all
// topics, TEMPLATE Math_CookSAT, Writing CB Template) give the domain ↔ skill correspondence and
// their own spellings, kept as aliases. Decisions 2026-10-19 (product owner):
//   - Writing keeps the College Board domains (Standard English Conventions / Expression of Ideas).
//   - "Data, Studies & Experiments" (md) for the claims/studies skill.
//   - Domain names in the md's "&" style: "Problem Solving & Data Analysis", "Geometry & Trigonometry".
//   - PDF names and former names are aliases (TaxonomyAlias table, Admin → Taxonomy).
// Data only (no imports): shared by the app (lib/taxonomy-order.ts) and the seed (prisma/seed-taxonomy.ts).
// Topic ids are stable; only names follow this file.

export type ReferenceSection = "MATH" | "READING" | "WRITING";

/**
 * Another name for a domain or skill. PDF = how a reference PDF prints it; LEGACY = a name the
 * platform or the ingest files used before. Display names are always the md names; aliases only
 * help matching (ingest promotion, search).
 */
export interface ReferenceAlias {
  alias: string;
  source: "PDF" | "LEGACY";
}

export interface ReferenceSkill {
  id: string;
  name: string;
  aliases?: ReferenceAlias[];
}

export interface ReferenceDomain {
  section: ReferenceSection;
  domainId: string;
  domain: string;
  aliases?: ReferenceAlias[];
  skills: ReferenceSkill[];
}

const pdf = (alias: string): ReferenceAlias => ({ alias, source: "PDF" });
const legacy = (alias: string): ReferenceAlias => ({ alias, source: "LEGACY" });

export const SAT_TAXONOMY: ReferenceDomain[] = [
  // ---- Math (PDF: TEMPLATE Math_CookSAT)
  {
    section: "MATH",
    domainId: "dom-algebra",
    domain: "Algebra",
    skills: [
      { id: "top-lineq-one-var", name: "Linear Equations in One Variable", aliases: [legacy("Linear equations in one variable")] },
      { id: "top-linfn", name: "Linear Functions", aliases: [legacy("Linear functions")] },
      { id: "top-lineq-two-var", name: "Linear Equations in Two Variables", aliases: [legacy("Linear equations in two variables")] },
      { id: "top-systems-two-linear", name: "Systems of Linear Equations", aliases: [legacy("Systems of two linear equations in two variables")] },
      { id: "top-linineq", name: "Linear Inequalities", aliases: [legacy("Linear inequalities in one or two variables")] },
    ],
  },
  {
    section: "MATH",
    domainId: "dom-advmath",
    domain: "Advanced Math",
    skills: [
      { id: "top-nonlinfn", name: "Nonlinear Functions", aliases: [legacy("Nonlinear functions")] },
      {
        id: "top-nonlinear-equations",
        name: "Nonlinear Equations",
        aliases: [legacy("Nonlinear equations in one variable and systems of equations in two variables")],
      },
      { id: "top-equivalent-expressions", name: "Equivalent Expressions", aliases: [legacy("Equivalent expressions")] },
    ],
  },
  {
    section: "MATH",
    domainId: "dom-psda",
    domain: "Problem Solving & Data Analysis",
    aliases: [pdf("Problem Solving and Data Analysis"), legacy("Problem-Solving and Data Analysis"), legacy("Problem solving data Analysis")],
    skills: [
      { id: "top-ratios-rates-units", name: "Ratios, Rates, Proportions & Units", aliases: [legacy("Ratios, rates, proportional relationships, and units")] },
      { id: "top-pct", name: "Percentages" },
      { id: "top-statistical-claims", name: "Data, Studies & Experiments", aliases: [pdf("Claims, Studies & Experiments"), legacy("Statistical Claims")] },
      {
        id: "top-data-mean",
        name: "Distributions, Center & Spread",
        aliases: [legacy("One-variable data: Distributions and measures of center and spread")],
      },
      { id: "top-prob", name: "Probability", aliases: [legacy("Probability and conditional probability")] },
      { id: "top-two-var-data", name: "Scatterplots & Models", aliases: [legacy("Two-variable data: Models and scatterplots")] },
      { id: "top-inference-margin", name: "Statistical Inference", aliases: [legacy("Inference from Statistics and Margin of Error")] },
    ],
  },
  {
    section: "MATH",
    domainId: "dom-geotrig",
    domain: "Geometry & Trigonometry",
    aliases: [pdf("Geometry and Trigonometry")],
    skills: [
      { id: "top-area-volume", name: "Area & Volume", aliases: [legacy("Area and volume")] },
      { id: "top-lines-angles-triangles", name: "Lines, Angles & Triangles", aliases: [legacy("Lines, angles, and triangles")] },
      { id: "top-circles", name: "Circles" },
      { id: "top-right-tri-trig", name: "Right Triangles & Trigonometry", aliases: [legacy("Right triangles and trigonometry")] },
    ],
  },
  // ---- Reading (PDF: Reading all topics)
  {
    section: "READING",
    domainId: "dom-info",
    domain: "Information and Ideas",
    skills: [
      { id: "top-central-details", name: "Main Ideas and Details", aliases: [legacy("Central Ideas and Details")] },
      { id: "top-command-evidence", name: "Command of Evidence" },
      { id: "top-infer", name: "Inferences" },
    ],
  },
  {
    section: "READING",
    domainId: "dom-craft",
    domain: "Craft and Structure",
    skills: [
      { id: "top-wic", name: "Words in Context" },
      { id: "top-text-structure-purpose", name: "Text Structure and Purpose" },
      { id: "top-cross", name: "Cross-Text Connections", aliases: [pdf("Cross Text Connections")] },
    ],
  },
  // ---- Writing (PDF: Writing CB Template; domains split as the College Board does)
  {
    section: "WRITING",
    domainId: "dom-sec",
    domain: "Standard English Conventions",
    skills: [
      { id: "top-bound", name: "Boundaries" },
      {
        id: "top-fss",
        name: "Form, Structure & Sense",
        aliases: [pdf("Grammar"), legacy("Grammar and Structure"), legacy("Form, Structure, and Sense")],
      },
    ],
  },
  {
    section: "WRITING",
    domainId: "dom-expr",
    domain: "Expression of Ideas",
    skills: [
      { id: "top-trans", name: "Transitions" },
      { id: "top-rhet", name: "Rhetorical Synthesis" },
    ],
  },
];

/** Every alias row of the reference, with a stable id (seed and migration of the TaxonomyAlias table). */
export function referenceAliases() {
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return SAT_TAXONOMY.flatMap((domain) => [
    ...(domain.aliases ?? []).map((a) => ({ ...a, kind: "DOMAIN" as const, domainId: domain.domainId, topicId: null })),
    ...domain.skills.flatMap((skill) =>
      (skill.aliases ?? []).map((a) => ({ ...a, kind: "SKILL" as const, domainId: domain.domainId, topicId: skill.id as string | null })),
    ),
  ]).map((a) => ({ ...a, id: `tal-${a.kind.toLowerCase()}-${a.source.toLowerCase()}-${slug(a.alias)}` }));
}

/** Skills removed 2026-10-19 (never had sets or questions); not in the reference. */
export const REMOVED_SKILL_IDS = [
  "top-lineq",
  "top-syseq",
  "top-ineq",
  "top-quadfn",
  "top-poly",
  "top-expfn",
  "top-radeq",
  "top-ratprop",
  "top-stats",
  "top-tri",
  "top-trig",
  "top-vol",
  "top-central",
  "top-textev",
  "top-texstr",
  "top-authpur",
] as const;
