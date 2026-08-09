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
      "scorePercent: psQuestions.length > 0",
      "applyPracticeProgression",
      "practiceSetSnapshot",
    ],
    label: "Submit maneja blanks, evita re-submit y aplica progreso sobre total",
  },
  {
    file: "app/(student)/student/results/[attemptId]/page.tsx",
    requires: [
      "canRevealSolutions",
      "Correct answers and explanations are hidden",
      "Unanswered - no explanation shown",
      "Try Again",
      "parseSnapshot<QuestionSnapshot>",
      "parseSnapshot<PracticeSetSnapshot>",
    ],
    label: "Review respeta visibilidad, omitidas y snapshots historicos",
  },
  {
    file: "app/(student)/student/practice/player-client.tsx",
    requires: [
      "localStorage.setItem(offlineKey",
      "window.addEventListener(\"online\", syncOffline)",
      "Saved offline",
      "timeSpentByQuestion",
      "markedQuestionIds",
      "eliminatedOptions",
      "Submit this Practice Set with",
    ],
    label: "Player Practice Set cubre autosave offline, reconexion, tiempo y confirmacion con blanks",
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
      "Option ${label} is required to publish.",
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
    file: "app/(teacher)/teacher/students/[studentId]/attempts/[attemptId]/attempt-actions-client.tsx",
    requires: [
      "Optional reason for reopen/invalidate",
      "body: JSON.stringify({ reason: actionReason })",
      "setActionReason(\"\")",
    ],
    label: "Reopen/invalidate capturan razon operativa para auditoria",
  },
  {
    file: "app/(student)/student/full-tests/[assignmentId]/player-client.tsx",
    requires: [
      "savedTimerState",
      "moduleTimerState: timerState.current",
      "setExpiredEvents((count) => count + 1)",
      "setExtraTimeUsed((extra) => extra + 1)",
      "remaining === 0 ? `Extra",
      "Pause & Exit",
      "MathToolPanel",
      "context=\"full-test\"",
    ],
    label: "Full Practice Test persiste timers por modulo, time expired y overtime sin auto-submit",
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
    ],
    label: "Calculadora Math usa proveedores parametrizados y fallback local",
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
    label: "Configuracion publica de calculadora controla proveedor y alcance",
  },
  {
    file: "app/api/full-practice-tests/attempts/[attemptId]/submit/route.ts",
    requires: [
      "scaledScore(\"RW\"",
      "scaledScore(\"MATH\"",
      "totalScore: rwScore + mathScore",
      "timeExpiredEvents: timeExpiredEvents ?? 0",
      "extraTimeUsed: extraTimeUsed ?? 0",
      "status: \"IN_PROGRESS\"",
    ],
    label: "Submit FPT calcula puntaje SAT y guarda eventos de tiempo",
  },
  {
    file: "prisma/seed.ts",
    requires: [
      "STUDENT_UNLOCK_REQUESTS",
      "STUDENT_SELF_ENROLLMENT",
      "TEACHER_PROGRAM_MANAGEMENT",
      "TEACHER_GROUP_MANAGEMENT",
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
    file: "app/(teacher)/teacher/analytics/page.tsx",
    requires: [
      "Skills With Most Errors",
      "selectedStudentId",
      "subskill",
      "recommendation",
      "studentAccessWhereFor",
      "timeSpent",
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
    requires: ["IMPERSONATE_STUDENT_VIEW", "studentEmail"],
    label: "Impersonation queda auditado",
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
    file: "scripts/generate-notifications.ts",
    requires: ["Practice Set due soon", "Practice Set overdue", "Practice Set unlocked", "notifyOnce", "notifications.generated"],
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
