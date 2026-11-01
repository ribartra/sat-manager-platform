"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { fullTestStatusLabel } from "@/lib/domain-meta";

/**
 * Status change, duplicate and delete of a Test (Tests list cards and the Test page's actions):
 * PATCH / POST duplicate / DELETE /api/full-practice-tests/<id>, with confirm, toast and refresh.
 * Delete is only offered without assignments or attempts (archive it instead).
 */
export function useFullTestMutations() {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function changeStatus(test: { id: string; name: string; status: string }, next: string) {
    if (next === test.status) return;
    setBusy(true);
    try {
      await apiFetch(`/api/full-practice-tests/${test.id}`, { method: "PATCH", json: { status: next }, fallback: "Could not change the status." });
      notify.success(`${test.name}: ${fullTestStatusLabel(next)}.`);
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(test: { id: string }) {
    setBusy(true);
    try {
      const data = await apiFetch<{ test?: { id?: string } }>(`/api/full-practice-tests/${test.id}/duplicate`, { method: "POST", fallback: "Could not duplicate the test." });
      if (data?.test?.id) router.push(`/teacher/tests/${data.test.id}?edit`);
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  async function remove(test: { id: string }, afterHref?: string) {
    const ok = await confirm({ title: "Delete this test?", description: "No student has it. This cannot be undone.", tone: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch(`/api/full-practice-tests/${test.id}`, { method: "DELETE", fallback: "Could not delete the test." });
      if (afterHref) router.push(afterHref);
      else router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return { busy, changeStatus, duplicate, remove };
}
