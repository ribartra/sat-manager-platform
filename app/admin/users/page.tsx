import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { redirect } from "next/navigation";
import { ListFilters, PageContent, PageHeader, PageShell } from "@/components/sat";
import { roleLabel } from "@/lib/domain-meta";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { AdminUsersTable, type AdminUserRow } from "./users-table-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; role?: string; validation?: string; access?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await requireAdmin();
  if (!session) redirect("/teacher");
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const role = ["STUDENT", "TEACHER", "PARENT", "ADMIN"].includes(params.role ?? "") ? params.role : undefined;
  const validation = ["PENDING", "APPROVED", "REJECTED"].includes(params.validation ?? "") ? params.validation : undefined;
  const access = params.access === "enabled" || params.access === "disabled" ? params.access : undefined;

  const users = await prisma.user.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
      ...(role ? { role } : {}),
      ...(validation ? { validationStatus: validation } : {}),
      ...(access ? { active: access === "enabled" } : {}),
    },
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
        <ListFilters
          action="/admin/users"
          q={q}
          placeholder="Name or email"
          filters={[
            { name: "role", label: "Account type", value: role, allLabel: "All types", options: ["STUDENT", "TEACHER", "PARENT", "ADMIN"].map((r) => ({ value: r, label: roleLabel(r) })) },
            { name: "validation", label: "Validation", value: validation, allLabel: "Any validation", options: [{ value: "PENDING", label: "Pending" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }] },
            { name: "access", label: "Access", value: access, allLabel: "Any access", options: [{ value: "enabled", label: "Enabled" }, { value: "disabled", label: "Disabled" }] },
          ]}
        />
        <AdminUsersTable rows={rows} />
      </PageContent>
    </PageShell>
  );
}
