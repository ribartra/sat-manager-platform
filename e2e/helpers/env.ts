export const E2E = {
  teacherEmail: process.env.E2E_TEACHER_EMAIL || "teacher@sat.com",
  teacherPassword: process.env.E2E_TEACHER_PASSWORD || "teacher123",
  adminEmail: process.env.E2E_ADMIN_EMAIL || "admin@sat.com",
  adminPassword: process.env.E2E_ADMIN_PASSWORD || "admin123",
  /** Small published Practice Set (2 questions) — stable seed content. */
  tinyPracticeSetName:
    process.env.E2E_PRACTICE_SET_NAME ||
    "Problem Solving and Data Analysis - Statistical Claims - EASY",
  studentPassword: process.env.E2E_STUDENT_PASSWORD || "student123",
  parentPassword: process.env.E2E_PARENT_PASSWORD || "parent123",
};

export function uniqueTag() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Deterministic e2e mailbox prefix so cleanup can find leftovers. */
export function e2eMailbox(role: "student" | "parent", tag = uniqueTag()) {
  return {
    tag,
    email: `e2e.${role}.${tag}@example.com`,
    name: `E2E ${role} ${tag}`,
  };
}
