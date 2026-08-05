import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TeacherToggle } from "./teacher-toggle-client";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminTeachersPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/teacher");
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const teachers = await prisma.user.findMany({
    where: {
      role: "TEACHER",
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { programTeachingAssignments: { some: { program: { name: { contains: q } } } } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      programTeachingAssignments: {
        include: { program: { include: { enrollments: { where: { active: true, status: "APPROVED" }, select: { studentId: true } } } } },
        where: { endDate: null },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Teachers</h1>
      <p className="mb-6 text-sm text-gray-500">Enable or disable teacher access and review assigned programs.</p>
      <form className="mb-4 flex max-w-xl gap-2">
        <Input name="q" defaultValue={q} placeholder="Search teacher or program..." />
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Search</button>
      </form>
      <Card className="overflow-hidden">
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
      </Card>
    </div>
  );
}
