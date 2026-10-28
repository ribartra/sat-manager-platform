import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "app/(student)/student/practice/practice-player-page.tsx",
    requires: [
      "status: \"IN_PROGRESS\"",
      "attemptNumber: prevAttempts + 1",
      "practiceSetSnapshot",
      "questionSnapshot",
      "assignmentId: assignmentId ?? null",
    ],
    label: "Practice Try Again crea intento nuevo si no hay IN_PROGRESS y conserva snapshots",
  },
  {
    file: "app/api/attempts/[attemptId]/submit/route.ts",
    requires: [
      "status: \"IN_PROGRESS\"",
      "filter((item) => !answers[item.questionId])",
      "answer: null",
      "isCorrect: false",
      "scorePercent: scored.scorePercent",
      "scaledScore: scored.scaledScore",
      "applyPracticeProgression",
      "practiceSetSnapshot",
    ],
    label: "Submit maneja blanks, evita re-submit y aplica progreso sobre total",
  },
  {
    file: "app/(student)/student/results/[attemptId]/page.tsx",
    requires: [
      "canRevealSolutions",
      "Your teacher has hidden the answers for this set.",
      "You left this blank.",
      "Try Again",
      "parseSnapshot<QuestionSnapshot>",
      "parseSnapshot<PracticeSetSnapshot>",
    ],
    label: "Review respeta visibilidad, omitidas y snapshots historicos",
  },
  {
    file: "app/(student)/student/practice/player-client.tsx",
    requires: [
      "writeBuffer(offlineKey",
      "readBuffer<AutosavePayload>(offlineKey)",
      "window.addEventListener(\"online\", onOnline)",
      "usePageHideFlush",
      "SaveIndicator",
      "timeSpentByQuestion",
      "markedQuestionIds",
      "eliminatedOptions",
      "useConfirm",
      "Blank questions count as wrong.",
    ],
    label: "Player Practice Set cubre autosave offline, reconexion, tiempo y confirmacion con blanks",
  },
  {
    file: "components/sat/save-indicator.tsx",
    requires: ["Saved (offline)", "Saving…", "Not saved yet", "SaveStatus"],
    label: "SaveIndicator unifica copy de persistencia (Saved locally)",
  },
  {
    file: "lib/practice-progression.ts",
    requires: [
      "scorePercent < 75",
      "SAME_LEVEL_75",
      "NEXT_DIFFICULTY_AFTER_LEVEL_COMPLETE_75",
      "AUTO_UNLOCK_SKIPPED_MANUAL_LOCK",
      "AUTO_UNLOCK_SKIPPED_SCHEDULED_LOCK",
      "unlockAt && existing.unlockAt > new Date()",
    ],
    label: "Transicion 75 no salta dificultad, bloqueo manual ni desbloqueo programado",
  },
  {
    file: "lib/content-validation.ts",
    requires: [
      "const MC_LABELS = [\"A\", \"B\", \"C\", \"D\"]",
      "for (const label of MC_LABELS)",
      "Question stem text or image is required to publish.",
      "Option ${label} must have text or an image to publish.",
      "Correct answer for multiple choice must be A, B, C or D.",
      "At least one published question is required to publish.",
      "Practice Set cannot contain duplicate questions.",
    ],
    label: "Validacion de publicacion bloquea preguntas/sets incompletos y duplicados",
  },
  {
    file: "app/api/practice-sets/[practiceSetId]/route.ts",
    requires: [
      "All questions must be published before publishing a Practice Set.",
      "All questions in a Practice Set must belong to the selected topic.",
      "Validation failed.",
    ],
    label: "Publicacion de Practice Set valida preguntas publicadas y mismo topic",
  },
  {
    file: "components/sat/invalidate-attempt-button.tsx",
    requires: [
      '{ value: "HEALTH", label: "Health" }',
      '{ value: "CONNECTION", label: "Connection problem" }',
      '{ value: "OTHER", label: "Other (explain)" }',
      "/invalidate`, { method: \"POST\", json: { reason: text }",
      'if (status !== "SUBMITTED") return null;',
    ],
    label: "Invalidar intento: unica accion del teacher, razon obligatoria (salud, conexion, otra con detalle) auditada, solo intentos contados",
  },
  {
    file: "app/(teacher)/teacher/history/page.tsx",
    requires: ["InvalidateAttemptButton"],
    label: "History global: invalidar con el mismo componente (unica accion sobre un intento)",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/attempt-header-actions.tsx",
    requires: ["HeaderActions", "GenerateReportDialog", "InvalidateAttemptButton"],
    label: "Paginas de intento: Back · Report · Invalidar arriba a la derecha, mismo componente en practice y Test",
  },
  {
    file: "app/(student)/student/tests/[assignmentId]/player-client.tsx",
    requires: [
      "savedProgressState",
      "moduleTimerState",
      "setExpiredEvents((count) => count + 1)",
      "advanceAfterModule",
      "phase === \"BREAK\"",
      "remaining <= 60",
      "Save & exit",
      "MathToolPanel",
      "context=\"full-test\"",
      "writeBuffer(offlineKey",
      "readBuffer<FullTestAutosavePayload>(offlineKey)",
      "usePageHideFlush",
      "fetchWithTransientRetry",
      "SaveIndicator",
      "overtimeRef",
      "Extra time",
      "extraTimeUsed: extraTimeUsedRef.current",
      "Submit module",
    ],
    // Time running out never ends the module: the student keeps working and overtime is recorded.
    forbids: ["autoAdvanceTriggered"],
    label: "Full Practice Test: timers por modulo, tiempo extra registrado (sin auto-advance), envio anticipado, break, timer rojo <=1min y offline parity",
  },
  {
    file: "components/math-tool-panel.tsx",
    requires: [
      "desmos_api",
      "desmos_sat",
      "geogebra",
      "geogebra_api",
      "local_2d",
      "local_3d",
      "sandbox=\"allow-scripts allow-same-origin allow-forms allow-popups\"",
      "GraphingCalculator",
      "GGBApplet",
      "navigator.onLine",
      "IFRAME_LOAD_TIMEOUT_MS",
      "status === \"failed\"",
    ],
    forbids: ["if (failed) return <Local2DPanel"],
    label: "Calculadora Math: providers, hide on offline/CDN fail, sin hueco Local2D",
  },
  {
    file: "lib/calculator-config.ts",
    requires: [
      "NEXT_PUBLIC_CALCULATOR_PROVIDER",
      "NEXT_PUBLIC_DESMOS_API_KEY",
      "NEXT_PUBLIC_GEOGEBRA_APP_NAME",
      "enabledInPracticeSets",
      "enabledInFullTests",
    ],
    label: "Configuracion publica de calculadora controla proveedor y URLs",
  },
  {
    file: "lib/app-settings.ts",
    requires: [
      "CALCULATOR_PRACTICE_SETS",
      "CALCULATOR_FULL_TESTS",
      "defaultValue: false",
    ],
    label: "Admin flags calculadora Practice/FPT default OFF",
  },
  {
    file: "app/(student)/student/practice/practice-player-page.tsx",
    requires: ['getFeatureSetting("CALCULATOR_PRACTICE_SETS")', "showCalculator={calculatorEnabled}"],
    label: "Practice player respeta CALCULATOR_PRACTICE_SETS",
  },
  {
    file: "app/(student)/student/tests/[assignmentId]/page.tsx",
    requires: ['getFeatureSetting("CALCULATOR_FULL_TESTS")', "showCalculator={showCalculator}"],
    label: "FPT player respeta CALCULATOR_FULL_TESTS",
  },
  {
    file: "lib/full-test-grading.ts",
    requires: [
      "scaledScore(\"RW\"",
      "scaledScore(\"MATH\"",
      "totalScore: rwScore + mathScore",
      "timeExpiredEvents: timeExpiredEvents ?? 0",
      "extraTimeUsed: extraTimeUsed ?? 0",
      "FPT_PRETEST_EXCLUSION",
      "countsTowardScore",
      "!excludePretest || !item.isPretest",
    ],
    label: "Submit FPT respeta FPT_PRETEST_EXCLUSION al contar raw y guarda eventos de tiempo",
  },
  {
    file: "app/api/full-practice-tests/attempts/[attemptId]/submit/route.ts",
    requires: ["status: \"IN_PROGRESS\"", "finalizeFullTestAttempt"],
    label: "Submit FPT solo sobre intento abierto y usa la calificacion compartida",
  },
  {
    file: "prisma/seed.ts",
    requires: [
      "STUDENT_UNLOCK_REQUESTS",
      "STUDENT_SELF_ENROLLMENT",
      "TEACHER_PROGRAM_MANAGEMENT",
      "TEACHER_GROUP_MANAGEMENT",
      "QUESTION_GRAPH_VISUALIZATION",
      "MATERIALS_MODULE",
      "FPT_PRETEST_EXCLUSION",
      "CALCULATOR_PRACTICE_SETS",
      "CALCULATOR_FULL_TESTS",
      "value: \"false\"",
      "SEED_DEMO_ACADEMIC_CONTENT",
      "sin contenido demo",
      "fullPracticeTestScoreConversion.upsert",
    ],
    // Academic content must NOT be synthesized by the essential seed — demo
    // generation is parked in prisma/seed.demo.ts behind SEED_DEMO_ACADEMIC_CONTENT.
    forbids: [
      "prisma.question.create",
      "prisma.practiceSet.create",
      "prisma.fullPracticeTest.create",
    ],
    label: "Seed QA deja permisos apagados y no crea contenido academico sintetico por defecto",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/page.tsx",
    requires: [
      "skills by difficulty",
      "StudentSwitcher",
      "Weakest skill",
      "studentAccessWhereFor",
      "loadPracticeReport",
    ],
    label: "Analytics docente cubre alumno, skills fallados, dificultad, tiempo y scoping",
  },
  {
    file: "app/api/questions/[questionId]/route.ts",
    requires: ["PUBLISH_QUESTION", "ARCHIVE_QUESTION", "UPDATE_QUESTION", "previousStatus"],
    label: "Auditoria de preguntas cubre publish/archive/update",
  },
  {
    file: "app/api/practice-sets/[practiceSetId]/route.ts",
    requires: ["PUBLISH_PRACTICE_SET", "ARCHIVE_PRACTICE_SET", "UPDATE_PRACTICE_SET", "questionCount"],
    label: "Auditoria de Practice Sets cubre publish/archive/update",
  },
  {
    file: "app/api/admin/import/route.ts",
    requires: ["IMPORT_QUESTIONS", "totalRows", "errorCount"],
    label: "Importacion real queda auditada con conteos",
  },
  {
    file: "app/(teacher)/teacher/impersonate/[studentId]/page.tsx",
    requires: ["IMPERSONATE_STUDENT_VIEW", "studentEmail", "Student view is not available", "redirect(\"/login\")"],
    label: "Impersonation queda auditado y no usa 404 genérico",
  },
  {
    file: "app/(student)/student/practice/player-client.tsx",
    requires: ["text-[28px] font-extrabold", "fixed inset-0 z-40", "immediateFeedback", "Check"],
    label: "Practice player: número grande, overlay fixed y Check IMMEDIATE",
  },
  {
    file: "app/api/students/invite/route.ts",
    requires: ["parentEmail", "sendStudentInviteEmail", "return NextResponse.json({ ok: true, inviteUrl })"],
    label: "Invitacion de alumno captura padre sin generar invitacion separada",
  },
  {
    file: "app/api/auth/activate/route.ts",
    requires: ["invite.parentEmail", "role: \"PARENT\"", "parentId_studentId", "authorizedAt: new Date()"],
    label: "Activacion de alumno crea y vincula padre capturado",
  },
  {
    file: "app/api/auth/activate/route.ts",
    requires: ["inviteUnusableReason(invite)", "acceptTerms !== true", "termsVersion: TERMS_VERSION", "termsAcceptedAt"],
    label: "Activacion exige aceptar T&C (consentimiento, incluido menores) y guarda version/fecha; rechaza enlaces usados, anulados o vencidos",
  },
  {
    file: "app/api/students/invite/route.ts",
    requires: ["openInviteWhere(email, now)", "$transaction", "INVITE_ALREADY_OPEN", "resolveParentAccount", "parentConsentRequired: false"],
    label: "Una sola invitacion abierta por alumno hasta que vence; email del apoderado opcional y nunca de otra cuenta",
  },
  {
    file: "lib/consent.ts",
    requires: ["revokedAt: null", "expiresAt: { gt: now }", "TERMS_VERSION"],
    label: "Invitacion abierta = no usada, no anulada, no vencida; version de T&C",
  },
  {
    file: "app/api/students/[studentId]/parent/route.ts",
    requires: ["studentAccessWhereFor", "resolveParentAccount", "parentId_studentId", "authorizedAt: now", "PARENT_LINKED", "passwordResetToken.create"],
    label: "Add parent email: alcance del docente, sin aprobacion del padre, vincula al instante, nunca convierte otra cuenta, auditado",
  },
  {
    file: "app/api/auth/parent-consent/resend/route.ts",
    requires: ["checkRateLimit", "requiresParentAuthorization", "invite.usedAt"],
    label: "Reenvio del correo al apoderado limitado y solo para invitaciones pendientes",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/page.tsx",
    requires: ["completedExamCount", "See test results"],
    label: "Pestanas de practica avisan de Tests terminados sin mostrar sus puntajes (no parece inactivo)",
  },
  {
    file: "app/(teacher)/teacher/parents/parents-client.tsx",
    requires: ["Share report by email", "Download PDF", "mathematics", "reading", "writing", "Edit Parent", "Associated students"],
    label: "Vista de padres gestiona asociaciones desde modal, comparte reporte y PDF por tipo",
  },
  {
    file: "scripts/restore-db.mjs",
    requires: ["BACKUP_FILE", "pre-restore", "backup.restored"],
    label: "Restore local exige backup y genera copia previa",
  },
  {
    file: "app/(student)/student/tests/[assignmentId]/page.tsx",
    requires: ['assignment.status === "COMPLETED"', "redirect(", "isUniqueConstraintError", "createdHere"],
    label: "Player FPT: un examen COMPLETED no crea un intento nuevo al abrir su URL",
  },
  {
    file: "prisma/migrations/20261005_single_open_attempt/migration.sql",
    requires: ["FullPracticeTestAttempt_one_open_per_assignment", "Attempt_one_open_per_assignment", "Attempt_one_open_unassigned", "WHERE \"status\" = 'IN_PROGRESS'"],
    label: "BD: como mucho un intento IN_PROGRESS por asignacion (indices unicos parciales)",
  },
  {
    file: "app/(student)/student/practice/practice-player-page.tsx",
    requires: ["isUniqueConstraintError", "findOpenAttempt"],
    label: "Player practica: colision al crear intento reutiliza el intento abierto",
  },
  {
    file: "components/math-content.tsx",
    // Data tables in questions are pipe tables rendered as real HTML tables (cells wrap; math inside cells).
    requires: ["splitContentBlocks", "<table", "renderInline"],
    label: "MathContent: tablas markdown se renderizan como tabla HTML",
  },
  {
    file: "lib/math-text.ts",
    // Ingested stems use $$…$$ mid-sentence; only a formula alone on its line renders as a block.
    requires: ["isStandaloneDisplay", "\\displaystyle "],
    label: "MathContent: $$ en linea se renderiza inline (display solo si va sola en su linea)",
  },
  {
    file: "lib/deadline-notifications.ts",
    requires: ["due soon", "overdue", "notifyOnce", "releaseScheduledUnlocks", "DEDUPE_WINDOW_DAYS"],
    label: "Job de notificaciones genera recordatorios idempotentes",
  },
];

let hasFailures = false;

for (const check of checks) {
  const content = await readFile(path.join(root, check.file), "utf8");
  const missing = (check.requires ?? []).filter((needle) => !content.includes(needle));
  const forbidden = (check.forbids ?? []).filter((needle) => content.includes(needle));
  if (missing.length === 0 && forbidden.length === 0) {
    console.log(`PASS - ${check.label}`);
  } else {
    hasFailures = true;
    console.error(`FAIL - ${check.label}`);
    for (const needle of missing) console.error(`  missing: ${needle}`);
    for (const needle of forbidden) console.error(`  forbidden present: ${needle}`);
  }
}

if (hasFailures) process.exit(1);
console.log("Edge-case static verification passed.");
