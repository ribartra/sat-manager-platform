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
    file: "app/(student)/student/tests/results/[attemptId]/page.tsx",
    requires: ['attempt.status === "IN_PROGRESS"', "InvalidatedNotice", "TestResultSentence", "HeaderActions", "markedForReview"],
    forbids: ["TestAttemptsTable"],
    label: "Resultados FPT: intento abierto muestra solo modulos enviados; invalidados tachados; acciones arriba; intentos en el acordeon (no tabla)",
  },
  // Attempt level only, for every role: no averages, no best try, no chart across different Tests.
  {
    file: "app/(student)/student/student-home.tsx",
    requires: ["PracticeSetAttemptsAccordion", "TestAttemptsAccordion"],
    forbids: ["LineChart", "avgPct", "Average correct", "s.delta"],
    label: "Home del alumno (y Student view): acordeones por set y por Test, sin promedios ni graficas entre Tests",
  },
  {
    file: "app/(student)/student/tests/page.tsx",
    requires: ["TestAttemptsAccordion"],
    forbids: ["LineChart", "Best total score"],
    label: "Tests del alumno: ultimo intento por Test, sin mejor puntaje ni graficas entre Tests",
  },
  {
    file: "app/(student)/student/history/page.tsx",
    requires: ["PracticeSetAttemptsAccordion", "TestAttemptsAccordion", "loadPracticeReport"],
    forbids: ["Average score", "bestByAssignment", "TopicDifficultyTrend", "PerformanceBreakdown"],
    label: "Historial del alumno: acordeones y matriz de ultimo intento, sin promedios ni Best",
  },
  {
    file: "app/(student)/student/results/[attemptId]/page.tsx",
    requires: ["HeaderActions", "Try Again"],
    forbids: ["PracticeAttemptsTable"],
    label: "Resultado de practice del alumno: acciones arriba (Try Again), sin tabla de intentos",
  },
  {
    file: "lib/student-practice.ts",
    requires: ["weakestSet"],
    forbids: ["avgPct", "best:"],
    label: "Resumen de practice del alumno: sin promedio ni mejor intento",
  },
  {
    file: "app/(parent)/parent/page.tsx",
    requires: ["PracticeSetAttemptsAccordion"],
    forbids: ["Questions correct", "avgPct"],
    label: "Portal de apoderado: ultimo intento por set, sin promedio",
  },
  {
    file: "app/parent/access/page.tsx",
    requires: ["PracticeSetAttemptsAccordion", "Progress report", "You can open this report until"],
    forbids: ["Questions correct", "Total questions"],
    label: "Reporte temporal del apoderado: ultimo intento por set, sin promedio",
  },
  // One Test card (CookSAT reference) in every view, on the same grid as the area cards.
  {
    file: "components/sat/test-card.tsx",
    requires: ["SAT MOCK EXAM", "REVIEW TEST", "400–1600", "canRetake"],
    label: "Card de Test unica (referencia CookSAT): SAT MOCK EXAM, total, Mod 1/2 por seccion, REVIEW TEST",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/page.tsx",
    requires: ["<TestCard", "CardGrid", "canRetake: false"],
    forbids: ["TestMiniCard"],
    label: "Ficha del alumno: cards de Test con el mismo componente y ancho que las de area; sin reintento del teacher",
  },
  {
    file: "app/(student)/student/student-home.tsx",
    requires: ["<TestCard", "CardGrid"],
    label: "Home del alumno / Student view: cards de Test con el mismo componente",
  },
  {
    file: "app/(student)/student/tests/page.tsx",
    requires: ["<TestCard", "CardGrid"],
    forbids: ["BluebookCard"],
    label: "Tests del alumno: misma card de Test",
  },
  {
    file: "components/sat/test-cards.tsx",
    requires: ["VoidableValue", "view.total !== null", "Not available until all modules are done"],
    label: "Bloques de Test: total solo con los 4 modulos; intentos invalidados tachados",
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
    requires: ["canRevealSolutions", "explanationVisibility", "ReviewQuestionCard", "reveal={canRevealSolutions}", "questionSnapshot"],
    label: "Resultados respetan visibilidad de soluciones y snapshots/media",
  },
  {
    file: "components/sat/review-question-card.tsx",
    requires: ["QuestionMedia", "imageUrl", "reveal && question.explanation", "reveal && question.correctAnswer"],
    label: "Tarjeta de revision muestra media y oculta respuesta/explicacion cuando el profesor las esconde",
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
    requires: ["Last ${areaLabel} practice", "lastPracticeLabel", "setsCompleted"],
    forbids: ["Average correct", "avgScore"],
    label: "Tabla de estudiantes por area: ultima practica y sets completados; sin promedios (regla: solo nivel de intento)",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/page.tsx",
    requires: ["loadPracticeReport", "DifficultySummaryCard", "difficultySummary", "weakestSkill", "SkillDifficultyMatrix", "PracticeSetAttemptsAccordion", "TestAttemptsAccordion", "InvalidateAttemptButton", "HeaderActions", "Practice Sets", "Teacher Comments", "GenerateReportDialog"],
    forbids: ["RestartExamButton", "TopicDifficultyTrend", "Best R&amp;W", "LineChart"],
    label: "Pagina del alumno a nivel de intento (sin promedios entre tests ni entre sets): Easy/Medium/Hard = ultimo intento por nivel, matriz de ultimo intento, acordeones por set y por test, Invalidar (unica accion) en History, acciones arriba, sin Restart ni graficas entre tests",
  },
  {
    file: "lib/student-report.ts",
    requires: ["aggregateTopicDifficultyMetrics", "summarizeAllQuestionAnswers", "parseSnapshot", "loadMockReport", "timeSpent", "topic.name", "latestIndexBySet", "difficultySummary", "· try ${n}"],
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
    requires: ["renderToBuffer", "Helvetica-Bold", "Latest practice", "Last attempt per level", "Performance by skill and difficulty", "Skills to work on next", "Teacher comments", "totalPages", "Scores by Test", "report.exams.length === 1"],
    forbids: ["Questions correct", "Average time per question", "difficultyMetrics"],
    label: "PDF presentable (backend, sin navegador): nivel de intento (sin promedios), secciones por area, paginacion y resumen",
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
    file: "app/(teacher)/teacher/tests/scoring/page.tsx",
    requires: ["How test scores are calculated", "FPT_PRETEST_EXCLUSION", "scoringExamples", "This is an estimate"],
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
    file: "lib/full-test-grading.ts",
    requires: ["currentModule", "currentQuestion", "fullPracticeTestAnswer.upsert", "markUserActive", "saveFullTestTimerState", "timeSpentByQuestion"],
    label: "Full Practice Test autosave persiste posicion, timers y respuestas",
  },
  {
    file: "app/api/full-practice-tests/attempts/[attemptId]/autosave/route.ts",
    requires: ["saveFullTestProgress(attempt, body, session.user.id)"],
    label: "Autosave de Test delega en saveFullTestProgress (bloquea modulos enviados)",
  },
  {
    file: "lib/full-test-grading.ts",
    requires: ["completedModulesOf(attempt.moduleTimerState", "if (locked.has(index)) return;", "lockedQuestionIds"],
    label: "Modulos enviados quedan bloqueados: autosave no los cambia y la nota final usa lo guardado",
  },
  {
    file: "app/api/full-practice-tests/attempts/[attemptId]/modules/[moduleIndex]/submit/route.ts",
    requires: ["requireApprovedSession", "studentId: session.user.id", "status: \"IN_PROGRESS\"", "completeFullTestModule", "finalizeFullTestAttempt"],
    label: "Submit por modulo: propio intento abierto; califica al entrar el ultimo modulo",
  },
  {
    file: "app/(student)/student/tests/[assignmentId]/player-client.tsx",
    requires: ["savedAnswers", "savedModule", "savedProgressState", "recordQuestionTime", "timeSpentByQuestion", "Save & exit"],
    label: "Player FPT reanuda respuestas, posicion, timer y tiempos por pregunta",
  },
  {
    file: "lib/full-test-progress.ts",
    requires: ["getFullTestTimerState", "saveFullTestTimerState", "moduleTimerState", "$executeRaw"],
    label: "Full Practice Test persiste timer por modulo",
  },
  {
    file: "app/(student)/student/tests/results/[attemptId]/page.tsx",
    requires: ["Results by module", "Blank answers count as wrong.", "timeSpent", "ModuleResultRows", "Extra time used", "overtimeByModule"],
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
