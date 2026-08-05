import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { ParentsClient } from "./parents-client";

export default async function ParentsPage() {
  const session = await auth();
  const studentWhere = session ? studentAccessWhereFor(session.user) : { role: "STUDENT", active: true, validationStatus: "APPROVED" };
  const [parents, students] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PARENT" },
      include: { parentLinks: { include: { student: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ where: studentWhere, orderBy: { name: "asc" } }),
  ]);
  const visibleStudentIds = new Set(students.map((student) => student.id));
  const visibleParents = session?.user.role === "ADMIN"
    ? parents
    : parents.filter((parent) =>
        parent.parentLinks.length === 0 ||
        parent.parentLinks.some((link) => visibleStudentIds.has(link.studentId))
      );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Parents</h1>
      <ParentsClient
        parents={visibleParents.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          phone: p.phone ?? "",
          students: p.parentLinks
            .filter((link) => session?.user.role === "ADMIN" || visibleStudentIds.has(link.studentId))
            .map((l) => ({ id: l.studentId, name: l.student.name })),
        }))}
        students={students.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
