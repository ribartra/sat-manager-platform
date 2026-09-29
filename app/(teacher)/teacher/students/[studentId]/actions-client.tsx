"use client";

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
    <button
      type="button"
      onClick={toggleActive}
      disabled={loading}
      title={isActive ? "Block sign-in for this student (data and history are kept). You can reactivate later." : "Allow this student to sign in again."}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
      {loading ? "…" : isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
