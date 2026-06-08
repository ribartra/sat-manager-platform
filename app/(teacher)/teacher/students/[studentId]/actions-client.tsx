"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserCheck, UserX } from "lucide-react";

export function StudentDetailActions({ studentId, isActive }: { studentId: string; isActive: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleActive() {
    setLoading(true);
    await fetch(`/api/students/${studentId}/toggle-active`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button
      variant={isActive ? "secondary" : "secondary"}
      size="sm"
      onClick={toggleActive}
      disabled={loading}
      className="flex items-center gap-1.5"
    >
      {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
