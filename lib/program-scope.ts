export function teacherProgramEnrollmentScope(teacherId: string, now = new Date()) {
  return {
    some: {
      status: "APPROVED",
      active: true,
      program: {
        teachers: { some: { teacherId, endDate: null, teacher: { active: true } } },
        active: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
    },
  };
}

export function studentAccessWhereFor(user: { id: string; role: string }, now = new Date()) {
  if (user.role === "ADMIN") {
    return { role: "STUDENT" };
  }

  return {
    role: "STUDENT",
    programEnrollments: teacherProgramEnrollmentScope(user.id, now),
  };
}
