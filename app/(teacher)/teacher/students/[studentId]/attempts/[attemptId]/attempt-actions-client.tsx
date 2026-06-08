"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AttemptActions({ attemptId, initialComment }: { attemptId: string; initialComment?: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"reopen" | "invalidate" | null>(null);
  const [comment, setComment] = useState(initialComment ?? "");
  const [savingComment, setSavingComment] = useState(false);

  async function run(action: "reopen" | "invalidate") {
    setLoading(action);
    await fetch(`/api/attempts/${attemptId}/${action}`, { method: "POST" });
    setLoading(null);
    router.refresh();
  }

  async function saveComment() {
    setSavingComment(true);
    await fetch(`/api/attempts/${attemptId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    setSavingComment(false);
    router.refresh();
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => run("reopen")} disabled={loading !== null}>
          {loading === "reopen" ? "Reopening..." : "Reopen attempt"}
        </Button>
        <Button variant="danger" size="sm" onClick={() => run("invalidate")} disabled={loading !== null}>
          {loading === "invalidate" ? "Invalidating..." : "Invalidate"}
        </Button>
      </div>
      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Add teacher comment for the student"
        rows={3}
      />
      <Button variant="secondary" size="sm" onClick={saveComment} disabled={savingComment}>
        {savingComment ? "Saving comment..." : "Save comment"}
      </Button>
    </div>
  );
}
