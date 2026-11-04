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

/** Where an automatic sign-out lands: also ends a teacher's Student view (its cookie). */
export function signOutCallbackUrl(reason: "idle" | "session") {
  return `/api/student-view/exit?next=${encodeURIComponent(`/login?reason=${reason}`)}`;
}
