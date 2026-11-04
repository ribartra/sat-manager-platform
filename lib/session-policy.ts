/**
 * Sign-out after inactivity (shared by the server session and the browser guard, no server imports).
 * - Browser (hooks/use-session-guards.ts): 30 minutes with no mouse, keyboard, touch or scroll in ANY
 *   tab of the app ends the session (the last activity is shared between tabs).
 * - Server (lib/auth.ts): the session cookie also expires 30 minutes after it was last renewed; an
 *   open tab renews it every few minutes (SessionProvider refetchInterval), so a closed browser or a
 *   sleeping laptop is signed out too.
 */
export const SESSION_IDLE_MINUTES = 30;
export const SESSION_IDLE_MS = SESSION_IDLE_MINUTES * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = SESSION_IDLE_MINUTES * 60;
/** How often an open tab renews the session cookie (well under the idle limit). */
export const SESSION_REFRESH_SECONDS = 5 * 60;

/** Where an automatic sign-out lands: the login. Also ends a teacher's Student view (its cookie). */
export function signOutCallbackUrl(reason: "idle" | "session") {
  return `/api/student-view/exit?next=${encodeURIComponent(`/login?reason=${reason}`)}`;
}

/*
 * Continue where you were, only for the same account: on an automatic sign-out the browser keeps
 * { userId, path } (localStorage, never in the URL); after signing in, the page is reopened only when
 * the account that signs in is that user. Another account (a shared computer) goes to its own Home and
 * the record is dropped. A record older than RESUME_MAX_AGE_MS is ignored.
 */
const SESSION_USER_KEY = "sat:sessionUser";
const RESUME_KEY = "sat:resume";
const RESUME_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const storage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** The signed-in user of this browser (written by the session guard while signed in). */
export function rememberSessionUser(userId: string) {
  try {
    storage()?.setItem(SESSION_USER_KEY, userId);
  } catch {
    // Storage blocked: no resume, nothing else changes.
  }
}

/** Called on an automatic sign-out: the page this user was on. */
export function rememberResumePage() {
  try {
    const store = storage();
    const userId = store?.getItem(SESSION_USER_KEY);
    if (!store || !userId || typeof window === "undefined") return;
    const path = `${window.location.pathname}${window.location.search}`;
    if (!path.startsWith("/") || path.startsWith("//") || /^\/(login|auth|api)(\/|\?|$)/.test(path)) return;
    store.setItem(RESUME_KEY, JSON.stringify({ userId, path, at: Date.now() }));
  } catch {
    // ignore
  }
}

/** After signing in: the page to reopen when it belongs to `userId` (the record is used once either way). */
export function takeResumePage(userId: string | undefined): string | null {
  try {
    const store = storage();
    const raw = store?.getItem(RESUME_KEY);
    store?.removeItem(RESUME_KEY);
    if (!raw || !userId) return null;
    const saved = JSON.parse(raw) as { userId?: string; path?: string; at?: number };
    if (saved.userId !== userId || typeof saved.path !== "string" || Date.now() - (saved.at ?? 0) > RESUME_MAX_AGE_MS) return null;
    return saved.path.startsWith("/") && !saved.path.startsWith("//") ? saved.path : null;
  } catch {
    return null;
  }
}
