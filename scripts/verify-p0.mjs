import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "app/api/attempts/[attemptId]/submit/route.ts",
    requires: ["status: \"IN_PROGRESS\"", "practiceSetSnapshot", "questionSnapshot"],
    label: "Submit guarda snapshots y exige intento IN_PROGRESS",
  },
  {
    file: "app/api/attempts/[attemptId]/invalidate/route.ts",
    requires: ["requireTeacherOrAdmin", "teacherProgramEnrollmentScope", "reason"],
    label: "Invalidate protegido por rol/scope y razón opcional",
  },
  {
    file: "app/api/attempts/[attemptId]/reopen/route.ts",
    requires: ["requireTeacherOrAdmin", "teacherProgramEnrollmentScope", "reason"],
    label: "Reopen protegido por rol/scope y razón opcional",
  },
  {
    file: "app/api/reports/students/[studentId]/pdf/route.ts",
    requires: ["teacherProgramEnrollmentScope", "Not found"],
    label: "PDF con scoping por programa",
  },
  {
    file: "app/api/admin/import/route.ts",
    requires: ["dryRun", "validateRows", "errors"],
    label: "Importación soporta preview y validación por fila",
  },
  {
    file: "app/(student)/student/results/[attemptId]/page.tsx",
    requires: ["canRevealSolutions", "explanationVisibility", "QuestionMedia", "questionSnapshot"],
    label: "Resultados respetan visibilidad de soluciones y snapshots/media",
  },
  {
    file: "app/(student)/student/practice/player-client.tsx",
    requires: ["QuestionMedia", "imageUrl"],
    label: "Player renderiza media de preguntas",
  },
  {
    file: "app/(teacher)/teacher/questions/question-editor-client.tsx",
    requires: ["imageUrl", "QuestionImageField", "QuestionPlayerPreview", "View as player"],
    label: "Editor permite capturar y previsualizar media como player",
  },
  {
    file: "components/question-player-preview.tsx",
    requires: ["QuestionMedia", "imageUrl", "Answer choices", "View as player"],
    label: "Preview de editor replica layout del player",
  },
  {
    file: "lib/activity.ts",
    requires: ["markUserActive", "lastActiveAt", "$executeRaw"],
    label: "Tracking real de ultima actividad escribe lastActiveAt",
  },
  {
    file: "app/(teacher)/teacher/page.tsx",
    requires: ["getStudentLastActiveMap", "lastActiveMap", "Last Active"],
    label: "Dashboard docente usa lastActiveAt real",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/report/page.tsx",
    requires: ["Score Progress Over Time", "scoreTrend", "Progress by Difficulty", "QuestionMedia", "Weak Skills", "Teacher Comments"],
    label: "Reporte individual incluye tendencia temporal, dificultad, media, skills debiles y comentarios",
  },
  {
    file: "app/api/reports/students/[studentId]/pdf/route.ts",
    requires: ["makeReportPdf", "Helvetica-Bold", "Score Progress Over Time", "Progress by Difficulty", "Question Media URLs", "Weak Skills", "Teacher Comments", "parseReportAreas", "areas"],
    label: "PDF presentable incluye secciones, paginacion y resumen enriquecido",
  },
  {
    file: "scripts/verify-authz.mjs",
    requires: ["teacherProgramEnrollmentScope", "studentAccessWhereFor", "parentId_studentId", "requireAdmin"],
    label: "Suite estatica de autorizacion cubre scope, padres y admin",
  },
  {
    file: "lib/full-test-scoring.ts",
    requires: ["validateScoreConversions", "scaledScore", "score must be a 200-800", "interpolated"],
    label: "Full Practice Test scoring valida tabla y calcula score configurable",
  },
  {
    file: "app/(teacher)/teacher/full-tests/scoring/scoring-client.tsx",
    requires: ["Validate Table", "dryRun", "Warnings", "Fix these rows before saving"],
    label: "UI de scoring previsualiza y valida conversiones SAT",
  },
  {
    file: "lib/full-test-validation.ts",
    requires: ["expectedCount: 27", "expectedCount: 22", "duplicated across modules", "requires"],
    label: "Full Practice Test valida distribucion SAT y secciones",
  },
  {
    file: "app/api/full-practice-tests/route.ts",
    requires: ["validateFullPracticeTestStructure", "status: \"PUBLISHED\"", "questionSections"],
    label: "API de Full Practice Test rechaza estructura invalida",
  },
  {
    file: "app/api/full-practice-tests/attempts/[attemptId]/autosave/route.ts",
    requires: ["currentModule", "currentQuestion", "fullPracticeTestAnswer.upsert", "markUserActive", "saveFullTestTimerState", "timeSpentByQuestion"],
    label: "Full Practice Test autosave persiste posicion, timers y respuestas",
  },
  {
    file: "app/(student)/student/full-tests/[assignmentId]/player-client.tsx",
    requires: ["savedAnswers", "savedModule", "savedProgressState", "recordQuestionTime", "timeSpentByQuestion", "Pause & Exit"],
    label: "Player FPT reanuda respuestas, posicion, timer y tiempos por pregunta",
  },
  {
    file: "lib/full-test-progress.ts",
    requires: ["getFullTestTimerState", "saveFullTestTimerState", "moduleTimerState", "$executeRaw"],
    label: "Full Practice Test persiste timer por modulo",
  },
  {
    file: "app/(student)/student/full-tests/results/[attemptId]/page.tsx",
    requires: ["By Module", "By Difficulty", "By Skill", "timeSpent", "StatsPanel"],
    label: "Resultados FPT muestran review por modulo, skill, dificultad y tiempo",
  },
];

let hasFailures = false;

for (const check of checks) {
  const absolutePath = path.join(root, check.file);
  const content = await readFile(absolutePath, "utf8");
  const missing = check.requires.filter((needle) => !content.includes(needle));
  if (missing.length === 0) {
    console.log(`PASS - ${check.label}`);
  } else {
    hasFailures = true;
    console.error(`FAIL - ${check.label}`);
    for (const needle of missing) {
      console.error(`  missing: ${needle}`);
    }
  }
}

if (hasFailures) {
  process.exit(1);
}

console.log("P0 static verification passed.");
