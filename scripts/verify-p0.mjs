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
    file: "lib/attempt-lifecycle.ts",
    requires: ['data: { status: "INVALIDATED" }', '"PENDING"', "writeAudit", "FPT_ATTEMPT_REOPENED", "FPT_ATTEMPT_INVALIDATED", "ALREADY_INVALIDATED"],
    label: "Intentos atomicos: invalidar conserva el intento; reabrir invalida y devuelve la asignacion a PENDING (Practice y FPT)",
  },
  {
    file: "app/(student)/student/full-tests/results/[attemptId]/page.tsx",
    requires: ['attempt.status === "IN_PROGRESS"', "InvalidatedNotice", "VoidableValue", "markedForReview"],
    label: "Resultados FPT: no muestran intentos abiertos; invalidados tachados; herramientas de revision",
  },
  {
    file: "lib/student-report.ts",
    requires: ["attemptHistory", "examHistory", 'status: "SUBMITTED"', "attemptId"],
    label: "Reportes: puntajes solo con SUBMITTED; historial incluye invalidados; reporte por examen",
  },
  {
    file: "lib/pdf/build-student-report.ts",
    requires: ["teacherProgramEnrollmentScope", "return null"],
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
    requires: ["QuestionMedia", "imageUrl", "questionResponseLabel", "View as player"],
    label: "Preview de editor replica layout del player",
  },
  {
    file: "lib/activity.ts",
    requires: ["markUserActive", "lastActiveAt", "$executeRaw"],
    label: "Tracking real de ultima actividad escribe lastActiveAt",
  },
  {
    file: "app/(teacher)/teacher/page.tsx",
    requires: ["areaActivity", "lastActiveAt", "TeacherStudentsTable"],
    label: "Dashboard docente usa ultima actividad por area y DataTable de estudiantes",
  },
  {
    file: "app/(teacher)/teacher/students-table-client.tsx",
    requires: ["Last Active", "lastActiveLabel", "lastActiveTone"],
    label: "Tabla de estudiantes expone columna Last Active",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/page.tsx",
    requires: ["loadPracticeReport", "Average score", "Total time", "PerformanceBreakdown", "Skill performance by difficulty", "Teacher Comments", "GenerateReportDialog"],
    label: "Pagina del alumno (ex reporte individual) incluye score ponderado, dificultad, skills debiles, comentarios y PDF",
  },
  {
    file: "lib/student-report.ts",
    requires: ["aggregateTopicDifficultyMetrics", "summarizeAllQuestionAnswers", "parseSnapshot", "loadMockReport", "timeSpent", "topic.name"],
    label: "Datos del reporte compartidos por la pagina del alumno y el PDF (snapshots, score ponderado, FPT)",
  },
  {
    file: "app/api/reports/students/[studentId]/pdf/route.ts",
    requires: ["requireTeacherOrAdmin", "buildStudentReportPdf", "TIME_FILTER_END_DATE", "Not found", "fptAttemptId"],
    label: "PDF generado en backend por area (Math/Reading/Writing/FPT) con scope y filtros de tiempo",
  },
  {
    file: "lib/weighted-score.ts",
    requires: ["summarizeAllQuestionAnswers", "sumAttemptElapsedTime", "blank answers count in the denominator"],
    label: "Accounting de score usa todas las preguntas y tiempo total de intentos",
  },
  {
    file: "lib/pdf/student-report-document.tsx",
    requires: ["renderToBuffer", "Helvetica-Bold", "Average score", "Performance by skill and difficulty", "Skill performance by difficulty", "Teacher comments", "totalPages", "Scores by exam"],
    label: "PDF presentable (backend, sin navegador): score ponderado, secciones por area, paginacion y resumen",
  },
  {
    file: "scripts/verify-authz.mjs",
    requires: ["teacherProgramEnrollmentScope", "studentAccessWhereFor", "parentId_studentId", "requireAdmin"],
    label: "Suite estatica de autorizacion cubre scope, padres y admin",
  },
  {
    file: "lib/full-test-scoring.ts",
    requires: ["export function sectionScore", "200 + 600 * ratio", "scaledScore", "rawMaxForPretestExclusion"],
    label: "Full Practice Test scoring: formula proporcional sobre las preguntas que cuentan (con/sin pretest)",
  },
  {
    file: "app/(teacher)/teacher/full-tests/scoring/page.tsx",
    requires: ["How exam scores are calculated", "FPT_PRETEST_EXCLUSION", "scoringExamples", "This is an estimate"],
    label: "UI de scoring explica la formula con ejemplos segun el ajuste de pretest",
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
    requires: ["By Module", "including blanks", "timeSpent", "StatsPanel", "Extra time used", "overtimeByModule"],
    // "By Skill" grouped the per-section placeholder topics (R&W M1 + Math M1 mixed): removed on purpose.
    forbids: ["By Skill"],
    label: "Resultados FPT muestran review por modulo, tiempo extra y preguntas absolutas (sin By Skill)",
  },
];

let hasFailures = false;

for (const check of checks) {
  const absolutePath = path.join(root, check.file);
  const content = await readFile(absolutePath, "utf8");
  const missing = check.requires.filter((needle) => !content.includes(needle));
  const forbidden = (check.forbids ?? []).filter((needle) => content.includes(needle));
  if (missing.length === 0 && forbidden.length === 0) {
    console.log(`PASS - ${check.label}`);
  } else {
    hasFailures = true;
    console.error(`FAIL - ${check.label}`);
    for (const needle of missing) {
      console.error(`  missing: ${needle}`);
    }
    for (const needle of forbidden) {
      console.error(`  forbidden: ${needle}`);
    }
  }
}

if (hasFailures) {
  process.exit(1);
}

console.log("P0 static verification passed.");
