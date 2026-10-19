// Reference SAT practice taxonomy: Section → Domain → Skill (Topic table), each skill with an Easy,
// Medium and Hard set. Source: "SAT platform/Documentacion de negocio/Referencias de taxonomía SAT/
// Taxonomia-SAT.md" (names, order). Decisions 2026-10-19 (product owner):
//   - Writing keeps the College Board domains (Expression of Ideas / Standard English Conventions).
//   - "Data, Studies & Experiments" (md) for the claims/studies skill.
//   - Domain names in the md's "&" style: "Problem Solving & Data Analysis", "Geometry & Trigonometry".
// Data only (no imports): shared by the app (lib/taxonomy-order.ts) and the seed (prisma/seed-taxonomy.ts).
// Topic ids are stable; only names follow this file.

export type ReferenceSection = "MATH" | "READING" | "WRITING";

export interface ReferenceDomain {
  section: ReferenceSection;
  domainId: string;
  domain: string;
  skills: Array<{ id: string; name: string }>;
}

export const SAT_TAXONOMY: ReferenceDomain[] = [
  // ---- Math
  {
    section: "MATH",
    domainId: "dom-algebra",
    domain: "Algebra",
    skills: [
      { id: "top-lineq-one-var", name: "Linear Equations in One Variable" },
      { id: "top-linfn", name: "Linear Functions" },
      { id: "top-lineq-two-var", name: "Linear Equations in Two Variables" },
      { id: "top-systems-two-linear", name: "Systems of Linear Equations" },
      { id: "top-linineq", name: "Linear Inequalities" },
    ],
  },
  {
    section: "MATH",
    domainId: "dom-advmath",
    domain: "Advanced Math",
    skills: [
      { id: "top-nonlinfn", name: "Nonlinear Functions" },
      { id: "top-nonlinear-equations", name: "Nonlinear Equations" },
      { id: "top-equivalent-expressions", name: "Equivalent Expressions" },
    ],
  },
  {
    section: "MATH",
    domainId: "dom-psda",
    domain: "Problem Solving & Data Analysis",
    skills: [
      { id: "top-ratios-rates-units", name: "Ratios, Rates, Proportions & Units" },
      { id: "top-pct", name: "Percentages" },
      { id: "top-statistical-claims", name: "Data, Studies & Experiments" },
      { id: "top-data-mean", name: "Distributions, Center & Spread" },
      { id: "top-prob", name: "Probability" },
      { id: "top-two-var-data", name: "Scatterplots & Models" },
      { id: "top-inference-margin", name: "Statistical Inference" },
    ],
  },
  {
    section: "MATH",
    domainId: "dom-geotrig",
    domain: "Geometry & Trigonometry",
    skills: [
      { id: "top-area-volume", name: "Area & Volume" },
      { id: "top-lines-angles-triangles", name: "Lines, Angles & Triangles" },
      { id: "top-circles", name: "Circles" },
      { id: "top-right-tri-trig", name: "Right Triangles & Trigonometry" },
    ],
  },
  // ---- Reading
  {
    section: "READING",
    domainId: "dom-info",
    domain: "Information and Ideas",
    skills: [
      { id: "top-central-details", name: "Main Ideas and Details" },
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
      { id: "top-cross", name: "Cross-Text Connections" },
    ],
  },
  // ---- Writing (md skill order; College Board domains)
  {
    section: "WRITING",
    domainId: "dom-sec",
    domain: "Standard English Conventions",
    skills: [
      { id: "top-bound", name: "Boundaries" },
      { id: "top-fss", name: "Form, Structure & Sense" },
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

/**
 * Former skill names → topic id. Ingest files, staging candidates and old snapshots still use them;
 * matching goes through this map so they land on the reference skill.
 */
export const LEGACY_SKILL_NAMES: Record<string, string> = {
  "Linear equations in one variable": "top-lineq-one-var",
  "Linear functions": "top-linfn",
  "Linear equations in two variables": "top-lineq-two-var",
  "Systems of two linear equations in two variables": "top-systems-two-linear",
  "Linear inequalities in one or two variables": "top-linineq",
  "Nonlinear functions": "top-nonlinfn",
  "Nonlinear equations in one variable and systems of equations in two variables": "top-nonlinear-equations",
  "Equivalent expressions": "top-equivalent-expressions",
  "Ratios, rates, proportional relationships, and units": "top-ratios-rates-units",
  "Statistical Claims": "top-statistical-claims",
  "Claims, Studies & Experiments": "top-statistical-claims",
  "One-variable data: Distributions and measures of center and spread": "top-data-mean",
  "Probability and conditional probability": "top-prob",
  "Two-variable data: Models and scatterplots": "top-two-var-data",
  "Inference from Statistics and Margin of Error": "top-inference-margin",
  "Area and volume": "top-area-volume",
  "Lines, angles, and triangles": "top-lines-angles-triangles",
  "Right triangles and trigonometry": "top-right-tri-trig",
  "Grammar and Structure": "top-fss",
  "Form, Structure, and Sense": "top-fss",
};

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

/** Former domain names → domain id (ingest staging and older files). */
export const LEGACY_DOMAIN_NAMES: Record<string, string> = {
  "Problem-Solving and Data Analysis": "dom-psda",
  "Problem Solving and Data Analysis": "dom-psda",
  "Geometry and Trigonometry": "dom-geotrig",
};
