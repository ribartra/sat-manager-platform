import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterBar, PageContent, PageHeader, PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { AdminUsersTable, type AdminUserRow } from "./users-table-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await requireAdmin();
  if (!session) redirect("/teacher");
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [{ name: { contains: q } }, { email: { contains: q } }],
        }
      : undefined,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      validationStatus: true,
      validationReviewedAt: true,
      createdAt: true,
    },
  });

  const sortedUsers = users.sort((a, b) => {
    if (a.validationStatus === "PENDING" && b.validationStatus !== "PENDING") return -1;
    if (a.validationStatus !== "PENDING" && b.validationStatus === "PENDING") return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const rows: AdminUserRow[] = sortedUsers.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    validationStatus: user.validationStatus,
    reviewedLabel: user.validationReviewedAt ? user.validationReviewedAt.toLocaleString("en-US") : "-",
    isSelf: user.id === session.user.id,
  }));

  return (
    <PageShell width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "Accounts" }]} />
      <PageHeader
        title="Account Validation"
        description="Approve new accounts. People who joined from an email invite are approved automatically."
      />
      <PageContent>
        <FilterBar>
          <form className="flex w-full max-w-xl gap-2">
            <Input name="q" defaultValue={q} placeholder="Search user or email..." />
            <Button type="submit">Search</Button>
          </form>
        </FilterBar>
        <AdminUsersTable rows={rows} />
      </PageContent>
    </PageShell>
  );
}
