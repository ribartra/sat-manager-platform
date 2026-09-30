"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormSection } from "@/components/sat";
import { loginSchema, type LoginInput } from "@/contracts/auth";
import { LegalLinks } from "@/components/legal/legal-page";
import { Alert, InlineError } from "@/components/sat/alert";

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
  const [serverError, setServerError] = useState("");

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const callbackUrl = params.get("callbackUrl") || "/";
  const reason = params.get("reason");
  const reasonMessage =
    reason === "idle"
      ? "Your session ended after 10 minutes of inactivity. Please sign in again."
      : reason === "session"
        ? "Your session is no longer valid. Please sign in again."
        : "";

  async function onSubmit(values: LoginInput) {
    setServerError("");
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (res?.error) {
      setServerError("Invalid email or password.");
      return;
    }
    router.replace(await resolvePostLoginUrl(callbackUrl));
  }

  const loading = form.formState.isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary">
            <span className="text-sm font-bold text-primary-foreground">SAT</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">SAT Practice Platform</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <Card padding="lg">
          {reasonMessage ? (
            <Alert tone="warning" className="mb-4">{reasonMessage}</Alert>
          ) : null}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormSection>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" autoFocus {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>
              <InlineError>{serverError}</InlineError>
              <Button type="submit" className="w-full" disabled={loading} size="lg">
                {loading ? "Signing in..." : "Log In"}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center">
            <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
              Forgot your password?
            </Link>
          </div>
        </Card>
        <LegalLinks className="mt-4" />
      </div>
    </div>
  );
}
