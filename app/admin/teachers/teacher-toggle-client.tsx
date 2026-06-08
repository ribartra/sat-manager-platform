"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function TeacherToggle({ teacherId, active }: { teacherId: string; active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    await fetch(`/api/admin/teachers/${teacherId}/toggle-active`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button variant={active ? "danger" : "secondary"} size="sm" onClick={toggle} disabled={loading}>
      {loading ? "Saving..." : active ? "Disable" : "Enable"}
    </Button>
  );
}
