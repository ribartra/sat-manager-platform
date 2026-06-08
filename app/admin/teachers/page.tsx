import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { TeacherToggle } from "./teacher-toggle-client";

export default async function AdminTeachersPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/teacher");

  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { name: "asc" },
    include: {
      programTeachingAssignments: {
        include: { program: { include: { enrollments: { where: { active: true }, select: { studentId: true } } } } },
        where: { active: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Teachers</h1>
      <p className="mb-6 text-sm text-gray-500">Enable or disable teacher access and review assigned programs.</p>
      <div className="rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Teacher</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Programs</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {teachers.map((teacher) => (
              <tr key={teacher.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{teacher.name}</p>
                  <p className="text-xs text-gray-500">{teacher.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {teacher.programTeachingAssignments.length > 0
                    ? teacher.programTeachingAssignments.map((assignment) => `${assignment.program.name} (${assignment.program.enrollments.length})`).join(", ")
                    : "No programs"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={teacher.active ? "success" : "danger"}>{teacher.active ? "Enabled" : "Disabled"}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <TeacherToggle teacherId={teacher.id} active={teacher.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
