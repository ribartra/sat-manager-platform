import prisma from "@/lib/prisma";
import { GroupsClient } from "./groups-client";

export default async function GroupsPage() {
  const groups = await prisma.group.findMany({
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Groups & Cycles</h1>
      <GroupsClient
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          schedule: g.schedule,
          members: g.members.map((m) => m.user),
        }))}
        students={students}
      />
    </div>
  );
}
