"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { SESSION_IDLE_MS, signOutCallbackUrl } from "@/lib/session-policy";

const MOVE_THROTTLE_MS = 1000;
const HEALTH_MS = 45_000;
/** Last activity in any tab of the app (localStorage is shared by every tab of the origin). */
const LAST_ACTIVITY_KEY = "sat:lastActivity";

function endSession(reason: "idle" | "session") {
  void signOut({ callbackUrl: signOutCallbackUrl(reason) });
}

function readSharedActivity(): number {
  try {
    return Number(window.localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeSharedActivity(at: number) {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    // Storage blocked (private window): this tab's own timer still works.
  }
}

/**
 * Idle sign-out after 30 minutes without activity in ANY tab (lib/session-policy.ts), plus a periodic
 * session health check. Activity in another tab postpones this tab's sign-out.
 */
export function useSessionGuards() {
  const { status } = useSession();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMove = useRef(0);
  const lastLocal = useRef(0);

  useEffect(() => {
    if (status !== "authenticated") return;

    const schedule = (delay: number) => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(check, Math.max(1000, delay));
    };
    // When this tab's timer fires, the latest activity of all tabs decides.
    function check() {
      const last = Math.max(lastLocal.current, readSharedActivity());
      const left = last + SESSION_IDLE_MS - Date.now();
      if (left <= 0) endSession("idle");
      else schedule(left);
    }
    const resetIdle = () => {
      const now = Date.now();
      lastLocal.current = now;
      writeSharedActivity(now);
      schedule(SESSION_IDLE_MS);
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
