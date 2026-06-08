import prisma from "@/lib/prisma";
import { ParentsClient } from "./parents-client";

export default async function ParentsPage() {
  const [parents, students] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PARENT" },
      include: { parentLinks: { include: { student: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ where: { role: "STUDENT", active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Parents</h1>
      <ParentsClient
        parents={parents.map((p) => ({ id: p.id, name: p.name, email: p.email, students: p.parentLinks.map((l) => l.student.name) }))}
        students={students.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
