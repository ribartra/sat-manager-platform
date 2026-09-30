"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Client-side persistence helpers shared by the Practice Set and Full Practice Test players.
 *
 * The local buffer (localStorage) only holds a payload that has not reached the server yet:
 * it is written when a save fails or the tab is being hidden/closed, and removed as soon as
 * a save succeeds. So a buffer found on mount is always newer than the server props and must
 * be applied to the player state before anything is saved again.
 */

export type BufferedPayload<T> = T & { savedAt: number };

export function readBuffer<T>(key: string): BufferedPayload<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BufferedPayload<T>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeBuffer<T extends object>(key: string, payload: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...payload, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked (private mode): nothing else we can do on the client.
  }
}

export function clearBuffer(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Runs saves one after another so an older payload can never land after a newer one. */
export function useSaveQueue() {
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  return useCallback(<R,>(task: () => Promise<R>): Promise<R> => {
    const next = tail.current.then(task, task);
    tail.current = next.catch(() => undefined);
    return next;
  }, []);
}

/** navigator.onLine, kept in sync with the online/offline events. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * Last-chance save when the tab is hidden or closed: writes the local buffer synchronously
 * and sends the payload with `keepalive`, which lets the request outlive the page.
 */
export function usePageHideFlush(flush: () => void, enabled: boolean) {
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => {
    if (!enabled) return;
    const onHide = () => flushRef.current();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushRef.current();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}

export function sendKeepalive(url: string, payload: unknown) {
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore: the local buffer already holds the payload
  }
}
