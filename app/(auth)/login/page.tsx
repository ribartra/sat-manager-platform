"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

function isLocalCallbackUrl(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

async function resolvePostLoginUrl(callbackUrl: string) {
  if (callbackUrl && callbackUrl !== "/" && isLocalCallbackUrl(callbackUrl)) return callbackUrl;

  const sessionRes = await fetch("/api/auth/session");
  if (!sessionRes.ok) return "/";
  const session = await sessionRes.json();
  const role = session?.user?.role;
  if (role === "TEACHER" || role === "ADMIN") return "/teacher";
  if (role === "PARENT") return "/parent";
  return "/student";
}

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const callbackUrl = params.get("callbackUrl") || "/";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      router.replace(await resolvePostLoginUrl(callbackUrl));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">SAT</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">SAT Practice Platform</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>

        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? "Signing in..." : "Log In"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
