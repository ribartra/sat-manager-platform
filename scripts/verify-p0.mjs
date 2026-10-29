import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const checks = [
  // Home is one view (SAT-036/037): no section tabs, inactivity + unlock requests, no low performance.
  {
    file: "app/(teacher)/teacher/page.tsx",
    requires: ["Inactive 5+ days", "Unlock requests"],
    forbids: ["Overdue tests", "Section under 550", "Low performance", "PracticeAreaTabs", "TeacherStudentsTable"],
    label: "Teacher Home: one view (no Math/Reading/Writing/Tests tabs), inactivity and unlock requests only",
  },
  // Results by skill (SAT-039/040/041): no Low performance, no summary card, no matrix, no Assign in results.
  {
    file: "app/(teacher)/teacher/students/[studentId]/page.tsx",
    requires: ["<SkillResults", "UnlockRequestActions"],
    forbids: ["Low performance", "lowCells", "DifficultySummaryCard", "SkillDifficultyMatrix", "Reassign"],
    label: "Student section tab: results by skill (weighted, per source), unlock requests, no Low performance / Reassign",
  },
  // No parent approval step (consent = Terms accepted at activation): the student page only says the
  // parent's email is missing and lets the teacher add it; enrollments never wait for a parent.
  {
    file: "app/(teacher)/teacher/students/[studentId]/parent-contact.tsx",
    requires: ["Parent email: missing", "Add parent email", "/api/students/${studentId}/parent"],
    forbids: ["Waiting for parent", "not authorized yet", "Ask parent to authorize", "Resend"],
    label: "Student page parent line: linked parents or 'Parent email: missing' + Add parent email",
  },
  {
    file: "app/(teacher)/teacher/programs/programs-client.tsx",
    requires: [],
    forbids: ["Awaiting parent", "Parent consent required first"],
    label: "Enrollments do not wait for parent approval",
  },
  {
    file: "app/api/programs/[id]/enroll/route.ts",
    requires: ["parentApprovalStatus: null"],
    forbids: ['parentApprovalStatus = "PENDING"', "requiresParentApproval"],
    label: "Enroll request never sets a pending parent approval",
  },
  {
    file: "app/(student)/student/page.tsx",
    requires: [],
    forbids: ["ParentApprovalCard", "waiting for your OK"],
    label: "Parent dashboard has no approval step",
  },
  // Reports 12–14: every attempt page (Test and practice, teacher and student) has the same try
  // navigator and the "<Item> › Try M of N" breadcrumb; the module results add up to a Total.
  ...[
    "app/(teacher)/teacher/students/[studentId]/tests/[attemptId]/page.tsx",
    "app/(teacher)/teacher/students/[studentId]/attempts/[attemptId]/page.tsx",
    "app/(student)/student/tests/results/[attemptId]/page.tsx",
    "app/(student)/student/results/[attemptId]/page.tsx",
  ].map((file) => ({
    file,
    requires: ["<TryNavigator", " of ${"],
    forbids: ["<Badge>Try "],
    label: `Try navigator + "Try M of N" breadcrumb on ${file}`,
  })),
  ...[
    "app/(teacher)/teacher/students/[studentId]/attempts/[attemptId]/page.tsx",
    "app/(student)/student/results/[attemptId]/page.tsx",
  ].map((file) => ({ file, requires: ["practiceSetTitle("], label: `Practice breadcrumb "<Set (Level)>" on ${file}` })),
  {
    file: "components/sat/test-ui.tsx",
    requires: ["<ModuleTotalRow modules={modules} />"],
    label: "Results by module ends with the Total row",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/tests/[attemptId]/page.tsx",
    requires: ["<tfoot>"],
    label: "Teacher Test module table has a Total row",
  },
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
  // Every list (teacher + admin) has a text search and filters.
  {
    file: "app/(teacher)/teacher/page.tsx",
    requires: ["<ListFilters"],
    forbids: ['Card as="form"', 'placeholder="Search a student…"'],
    label: "Busqueda con filtros: Home del teacher con el mismo componente",
  },
  {
    file: "app/(teacher)/teacher/students/page.tsx",
    requires: ["<ListFilters"],
    forbids: ['Card as="form"'],
    label: "Busqueda con filtros: Students con el mismo componente",
  },
  {
    file: "app/(teacher)/teacher/tests/page.tsx",
    requires: ["ListFilters", "matchesQuery(query.q"],
    label: "Busqueda con filtros: Tests (teacher)",
  },
  {
    file: "app/(teacher)/teacher/programs/page.tsx",
    requires: ["ListFilters"],
    label: "Busqueda con filtros: Programas (teacher)",
  },
  {
    file: "app/(teacher)/teacher/questions/questions-filter-client.tsx",
    requires: ['params.set("q"'],
    label: "Busqueda con filtros: Banco de preguntas: texto + area, skill, nivel, estado",
  },
  {
    file: "app/(teacher)/teacher/practice-sets/page.tsx",
    requires: ["<ListFilters", "matchesQuery(search", "<PracticeSetsMenu"],
    forbids: ["PracticeSetsTable", 'view: "manage"', "<SetList", "New Practice Set"],
    label: "Practice: solo By skill (SAT-042) con un buscador unico; cada chip abre un desplegable con sus sets (Preview, Edit, Status, Delete); solo el boton Import with AI",
  },
  {
    file: "app/(teacher)/teacher/materials/materials-client.tsx",
    requires: ["matchesQuery(searchFilter"],
    label: "Busqueda con filtros: Materiales: texto + skill, estado",
  },
  {
    file: "app/(teacher)/teacher/parents/parents-client.tsx",
    requires: ["parentLinkFilter"],
    label: "Busqueda con filtros: Apoderados: busqueda + con/sin alumnos",
  },
  {
    file: "app/(teacher)/teacher/groups/groups-client.tsx",
    requires: ["groupSizeFilter"],
    label: "Busqueda con filtros: Grupos: busqueda + con/sin alumnos",
  },
  {
    file: "app/(teacher)/teacher/history/page.tsx",
    requires: ["<ListFilters", "student", "status"],
    forbids: ['Card as="form"'],
    label: "Busqueda con filtros: Historial: texto + alumno, tipo, area, estado, fecha",
  },
  {
    file: "app/admin/users/page.tsx",
    requires: ["ListFilters", "validation"],
    label: "Busqueda con filtros: Cuentas (admin): texto + tipo, validacion, acceso",
  },
  {
    file: "app/admin/teachers/page.tsx",
    requires: ["ListFilters"],
    label: "Busqueda con filtros: Profesores (admin): texto + acceso, programas",
  },
  {
    file: "app/admin/reports/page.tsx",
    requires: ["ListFilters"],
    label: "Busqueda con filtros: Reportes (admin): texto + tipo, cuenta",
  },
  {
    file: "app/admin/logs/page.tsx",
    requires: ["ListFilters"],
    label: "Busqueda con filtros: Log (admin): texto + resultado, cuenta",
  },
  // Attempts reference the question's images (live bank question by id); they never store them.
  {
    file: "lib/full-test-snapshot.ts",
    requires: ["loadLiveQuestionMedia", "withLiveMedia", "imageUrl: null"],
    label: "Tests: el intento referencia la imagen de la pregunta (se lee del banco), no la guarda",
  },
  {
    file: "lib/attempt-snapshots.ts",
    requires: ["imageUrl: null"],
    forbids: ["imageUrl: item.question.imageUrl", "imageUrl: option.imageUrl"],
    label: "Practice: el snapshot de la pregunta no guarda imagenes",
  },
  {
    file: "app/(student)/student/results/[attemptId]/page.tsx",
    requires: ["liveImagesOf"],
    label: "Resultado de practice: imagenes desde la pregunta viva",
  },
  {
    file: "lib/ingest-promotion.ts",
    requires: ["DATA_URI_PATTERN", "putQuestionImage"],
    label: "Imagenes oficiales: un data: URI se guarda como archivo y se referencia por URL (nunca base64 en la BD)",
  },
  {
    file: "app/api/admin/ai-import/attach-question-image/route.ts",
    requires: ["materializeOfficialImageUrl("],
    forbids: ["? image.base64Data\n"],
    label: "Adjuntar imagen desde la galeria: sin fallback a base64",
  },
  // One Test card (CookSAT reference) in every view, on the same grid as the area cards.
  {
    file: "components/sat/test-card.tsx",
    requires: ["TestModuleTiles", "--sat-area-tests", "Review results", "canRetake", 'layout === "compact"', "/ 1600"],
    forbids: ["#3b74ff", "sky-500", "slate-700"],
    label: "Card de Test unica con el estilo de /teacher/tests (barra gris + modulos con resultado + puntajes); compacta en los home",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/page.tsx",
    requires: ["<TestCard", "TestCardsByNumber", "canRetake: false", 'layout="compact"'],
    forbids: ["TestMiniCard"],
    label: "Ficha del alumno: cards de Test con el mismo componente y ancho que las de area; sin reintento del teacher",
  },
  {
    file: "app/(student)/student/tests/page.tsx",
    requires: ["<TestCard"],
    forbids: ["BluebookCard"],
    label: "Tests del alumno: misma card de Test",
  },
  {
    file: "app/(student)/student/student-home.tsx",
    requires: ["<TestCard", 'layout="compact"', "TestCardsByNumber"],
    label: "Home del alumno / Student view: card de Test compacta (mismo componente) al ancho de las de area",
  },
  {
    file: "components/question-list-item.tsx",
    requires: ["line-clamp-2", ".slice(0, 600)"],
    label: "report-11: la vista previa del estimulo usa todo el ancho (2 lineas), no 120 caracteres",
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
    requires: ["lastActiveAt", "loadStudentOverviews"],
    label: "Dashboard docente usa ultima actividad y la tabla de estudiantes por area",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/page.tsx",
    requires: ["loadPracticeReport", "SkillResults", "PracticeSetAttemptsAccordion", "TestAttemptsAccordion", "InvalidateAttemptButton", "HeaderActions", "Practice Sets", "Teacher Comments", "GenerateReportDialog"],
    forbids: ["RestartExamButton", "TopicDifficultyTrend", "Best R&amp;W", "LineChart"],
    label: "Pagina del alumno: resultados por skill (ultimo intento de cada set, ponderado por preguntas, detalle por fuente), acordeones por set y por test, Invalidar en History, acciones arriba, sin Restart ni graficas entre tests",
  },
  {
    file: "lib/student-report.ts",
    requires: ["aggregateTopicDifficultyMetrics", "summarizeAllQuestionAnswers", "parseSnapshot", "loadMockReport", "timeSpent", "topic.name", "latestIndexBySet", "skillResults", "acc.correct += scored.correct", "· try ${n}"],
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
    requires: ["renderToBuffer", "Helvetica-Bold", "Latest practice", "report.skillResults", "Performance by skill and difficulty", "Teacher comments", "totalPages", "Scores by Test", "report.exams.length === 1"],
    forbids: ["Questions correct", "Average time per question", "difficultyMetrics", "Last attempt per level"],
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
  {
    file: "prisma/migrations/20261029_content_source/migration.sql",
    requires: ['CREATE TABLE "Source"', "src_college_board", "src_innovator", 'UPDATE "PracticeSet" SET "sourceId"', 'UPDATE "FullPracticeTest" SET "sourceId"'],
    // ADD-only: a table rebuild would drop the section triggers and the single-open-attempt indexes.
    forbids: ["DROP TABLE", "new_PracticeSet", "new_FullPracticeTest"],
    label: "Source: migracion ADD-only con College Board (PS) e Innovator (Tests) como backfill",
  },
  {
    file: "app/api/practice-sets/route.ts",
    requires: ['sourceIdIssue(sourceId, "practice")', "sourceId,"],
    label: "Practice Set nuevo exige una fuente activa de Practice Sets",
  },
  {
    file: "app/api/practice-sets/[practiceSetId]/route.ts",
    requires: ['sourceIdIssue(sourceId, "practice", previous.sourceId)', "explanationVisibility, sourceId }"],
    label: "Practice Set editado valida la fuente (puede conservar una inactiva)",
  },
  {
    file: "app/api/full-practice-tests/route.ts",
    requires: ['sourceIdIssue(sourceId, "tests")', "sourceId,"],
    label: "Test nuevo exige una fuente activa de Tests",
  },
  {
    file: "app/api/full-practice-tests/[testId]/route.ts",
    requires: ['sourceIdIssue(sourceId, "tests", previous.sourceId)'],
    label: "Test editado valida la fuente",
  },
  {
    file: "app/api/practice-sets/[practiceSetId]/duplicate/route.ts",
    requires: ["sourceId: practiceSet.sourceId"],
    label: "Duplicar Practice Set conserva la fuente",
  },
  {
    file: "app/api/full-practice-tests/[testId]/duplicate/route.ts",
    requires: ["sourceId: test.sourceId"],
    label: "Duplicar Test conserva la fuente",
  },
  {
    file: "app/(teacher)/teacher/practice-sets/page.tsx",
    requires: ["SkillsSourceMap", "listSources({ kind: \"practice\" })", "source: source.id"],
    label: "Practice › By skill: chips por skill y, al abrirlo, una fila por fuente de Practice Sets (sin Innovator)",
  },
  {
    file: "components/sat/skills-map.tsx",
    requires: ["export function SkillsSourceMap", "<details", "<summary", "<SkillChip key={chip.difficulty} chip={chip}"],
    label: "SkillsSourceMap: tarjeta por Domain, cada skill se abre (details) con sus fuentes",
  },
  {
    file: "components/sat/skill-results.tsx",
    requires: ["SkillsSourceMap", "Weakest skill", "skills by difficulty", "across all sources"],
    forbids: ["Assign", "bySource", "rows: row."],
    label: "SkillResults (profesor, alumno, padre): weakest skill bajo el titulo, chips agregadas sobre todas las fuentes (sin acordeon por fuente), sin Assign",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/assign/page.tsx",
    requires: ["!assignmentBySet.has(ps.id)", '["PENDING", "IN_PROGRESS"]'],
    label: "Assign practice: lo ya asignado no se ofrece; Edit solo cambia fechas de lo abierto",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/assign/assign-form-client.tsx",
    requires: ["SkillsSourceMap", "localeCompare(b.name", "onClick: () => toggleSelect(ps.id)"],
    label: "Assign practice: mismo componente que By skill, skills A–Z, una chip por set",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/assign-test/page.tsx",
    requires: ["!assignmentByTest.has(exam.id)"],
    label: "Assign test: los tests ya asignados no se ofrecen",
  },
  {
    file: "app/(teacher)/teacher/tests/[testId]/assign/page.tsx",
    requires: ["fullTestAssignments: { none: { testId } }"],
    label: "Asignar un test: no se ofrecen alumnos que ya lo tienen",
  },
  {
    file: "app/(teacher)/teacher/tests/page.tsx",
    requires: ["<TestNumberAccordion", "groupTestVersions", "sortOrder"],
    label: "Tests: un acordeon TEST N con la version de cada fuente (paginacion por TEST N)",
  },
  {
    file: "prisma/migrations/20261031_cb_test_sources/migration.sql",
    requires: ["College Board 2025", "College Board 2026", "false, true"],
    label: "Fuentes de Tests por edicion: College Board 2025 / 2026 (solo Tests)",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/assign/assign-form-client.tsx",
    requires: ["lockOptionEnabled ? (", "locked: lockOptionEnabled && lockOnAssign"],
    label: "Assign practice: 'Keep it locked' oculto salvo que el admin lo active",
  },
  {
    file: "app/api/assignments/route.ts",
    requires: ['getFeatureSetting("ASSIGN_LOCKED_OPTION")'],
    label: "API de asignacion: sin bloqueo mientras la opcion esta apagada",
  },
  {
    file: "lib/app-settings.ts",
    requires: ["ASSIGN_LOCKED_OPTION"],
    label: "Ajuste de admin para la opcion 'Keep it locked' (apagado por defecto)",
  },
  {
    file: "prisma/migrations/20261102_assignment_explanations/migration.sql",
    requires: ['"Assignment" ADD COLUMN "showExplanations"', '"FullPracticeTestAssignment" ADD COLUMN "showExplanations"', '"FullPracticeTest" ADD COLUMN "number"', '"FullPracticeTestAnswer" ADD COLUMN "checkedAt"'],
    forbids: ["DROP TABLE"],
    label: "Explicaciones por asignacion + numero de Test (ADD-only con backfill)",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/assign/assign-form-client.tsx",
    requires: ["Show explanations in the player", "showExplanations,"],
    label: "Assign practice: opcion por alumno 'Show explanations in the player'",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/assign-test/assign-test-form-client.tsx",
    requires: ["Show explanations in the player", "showExplanations }", "<TestNumberAccordion"],
    label: "Assign test: opcion de explicaciones y acordeon TEST N por fuente",
  },
  {
    file: "lib/immediate-check.ts",
    requires: ["showExplanation ? ("],
    label: "Check del Practice Set: explicacion solo si la asignacion la habilita",
  },
  {
    file: "app/api/full-practice-tests/attempts/[attemptId]/check/route.ts",
    requires: ["Explanations are turned off for this test.", "checkedAt: new Date()", "This module was already submitted."],
    label: "Check del player de Test: solo con la opcion activa, modulo abierto, respuesta bloqueada",
  },
  {
    file: "lib/full-test-grading.ts",
    requires: ["!checkedIds.has(questionId)", "checkedAt: { not: null }"],
    label: "Una respuesta de Test comprobada no se puede cambiar",
  },
  {
    file: "components/sat/attempts-table.tsx",
    requires: ["<TestNumberAccordion", "TestAttemptRows"],
    label: "Intentos de Test agrupados en acordeon TEST N por fuente",
  },
  {
    file: "contracts/full-test.ts",
    requires: ["Test number is required."],
    label: "Editor de Test: numero de Test obligatorio",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/attempts/[attemptId]/page.tsx",
    requires: ["explanationsInPlayerLabel("],
    label: "Detalle de intento (PS, profesor): opcion de explicaciones con la que se dio",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/tests/[attemptId]/page.tsx",
    requires: ["explanationsInPlayerLabel("],
    label: "Detalle de intento (Test, profesor): opcion de explicaciones con la que se dio",
  },
  {
    file: "app/(student)/student/results/[attemptId]/page.tsx",
    requires: ["explanationsInPlayerLabel("],
    label: "Detalle de intento (PS, alumno): opcion de explicaciones con la que se dio",
  },
  {
    file: "app/(student)/student/tests/results/[attemptId]/page.tsx",
    requires: ["explanationsInPlayerLabel("],
    label: "Detalle de intento (Test, alumno): opcion de explicaciones con la que se dio",
  },
  {
    file: "app/(teacher)/teacher/tests/page.tsx",
    requires: ["<TestNumberAccordion"],
    forbids: ["New test", "emptySources"],
    label: "Lista de Tests: sin 'New test' ni atajos de importar por fuente",
  },
  {
    file: "components/sat/attempts-table.tsx",
    requires: ["PracticeSetRows", "set.skillName", "set.sourceName"],
    label: "Intentos de Practice Sets: skill -> fuente -> sets (y sus tries)",
  },
  {
    file: "components/sat/skills-map.tsx",
    requires: ["<Plus size={12} aria-hidden /> {difficultyLabel(chip.difficulty)}"],
    label: "By skill: nivel vacio como placeholder '+ Easy' que abre la importacion",
  },
  {
    file: "lib/import-media.server.ts",
    requires: ["propagateAssignedImageToOfficial(", "contentScopeFor(user)", "export async function contentMediaLinks"],
    label: "Imagenes y archivos fuente: acceso por lote, zip, imagenes copiadas a las preguntas publicadas",
  },
  {
    file: "app/(teacher)/teacher/import/[batchId]/page.tsx",
    requires: ["<ImportSteps", "Step 3 · Review & Draft"],
    label: "Import with AI: stepper navegable y breadcrumb por paso",
  },
  {
    file: "app/admin/import/ai/[batchId]/files/[fileId]/page.tsx",
    requires: ["<ImportSteps current={3}", "Step 3 · Review & crop"],
    label: "Revision y recorte de Import with AI: stepper y breadcrumb",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/attempts/[attemptId]/page.tsx",
    requires: ["Source", ".source.name }] : [])"],
    label: "Intento (PS profesor): fuente en cabecera y breadcrumb",
  },
  {
    file: "app/(student)/student/results/[attemptId]/page.tsx",
    requires: ["Source", ".source.name }] : [])"],
    label: "Intento (PS alumno): fuente en cabecera y breadcrumb",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/tests/[attemptId]/page.tsx",
    requires: ["Source", ".source.name }] : [])"],
    label: "Intento (Test profesor): fuente en cabecera y breadcrumb",
  },
  {
    file: "app/(student)/student/tests/results/[attemptId]/page.tsx",
    requires: ["Source", ".source.name }] : [])"],
    label: "Intento (Test alumno): fuente en cabecera y breadcrumb",
  },
  {
    file: "prisma/migrations/20261101_ingest_source_target/migration.sql",
    requires: ['ADD COLUMN "sourceId"', 'ADD COLUMN "importMode"', 'ADD COLUMN "targetJson"'],
    forbids: ["DROP TABLE"],
    label: "IngestBatch guarda fuente, modo y objetivo (ADD-only)",
  },
  {
    file: "app/api/admin/ai-import/batches/[batchId]/promote-practice-set/route.ts",
    requires: ['promotionSourceId(batchId, "practice")'],
    forbids: ["sourceId: DEFAULT_PRACTICE_SOURCE_ID"],
    label: "AI Import: el Practice Set promovido usa la fuente del lote",
  },
  {
    file: "app/api/admin/ai-import/batches/[batchId]/promote-full-test/route.ts",
    requires: ['promotionSourceId(batchId, "tests")'],
    forbids: ["sourceId: DEFAULT_TEST_SOURCE_ID"],
    label: "AI Import: el Test promovido usa la fuente del lote",
  },
  {
    file: "app/admin/import/ai/ai-import-client.tsx",
    requires: ['formData.set("sourceId", sourceId)', "JSON.stringify({ name, basePath, sourceId })"],
    label: "AI Import: campo Fuente en carga por ZIP y por carpeta",
  },
  {
    file: "lib/quick-import.ts",
    requires: ["QUICK_IMPORT_COLUMNS", "$...$", "\\$", "pipe tables", "import.csv", "Q<number>_STEM.png", "unbalancedDollars"],
    label: "Import with AI: prompt detallado (columnas CSV, LaTeX, tablas, archivo descargable) y prompt de imagenes",
  },
  {
    file: "app/api/import/quick/[batchId]/promote/route.ts",
    requires: ['status: "DRAFT"', "siblings + 1", "FULL_TEST_MODULES"],
    label: "Import with AI: siempre un Practice Set / Test NUEVO en borrador",
  },
  {
    file: "app/(teacher)/teacher/practice-sets/practice-set-editor-client.tsx",
    requires: ["ContentMediaCard", "<CropShortcut"],
    forbids: ["ImportQuestionnaireButton", "ImportWithAiCard"],
    label: "Editor de Practice Set: atajo a imagenes y archivos fuente + recorte por pregunta (sin boton de importar)",
  },
  {
    file: "app/(teacher)/teacher/tests/new/full-test-editor-client.tsx",
    requires: ["ContentMediaCard", "<CropShortcut"],
    forbids: ["ImportQuestionnaireButton", "ImportWithAiCard"],
    label: "Editor de Test: atajo a imagenes y archivos fuente + recorte por pregunta (sin boton de importar)",
  },
  {
    file: "ingest_service/app/main.py",
    requires: ["/batches/{batch_id}/quick-prepare", "/batches/{batch_id}/artifacts.zip", "/batches/{batch_id}/image-zip"],
    // Prisma-owned columns must not be ALTERed by the service (it can start first → migration fails).
    forbids: ["ALTER TABLE IngestBatch ADD COLUMN"],
    label: "Servicio de ingesta: paginas sin OCR, zip de artefactos e imagenes por zip",
  },
  {
    file: "prisma/migrations/20261030_source_scope/migration.sql",
    requires: ['ADD COLUMN "forPracticeSets"', 'ADD COLUMN "forTests"', "src_innovator"],
    forbids: ["DROP TABLE"],
    label: "Source scope: Innovator no es fuente de Practice Sets (migracion ADD-only)",
  },
  {
    file: "lib/content-source.ts",
    requires: ["forPracticeSets: true", "forTests: true", "is not used for Practice Sets"],
    label: "Fuentes filtradas por tipo de contenido y validadas al guardar",
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
