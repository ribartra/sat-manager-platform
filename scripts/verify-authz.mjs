import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "app/api/issue-reports/route.ts",
    requires: ["assertApprovedSession", "userId: session.user.id", "checkRateLimit", "screenshotType"],
    label: "Problem reports need a signed-in user, are rate limited and only accept real JPEG/PNG screenshots",
  },
  {
    file: "app/api/admin/issue-reports/[id]/route.ts",
    requires: ["assertAdmin"],
    label: "Problem report status/resend is admin-only",
  },
  {
    file: "app/api/admin/issue-reports/[id]/screenshot/route.ts",
    requires: ["assertAdmin", "private"],
    label: "Problem report screenshots are admin-only and never publicly cached",
  },
  {
    file: "app/api/agent/issue-reports/[id]/route.ts",
    requires: ["verifyCallbackToken", "callbackTokenConfigured", "checkRateLimit", "ISSUE_REPORT_AGENT_UPDATE"],
    label: "Coding agent callback needs the callback token (hash-compared), is rate limited and audited",
  },
  {
    file: "lib/coder-agent-settings.ts",
    requires: ["timingSafeEqual", "encryptSecret", "sha256Fingerprint"],
    label: "Coding agent tokens: outbound token encrypted at rest, callback token stored as a hash and compared in constant time",
  },
  {
    file: "app/api/admin/settings/coder-agent/route.ts",
    requires: ["assertAdmin", "writeAudit"],
    label: "Coding agent settings are admin-only and audited",
  },
  {
    file: "app/admin/reports/page.tsx",
    requires: ["session.user.role !== \"ADMIN\""],
    label: "Admin → Reports list is admin-only",
  },
  {
    file: "app/admin/reports/[id]/page.tsx",
    requires: ["session.user.role !== \"ADMIN\""],
    label: "Admin → Reports detail is admin-only",
  },
  {
    file: "app/api/auth/parent-consent/route.ts",
    requires: ["resolveParentAccount", "kind === \"conflict\"", "parentConsentVersion"],
    label: "Parent consent only creates/links PARENT accounts (never converts other roles) and stores the consent version",
  },
  {
    file: "app/api/auth/activate/route.ts",
    requires: ["resolveParentAccount", "parentConflictRole"],
    label: "Student activation never converts an existing account into a parent",
  },
  {
    file: "app/api/groups/[groupId]/members/route.ts",
    requires: ["studentAccessWhereFor", "ADD_GROUP_MEMBER"],
    label: "Group membership scoped to visible students and audited",
  },
  {
    file: "app/api/groups/[groupId]/members/[userId]/route.ts",
    requires: ["REMOVE_GROUP_MEMBER"],
    label: "Group member removal audited",
  },
  {
    file: "app/api/groups/route.ts",
    requires: ["CREATE_GROUP"],
    label: "Group creation audited",
  },
  {
    file: "app/api/full-practice-tests/route.ts",
    requires: ["CREATE_FULL_PRACTICE_TEST"],
    label: "Exam creation audited",
  },
  {
    file: "app/api/unlock-requests/route.ts",
    requires: ["CREATE_UNLOCK_REQUEST"],
    label: "Unlock requests audited",
  },
  {
    file: "app/api/assignments/route.ts",
    requires: ["ASSIGN_GROUP_PRACTICE_SET"],
    label: "Group-level assignment rules audited",
  },
  {
    file: "lib/assignments.ts",
    requires: ["AUTO_UNLOCK_ASSIGNMENT"],
    label: "Scheduled unlocks audited",
  },
  {
    file: "lib/full-test-grading.ts",
    requires: ["fullTestModulesForAttempt"],
    label: "Exam grading uses the attempt snapshot (history immutable)",
  },
  {
    file: "app/(student)/student/tests/[assignmentId]/page.tsx",
    requires: ["buildFullTestSnapshot", "fullTestModulesForAttempt"],
    label: "Exam attempts are snapshotted at start and rendered from the snapshot",
  },
  {
    file: "lib/rbac.ts",
    requires: ["requireTeacherOrAdmin", "requireAdmin", "requireApprovedSession", "validationStatus", "active"],
    label: "RBAC helpers validate role, active state and approval",
  },
  {
    file: "lib/program-scope.ts",
    requires: ["teacherProgramEnrollmentScope", "studentAccessWhereFor", "status: \"APPROVED\"", "active: true", "startDate", "endDate"],
    label: "Program scope restricts teacher access to active approved programs",
  },
  {
    file: "app/api/students/[studentId]/route.ts",
    requires: ["requireTeacherOrAdmin", "studentAccessWhereFor", "findFirst", "Forbidden"],
    label: "Student update scoped to teacher/admin access",
  },
  {
    file: "app/api/students/[studentId]/toggle-active/route.ts",
    requires: ["requireTeacherOrAdmin", "studentAccessWhereFor", "findFirst", "Forbidden"],
    label: "Student activation scoped to teacher/admin access",
  },
  {
    file: "app/api/assignments/route.ts",
    requires: ["requireTeacherOrAdmin", "studentAccessWhereFor", "outside your program scope"],
    label: "Practice assignment blocks students outside scope",
  },
  {
    file: "app/api/full-practice-tests/[testId]/assign/route.ts",
    requires: ["requireTeacherOrAdmin", "studentAccessWhereFor", "outside your program scope"],
    label: "Full test assignment blocks students outside scope",
  },
  {
    file: "app/api/attempts/[attemptId]/check/route.ts",
    requires: ["requireApprovedSession", "studentId: session.user.id", "status: \"IN_PROGRESS\"", "feedbackMode !== \"IMMEDIATE\"", "checkedAt"],
    label: "Immediate-feedback check graded on the server for the student's own in-progress attempt",
  },
  {
    file: "app/(student)/student/practice/practice-player-page.tsx",
    requires: ["...(previewMode", "savedChecks"],
    label: "Answer key reaches the browser only in teacher preview (immediate feedback via server check)",
  },
  {
    file: "lib/auth.ts",
    requires: ["maxAge: SESSION_MAX_AGE_SECONDS", "loadSessionState", "state.sessionVersion", "!state.active", "return null"],
    label: "JWT sessions expire in 7 days and end on deactivation, role change or password change",
  },
  {
    file: "app/api/media/questions/[...path]/route.ts",
    requires: ["requireApprovedSession", "private"],
    label: "Question images require an approved session and are not publicly cached",
  },
  {
    file: "app/api/attempts/[attemptId]/submit/route.ts",
    requires: ["requireApprovedSession", "studentId: session.user.id", "status: \"IN_PROGRESS\""],
    label: "Student submit limited to own in-progress attempt",
  },
  {
    file: "app/api/attempts/[attemptId]/autosave/route.ts",
    requires: ["requireApprovedSession", "studentId: session.user.id", "status: \"IN_PROGRESS\""],
    label: "Student autosave limited to own in-progress attempt",
  },
  {
    file: "app/api/full-practice-tests/attempts/[attemptId]/submit/route.ts",
    requires: ["requireApprovedSession", "studentId: session.user.id", "status: \"IN_PROGRESS\""],
    label: "Full test submit limited to own attempt",
  },
  {
    file: "app/api/full-practice-tests/attempts/[attemptId]/autosave/route.ts",
    requires: ["requireApprovedSession", "studentId: session.user.id", "status: \"IN_PROGRESS\"", "saveFullTestProgress"],
    label: "Full test autosave limited to own in-progress attempt",
  },
  {
    file: "app/api/attempts/[attemptId]/invalidate/route.ts",
    requires: ["requireTeacherOrAdmin", "teacherProgramEnrollmentScope", "student: { programEnrollments: programScope }"],
    label: "Attempt invalidation scoped by teacher program",
  },
  {
    file: "app/api/attempts/[attemptId]/reopen/route.ts",
    requires: ["requireTeacherOrAdmin", "teacherProgramEnrollmentScope", "student: { programEnrollments: programScope }"],
    label: "Attempt reopen scoped by teacher program",
  },
  {
    file: "app/api/full-practice-tests/attempts/[attemptId]/invalidate/route.ts",
    requires: ["requireTeacherOrAdmin", "teacherProgramEnrollmentScope", "student: { programEnrollments: programScope }", 'kind: "fpt"'],
    label: "Full test attempt invalidation scoped by teacher program",
  },
  {
    file: "app/api/full-practice-tests/attempts/[attemptId]/reopen/route.ts",
    requires: ["requireTeacherOrAdmin", "teacherProgramEnrollmentScope", "student: { programEnrollments: programScope }", 'kind: "fpt"'],
    label: "Full test attempt reopen scoped by teacher program",
  },
  {
    file: "app/(teacher)/teacher/history/page.tsx",
    requires: ["studentAccessWhereFor", "students.some((s) => s.id === query.student)", "loadAttemptHistory(studentId ? [studentId] : students.map((s) => s.id)"],
    label: "Teacher attempt history only lists students in the teacher's programs",
  },
  {
    file: "app/(teacher)/teacher/students/[studentId]/tests/[attemptId]/page.tsx",
    requires: ["teacherProgramEnrollmentScope", "student: { programEnrollments: programScope }", "notFound()"],
    label: "Teacher full test attempt detail scoped by teacher program",
  },
  {
    file: "app/api/reports/students/[studentId]/email/route.ts",
    requires: ["requireTeacherOrAdmin", "studentAccessWhereFor", "parentStudent.findMany", "REPORT_PDF_EMAILED"],
    label: "Report PDF email: scoped student, only linked parents, audited",
  },
  {
    file: "app/api/internal/notifications/generate/route.ts",
    requires: ["timingSafeEqual", "internalIngestToken", "Unauthorized"],
    label: "Internal reminders route requires the internal service token",
  },
  {
    file: "deploy/Caddyfile",
    requires: ["@internal path /api/internal/*", "respond @internal 404"],
    label: "Internal API paths are not exposed publicly",
  },
  {
    file: "app/api/attempts/[attemptId]/comment/route.ts",
    requires: ["requireTeacherOrAdmin", "teacherProgramEnrollmentScope", "student: { programEnrollments: programScope }"],
    label: "Attempt comments scoped by teacher program",
  },
  {
    file: "lib/pdf/build-student-report.ts",
    requires: ["teacherProgramEnrollmentScope", "role: \"STUDENT\"", "status: \"SUBMITTED\""],
    label: "Student PDF report scoped by teacher program",
  },
  {
    file: "app/api/unlock-requests/[requestId]/route.ts",
    requires: ["requireTeacherOrAdmin", "teacherProgramEnrollmentScope", "assignment: { student: { programEnrollments"],
    label: "Unlock request resolution scoped by teacher program",
  },
  {
    file: "app/api/programs/[id]/enrollments/[studentId]/parent-approval/route.ts",
    requires: ["session.user.role !== \"PARENT\"", "parentId_studentId", "Forbidden"],
    label: "Parent approval limited to linked parent/student",
  },
  {
    file: "app/api/admin/teachers/[teacherId]/toggle-active/route.ts",
    requires: ["requireAdmin", "role: \"TEACHER\""],
    label: "Teacher activation is admin-only",
  },
  {
    file: "app/api/admin/users/[userId]/validation/route.ts",
    requires: ["requireAdmin", "validationStatus", "validationReviewedById"],
    label: "User validation is admin-only",
  },
  {
    file: "app/admin/taxonomy/page.tsx",
    requires: ["requireAdmin", "redirect(\"/teacher\")"],
    label: "Taxonomy page is admin-only (the admin layout also admits teachers)",
  },
  {
    file: "app/(teacher)/teacher/impersonate/[studentId]/page.tsx",
    requires: ["requireTeacherOrAdmin", "studentAccessWhereFor", "IMPERSONATE_STUDENT_VIEW", "teacherViewLinks"],
    label: "Student view is program-scoped, audited and read-only",
  },
  {
    file: "app/api/programs/[id]/teachers/[teacherId]/route.ts",
    requires: ["requireAdmin", "role: \"TEACHER\""],
    label: "Program teacher assignment is admin-only",
  },
  {
    file: "app/api/parents/route.ts",
    requires: ["requireTeacherOrAdmin", "studentAccessWhereFor", "LINK_PARENT_STUDENT", "UNLINK_PARENT_STUDENT", "UPDATE_PARENT"],
    label: "Parent management is teacher/admin scoped and audited",
  },
  {
    file: "app/api/groups/route.ts",
    requires: ["requireTeacherOrAdmin", "TEACHER_GROUP_MANAGEMENT", "Teacher group management is disabled"],
    label: "Group creation is gated by admin-configured teacher permission",
  },
  {
    file: "app/api/groups/[groupId]/members/route.ts",
    requires: ["requireTeacherOrAdmin", "TEACHER_GROUP_MANAGEMENT", "Teacher group management is disabled"],
    label: "Group membership add is gated by admin-configured teacher permission",
  },
  {
    file: "app/api/assignments/route.ts",
    requires: ["sourceGroupId", "TEACHER_GROUP_MANAGEMENT", "Teacher group assignment is disabled"],
    label: "Practice Set group assignment is gated by admin-configured teacher permission",
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
    for (const needle of missing) console.error(`  missing: ${needle}`);
  }
}

if (hasFailures) process.exit(1);
console.log("Authorization static verification passed.");
