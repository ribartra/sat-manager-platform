import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const checks = [
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
    requires: ["requireApprovedSession", "studentId: session.user.id", "status: \"IN_PROGRESS\"", "saveFullTestTimerState"],
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
    file: "app/(teacher)/teacher/students/[studentId]/full-tests/[attemptId]/page.tsx",
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
