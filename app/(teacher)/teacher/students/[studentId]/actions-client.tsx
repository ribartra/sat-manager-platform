"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserX } from "lucide-react";

export function StudentDetailActions({ studentId, isActive }: { studentId: string; isActive: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleActive() {
    if (isActive && !window.confirm("Deactivate this student? They will not be able to sign in until reactivated. Their data and history are kept.")) return;
    setLoading(true);
    await fetch(`/api/students/${studentId}/toggle-active`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={toggleActive}
      disabled={loading}
      title={isActive ? "Block sign-in for this student (data and history are kept). You can reactivate later." : "Allow this student to sign in again."}
      className="gap-1.5 px-2.5 text-sm"
    >
      {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
      {loading ? "…" : isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
