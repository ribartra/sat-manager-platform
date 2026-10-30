"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { practiceSetStatusLabel } from "@/lib/domain-meta";

/**
 * Status change and delete of a Practice Set (Practice › By skill drop-down and the editor's action
 * bar): PATCH / DELETE /api/practice-sets/<id>, with the confirm dialog, toast and refresh. Delete is
 * refused by the API when the set has assignments or attempts (archive it instead).
 */
export function usePracticeSetMutations() {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function changeStatus(set: { id: string; name: string; status: string }, next: string) {
    if (next === set.status) return;
    setBusy(true);
    try {
      await apiFetch(`/api/practice-sets/${set.id}`, { method: "PATCH", json: { status: next }, fallback: "Could not change the status." });
      notify.success(`${set.name}: ${practiceSetStatusLabel(next)}.`);
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  /** Returns true when the set was deleted. */
  async function remove(set: { id: string }, afterHref?: string) {
    const ok = await confirm({ title: "Delete this Practice Set?", description: "It is not used by any assignment. This cannot be undone.", tone: "danger", confirmLabel: "Delete" });
    if (!ok) return false;
    setBusy(true);
    try {
      await apiFetch(`/api/practice-sets/${set.id}`, { method: "DELETE", fallback: "Could not delete the Practice Set." });
      if (afterHref) router.push(afterHref);
      else router.refresh();
      return true;
    } catch (error) {
      notify.error(error);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, changeStatus, remove };
}
