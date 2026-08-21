import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { markUserActive } from "@/lib/activity";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

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
  session: { strategy: "jwt" },
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim().toLowerCase();
        const limited = checkRateLimit(`login:${email}`, 10, 15 * 60 * 1000);
        if (!limited.allowed) {
          await writeAudit({
            action: "LOGIN_RATE_LIMITED",
            targetType: "User",
            targetId: email,
            outcome: "failure",
            metadata: { email },
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
            targetId: user?.id ?? email,
            outcome: "failure",
            metadata: {
              email,
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
            metadata: { email, reason: "bad_password" },
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
          metadata: { email, role: user.role },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          validationStatus: user.validationStatus,
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
      }
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
