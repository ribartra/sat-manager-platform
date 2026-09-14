"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

const IDLE_MS = 10 * 60 * 1000;
const MOVE_THROTTLE_MS = 1000;
const HEALTH_MS = 45_000;

function endSession(reason: "idle" | "session") {
  void signOut({ callbackUrl: `/login?reason=${reason}` });
}

/** Idle 10m (reset on activity) + periodic session health check. */
export function useSessionGuards() {
  const { status } = useSession();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMove = useRef(0);

  useEffect(() => {
    if (status !== "authenticated") return;

    const resetIdle = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => endSession("idle"), IDLE_MS);
    };

    const onActivity = () => resetIdle();
    const onMove = () => {
      const now = Date.now();
      if (now - lastMove.current < MOVE_THROTTLE_MS) return;
      lastMove.current = now;
      resetIdle();
    };

    resetIdle();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("scroll", onActivity, { passive: true, capture: true });

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("scroll", onActivity, true);
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch("/api/session/health", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          endSession("session");
          return;
        }
        const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
        if (!data?.ok) endSession("session");
      } catch {
        // Network blip: do not force logout; next tick / visibility will retry.
      }
    }

    void checkHealth();
    const id = setInterval(() => void checkHealth(), HEALTH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkHealth();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status]);
}
