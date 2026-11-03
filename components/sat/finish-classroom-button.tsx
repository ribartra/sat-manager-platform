"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

/**
 * "Finish class work for this student": submits the student's open Classroom tries as they are (no
 * score) and closes those sets. Shown only while the student has open Classroom work.
 */
export function FinishClassroomButton({ studentId, studentName, sets }: { studentId: string; studentName: string; sets: string[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  async function finish() {
    const ok = await confirm({
      title: "Finish class work?",
      description: (
        <>
          <p>{studentName}&apos;s open Classroom work is submitted as it is (not scored) and closed:</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {sets.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}
          </ul>
        </>
      ),
      confirmLabel: "Finish class work",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { finished } = await apiFetch<{ finished: number }>("/api/teacher/classroom-work", { method: "POST", json: { studentIds: [studentId] } });
      notify.success(`Class work finished (${finished} ${finished === 1 ? "set" : "sets"}).`);
      router.refresh();
    } catch (error) {
      notify.error(error, "Unable to finish the class work.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" className="w-full" onClick={finish} disabled={busy}>
      {busy ? "Finishing..." : "Finish class work for this student"}
    </Button>
  );
}
