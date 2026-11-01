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

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameList(a: unknown, b: unknown) {
  return Array.isArray(a) && Array.isArray(b) ? sameValue([...a].sort(), [...b].sort()) : sameValue(a, b);
}

/**
 * Autosave sends only what changed since the last payload the server confirmed (`confirmed`), so a
 * save writes one or two questions instead of the whole attempt.
 *  - `maps` (per-question records: answers, notes, …): only the changed ids; an id removed since
 *    the confirmed payload is sent with the given empty value so the server clears it.
 *  - `lists` (full sets such as the marked ids): sent whole, and only when they changed.
 *  - every other field (position, timers) is always sent.
 * With no confirmed payload the full payload is sent. A save that fails leaves `confirmed` as it was,
 * so the next delta carries its changes again; resending a change is harmless (same values).
 */
export function autosaveDelta<T extends object>(
  next: T,
  confirmed: T | null,
  maps: Partial<Record<keyof T, unknown>>,
  lists: Array<keyof T> = [],
): Partial<T> {
  if (!confirmed) return next;
  const delta: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    const before = (confirmed as Record<string, unknown>)[key];
    if (key in maps) {
      const current = (value ?? {}) as Record<string, unknown>;
      const previous = (before ?? {}) as Record<string, unknown>;
      const changed: Record<string, unknown> = {};
      for (const [id, item] of Object.entries(current)) if (!sameValue(item, previous[id])) changed[id] = item;
      for (const id of Object.keys(previous)) if (!(id in current)) changed[id] = maps[key as keyof T];
      if (Object.keys(changed).length) delta[key] = changed;
    } else if (lists.includes(key as keyof T)) {
      if (!sameList(value, before)) delta[key] = value;
    } else {
      delta[key] = value;
    }
  }
  return delta as Partial<T>;
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
