import { PageShell } from "@/components/sat";
import { auth } from "@/lib/auth";
import { getFeatureSetting } from "@/lib/app-settings";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { GroupsClient } from "./groups-client";
import { studentAccessWhereFor } from "@/lib/program-scope";

export default async function GroupsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") {
    const enabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");
    if (!enabled) redirect("/teacher");
  }

  const groups = await prisma.group.findMany({
    include: {
      members: {
        where: { user: { active: true, validationStatus: "APPROVED" } },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const students = await prisma.user.findMany({
    where: studentAccessWhereFor(session.user),
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <PageShell>
      <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900 mb-6">Groups & Cycles</h1>
      <GroupsClient
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          schedule: g.schedule,
          members: g.members.map((m) => m.user),
        }))}
        students={students}
      />
    </PageShell>
  );
}
