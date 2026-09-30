import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";
import { markUserActive } from "@/lib/activity";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { loadSessionState } from "@/lib/session-state";

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Audit key for a login email that has no account: stable but not the email itself (RNF-12). */
const emailRef = (email: string) => `email:${createHash("sha256").update(email).digest("hex").slice(0, 16)}`;

// Enforce AUTH_SECRET at runtime, but NOT during `next build`: the build
// evaluates this module while collecting page data, and secrets are (correctly)
// absent then — they're injected at container start via /data/app.env. NEXT_PHASE
// is "phase-production-build" only during the build.
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !process.env.AUTH_SECRET &&
  !process.env.NEXTAUTH_SECRET
) {
  throw new Error("AUTH_SECRET is required in production.");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim().toLowerCase();
        // Keyed by IP + email (and a looser per-IP cap), so someone elsewhere cannot lock
        // another person out of their account by failing on purpose.
        const ip = clientIpFromHeaders(request?.headers);
        const perAccount = checkRateLimit(`login:${ip}:${email}`, 10, 15 * 60 * 1000);
        const perIp = checkRateLimit(`login-ip:${ip}`, 30, 15 * 60 * 1000);
        if (!perAccount.allowed || !perIp.allowed) {
          await writeAudit({
            action: "LOGIN_RATE_LIMITED",
            targetType: "User",
            targetId: emailRef(email),
            outcome: "failure",
            metadata: { scope: perAccount.allowed ? "ip" : "account" },
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash || !user.active) {
          await writeAudit({
            userId: user?.id,
            action: "LOGIN_FAILED",
            targetType: "User",
            targetId: user?.id ?? emailRef(email),
            outcome: "failure",
            metadata: {
              reason: !user ? "not_found" : !user.passwordHash ? "no_password" : "inactive",
            },
          });
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) {
          await writeAudit({
            userId: user.id,
            action: "LOGIN_FAILED",
            targetType: "User",
            targetId: user.id,
            outcome: "failure",
            metadata: { reason: "bad_password" },
          });
          return null;
        }

        await markUserActive(user.id);
        await writeAudit({
          userId: user.id,
          action: "LOGIN_SUCCESS",
          targetType: "User",
          targetId: user.id,
          outcome: "success",
          metadata: { role: user.role },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          validationStatus: user.validationStatus,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.validationStatus = (user as { validationStatus?: string }).validationStatus;
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
        return token;
      }
      // Every later request: the session ends if the account was deactivated, its role changed,
      // or the password was changed/reset since this token was issued (sessionVersion bump).
      if (typeof token.id !== "string") return null;
      const state = await loadSessionState(token.id);
      if (!state || !state.active || state.role !== token.role || state.sessionVersion !== ((token.sv as number | undefined) ?? 0)) {
        return null;
      }
      token.validationStatus = state.validationStatus;
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.validationStatus = token.validationStatus as string;
      }
      return session;
    },
  },
});
