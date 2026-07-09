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
    file: "app/api/attempts/[attemptId]/comment/route.ts",
    requires: ["requireTeacherOrAdmin", "teacherProgramEnrollmentScope", "student: { programEnrollments: programScope }"],
    label: "Attempt comments scoped by teacher program",
  },
  {
    file: "app/api/reports/students/[studentId]/pdf/route.ts",
    requires: ["requireTeacherOrAdmin", "teacherProgramEnrollmentScope", "role: \"STUDENT\""],
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
