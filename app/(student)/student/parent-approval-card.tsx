"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  student: { id: string; name: string };
  enrollment: {
    programId: string;
    program: { id: string; name: string };
    enrolledAt: Date;
    parentApprovalStatus: string | null;
  };
}

export function ParentApprovalCard({ student, enrollment }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState<"approve" | "reject" | null>(null);

  async function act(action: "approve" | "reject") {
    setLoading(action);
    await fetch(
      `/api/programs/${enrollment.programId}/enrollments/${student.id}/parent-approval`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }
    );
    setLoading(null);
    setDone(action);
    router.refresh();
  }

  if (done) {
    return (
      <Card className="px-4 py-3">
        <p className="text-sm text-gray-600">
          {done === "approve" ? (
            <span className="text-green-700 font-medium">
              ✓ You approved {student.name}&apos;s enrollment in {enrollment.program.name}.
            </span>
          ) : (
            <span className="text-red-600">
              Enrollment request for {student.name} was not approved.
            </span>
          )}
        </p>
      </Card>
    );
  }

  return (
    <Card variant="warning" className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-amber-900">
          {student.name} → {enrollment.program.name}
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          Requested on {new Date(enrollment.enrolledAt).toISOString().slice(0, 10)}
        </p>
        <p className="text-xs text-amber-600 mt-1">
          Your approval is required for this minor&apos;s enrollment.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="text-green-700 hover:bg-green-50"
          onClick={() => act("approve")}
          disabled={!!loading}
        >
          {loading === "approve" ? "..." : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50"
          onClick={() => act("reject")}
          disabled={!!loading}
        >
          {loading === "reject" ? "..." : "Reject"}
        </Button>
      </div>
    </Card>
  );
}
