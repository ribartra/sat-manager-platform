"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

/**
 * Enable / disable a teacher account. Admin (default endpoint) and the master teacher's Teachers menu
 * (`endpoint="/api/teachers/…"`) share it. Disabling asks first: it ends the teacher's sessions.
 */
export function TeacherToggle({
  teacherId,
  active,
  teacherName,
  endpoint = `/api/admin/teachers/${teacherId}/toggle-active`,
  labels = { disable: "Disable", enable: "Enable" },
}: {
  teacherId: string;
  active: boolean;
  teacherName?: string;
  endpoint?: string;
  labels?: { disable: string; enable: string };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (active) {
      const ok = await confirm({
        title: `${labels.disable} ${teacherName ?? "this teacher"}?`,
        description: "They won't be able to sign in until the account is enabled again. Their students and work are kept.",
        tone: "danger",
        confirmLabel: labels.disable,
      });
      if (!ok) return;
    }
    setLoading(true);
    try {
      await apiFetch(endpoint, { method: "POST", fallback: "The teacher's access could not be changed." });
      notify.success(active ? "Teacher deactivated." : "Teacher activated.");
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant={active ? "danger" : "secondary"} size="sm" onClick={() => void toggle()} disabled={loading}>
      {loading ? "Saving..." : active ? labels.disable : labels.enable}
    </Button>
  );
}
