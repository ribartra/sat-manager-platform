import { Badge } from "@/components/ui/badge";
import { roleLabel } from "@/lib/domain-meta";

/**
 * Account type tag (Student / Teacher / Parent / Admin), the same in every account list and page.
 * `master` marks the master teacher (User.canManageTeachers).
 */
export function RoleBadge({ role, master = false }: { role: string; master?: boolean }) {
  if (master && role === "TEACHER") return <Badge variant="info">Master teacher</Badge>;
  const variant = role === "ADMIN" ? "danger" : role === "TEACHER" ? "info" : role === "PARENT" ? "warning" : "default";
  return <Badge variant={variant}>{roleLabel(role)}</Badge>;
}
