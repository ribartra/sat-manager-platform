"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { practiceSetStatusLabel, practiceSetStatusOptions } from "@/lib/domain-meta";

/** Status of a Practice Set, changed in place from Practice › By skill (PATCH { status }). */
export function PracticeSetStatusSelect({ practiceSetId, status }: { practiceSetId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      await apiFetch(`/api/practice-sets/${practiceSetId}`, { method: "PATCH", json: { status: next }, fallback: "Could not change the status." });
      notify.success(`Status: ${practiceSetStatusLabel(next)}.`);
      router.refresh();
    } catch (error) {
      setValue(previous);
      notify.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Select value={value} disabled={saving} onChange={(e) => change(e.target.value)} aria-label="Status" className="h-8 w-auto text-xs">
      {practiceSetStatusOptions().map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
