"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useRouter } from "next/navigation";
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
import { setPasswordSchema, type SetPasswordInput } from "@/contracts/auth";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [serverError, setServerError] = useState("");

  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: SetPasswordInput) {
    setServerError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: values.password }),
    });
    const data = await res.json();
    if (data.error) {
      setServerError(data.error);
      return;
    }
    router.push("/login?reset=1");
  }

  const loading = form.formState.isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-sm">
        <Card padding="lg">
          <h1 className="mb-1 text-lg font-semibold text-foreground">Set new password</h1>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
              <FormSection>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>
              {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Save Password"}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-primary hover:underline">
              ← Back to login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
