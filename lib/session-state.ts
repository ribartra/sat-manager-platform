import prisma from "@/lib/prisma";

/**
 * Account state that decides whether a JWT is still valid (RNF-10). Read on every auth() call,
 * so it is cached briefly per user; any change made through this process clears the entry.
 */
export interface SessionState {
  active: boolean;
  role: string;
  validationStatus: string;
  sessionVersion: number;
}

const TTL_MS = 15_000;
const cache = new Map<string, { at: number; state: SessionState | null }>();

export async function loadSessionState(userId: string): Promise<SessionState | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.state;
  const state = await prisma.user.findUnique({
    where: { id: userId },
    select: { active: true, role: true, validationStatus: true, sessionVersion: true },
  });
  cache.set(userId, { at: Date.now(), state });
  return state;
}

export function forgetSessionState(userId: string) {
  cache.delete(userId);
}

/** Signs the user out everywhere: every JWT issued before this call stops working. */
export async function revokeUserSessions(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
  forgetSessionState(userId);
}
