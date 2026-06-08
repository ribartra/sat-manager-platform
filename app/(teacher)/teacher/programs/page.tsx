import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { TeacherProgramsClient } from "./programs-client";

export default async function TeacherProgramsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["TEACHER", "ADMIN"].includes(session.user.role)) redirect("/student");

  const programs = await prisma.program.findMany({
    where: session.user.role === "TEACHER" ? { teachers: { some: { teacherId: session.user.id, active: true } } } : {},
    include: { enrollments: { where: { active: true }, select: { studentId: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Programs</h1>
      <p className="mb-6 text-sm text-gray-500">Create programs you teach. Leave contract end blank for no limit.</p>
      {session.user.role === "TEACHER" && <TeacherProgramsClient />}
      <div className="rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Program</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Contract end</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Students</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {programs.map((program) => (
              <tr key={program.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{program.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {program.contractEndsAt ? program.contractEndsAt.toISOString().slice(0, 10) : "No limit"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={program.active ? "success" : "danger"}>{program.active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{program.enrollments.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
