// Client-safe types + pure logic for ingest "conjuntos". A conjunto is the
// GROUP of source files that together make one set: at minimum a question file
// plus an answer and/or explanations file (a Full Practice Test section, or a
// Practice Set + its answer key). The server-side computation lives in
// lib/ingest-sets.server.ts; this module is importable from client components
// (the sets index, the review rail) because it has no prisma / server-only dep.
//
// `classifyQuestion` is the single source of truth for per-question completeness,
// shared by the server rows, the client drill-down, and the standalone review
// artifact, so the three can never drift.

export type FieldState = "ok" | "crit" | "warn" | "info" | "na";

export interface QuestionContent {
  type: string; // "MC" | "NUMERIC"
  correctAnswer: string | null;
  stemLen: number;
  stimLen: number;
  optTextCount: number;
  optImgCount: number;
  hasExpl: boolean;
  section: string | null; // "RW" | "MATH" | null
}

export interface QuestionClassification {
  level: "ok" | "warn" | "crit";
  fields: {
    enunciado: FieldState;
    estimulo: FieldState;
    opciones: FieldState;
    respuesta: FieldState;
    explicacion: FieldState;
  };
  notes: string[];
}

// Mirror of the review artifact's rules. crit = unusable for a student (no stem /
// no answer / MC with no options); warn = needs recovery work (missing passage,
// partial options); info = present but worth noting (options as image, no
// explanation). `level` escalates to the worst field; info never raises it.
export function classifyQuestion(c: QuestionContent): QuestionClassification {
  const notes: string[] = [];
  const isMC = c.type === "MC";

  const enunciado: FieldState = c.stemLen > 0 ? "ok" : "crit";
  if (enunciado === "crit") notes.push("sin enunciado");

  const hasAnswer = !!(c.correctAnswer && c.correctAnswer.trim());
  const respuesta: FieldState = hasAnswer ? "ok" : "crit";
  if (respuesta === "crit") notes.push("sin respuesta");

  let opciones: FieldState;
  if (!isMC) {
    opciones = "na";
  } else if (c.optTextCount >= 4) {
    opciones = "ok";
  } else if (c.optImgCount >= 4) {
    opciones = "info";
    notes.push("opciones en imagen");
  } else if (c.optTextCount > 0 || c.optImgCount > 0) {
    opciones = "warn";
    notes.push(`opciones parciales (${c.optTextCount} texto / ${c.optImgCount} img)`);
  } else {
    opciones = "crit";
    notes.push("sin opciones");
  }

  let estimulo: FieldState;
  if (c.section === "RW") {
    estimulo = c.stimLen > 0 ? "ok" : "warn";
    if (estimulo === "warn") notes.push("sin estímulo");
  } else {
    estimulo = "na";
  }

  const explicacion: FieldState = c.hasExpl ? "ok" : "info";
  if (explicacion === "info") notes.push("sin explicación");

  const states = [enunciado, respuesta, opciones, estimulo, explicacion];
  const level: QuestionClassification["level"] = states.includes("crit")
    ? "crit"
    : states.includes("warn")
      ? "warn"
      : "ok";

  return { level, fields: { enunciado, estimulo, opciones, respuesta, explicacion }, notes };
}

export type ConjuntoFileRole = "QUESTION" | "ANSWER" | "EXPLANATION" | "OTHER";

export interface ConjuntoFile {
  id: string;
  name: string;
  role: ConjuntoFileRole;
  nQ: number; // question candidates on this file
  nA: number; // answer candidates on this file
}

export interface QuestionStatusRow {
  candidateId: string;
  sourceFileId: string;
  questionNumber: number | null;
  moduleLabel: string | null;
  type: string;
  answer: string;
  promoted: boolean;
  level: QuestionClassification["level"];
  fields: QuestionClassification["fields"];
  notes: string[];
}

export interface ConjuntoRow {
  key: string;
  batchId: string;
  primaryFileId: string;
  title: string;
  contentType: string; // FULL_PRACTICE_TEST | PRACTICE_SET
  section: string | null; // RW | MATH | null
  difficulty: string | null;
  testNumber: number | null;
  files: ConjuntoFile[];
  fileIds: string[];
  total: number;
  complete: number;
  atencion: number;
  revisar: number;
  sinEnunciado: number;
  sinEstimulo: number;
  sinOpciones: number;
  sinResp: number;
  sinExpl: number;
  promoted: number;
  questions: QuestionStatusRow[];
}

export type SetTypeFilter = "ALL" | "PRACTICE_SET" | "FULL_PRACTICE_TEST";
export type SetSectionFilter = "ALL" | "RW" | "MATH";

export interface SetFilterState {
  query: string;
  type: SetTypeFilter;
  section: SetSectionFilter;
  onlyPending: boolean;
}

// Shared filter + sort used by the full-page index and the review rail so the
// two can never drift. Full tests first (TEST 1 → TEST 10, R&W before Math),
// then practice sets ordered by most to review. "Pending" = anything not fully
// complete (revisar + atención).
export function filterConjuntos(rows: ConjuntoRow[], { query, type, section, onlyPending }: SetFilterState): ConjuntoRow[] {
  const q = query.trim().toLowerCase();
  const pending = (row: ConjuntoRow) => row.revisar + row.atencion;
  const matched = rows.filter((row) => {
    if (type !== "ALL" && row.contentType !== type) return false;
    if (section !== "ALL" && (row.section ?? "") !== section) return false;
    if (onlyPending && pending(row) === 0) return false;
    if (!q) return true;
    const haystack = [row.title, row.section, row.difficulty, row.testNumber ? `test ${row.testNumber}` : null, ...row.files.map((f) => f.name)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
  return matched.sort((a, b) => {
    const ta = a.testNumber ?? Number.POSITIVE_INFINITY;
    const tb = b.testNumber ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    const sa = a.section === "MATH" ? 1 : 0;
    const sb = b.section === "MATH" ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (pending(b) !== pending(a)) return pending(b) - pending(a);
    return a.title.localeCompare(b.title);
  });
}
