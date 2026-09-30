"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Replaces window.confirm / window.prompt with an in-app dialog.
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete this group?", tone: "danger", confirmLabel: "Delete" }))) return;
 * `requireText` asks the user to type an exact value (e.g. an email) before confirming; the
 * promise resolves to true only when confirmed.
 */
export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  requireText?: string;
  requireTextLabel?: string;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const next = { ...options, resolve };
      pendingRef.current = next;
      setTyped("");
      setPending(next);
    });
  }, []);

  const close = (ok: boolean) => {
    pendingRef.current?.resolve(ok);
    pendingRef.current = null;
    setPending(null);
  };

  const textOk = !pending?.requireText || typed.trim().toLowerCase() === pending.requireText.trim().toLowerCase();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && close(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pending?.title}</DialogTitle>
            {pending?.description ? <DialogDescription asChild><div>{pending.description}</div></DialogDescription> : null}
          </DialogHeader>
          {pending?.requireText ? (
            <label className="grid gap-1 text-sm">
              <span className="text-gray-600">{pending.requireTextLabel ?? `Type ${pending.requireText} to confirm`}</span>
              <Input value={typed} onChange={(event) => setTyped(event.target.value)} autoFocus autoComplete="off" />
            </label>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              {pending?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              type="button"
              variant={pending?.tone === "danger" ? "danger" : "primary"}
              disabledReason={textOk ? null : "Type the exact value shown to confirm."}
              onClick={() => close(true)}
            >
              {pending?.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider> (app/layout.tsx).");
  return confirm;
}
