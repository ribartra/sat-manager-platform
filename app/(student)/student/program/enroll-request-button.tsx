"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function EnrollRequestButton({ programId }: { programId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function request() {
    setLoading(true);
    const res = await fetch(`/api/programs/${programId}/enroll`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
  }

  if (done) return <span className="text-sm text-amber-600 font-medium">Request sent</span>;

  return (
    <Button size="sm" onClick={request} disabled={loading}>
      {loading ? "Sending..." : "Request enrollment"}
    </Button>
  );
}
