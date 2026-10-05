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
import { InlineError } from "@/components/sat/alert";
import { apiFetch, errorMessage } from "@/lib/api-client";

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
    try {
      await apiFetch("/api/auth/reset-password", { method: "POST", json: { token, password: values.password } });
    } catch (error) {
      setServerError(errorMessage(error));
      return;
    }
    router.push("/login?reset=1");
  }

  const loading = form.formState.isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-sm">
        <Card padding="lg">
          <h1 className="mb-1 text-lg font-semibold text-foreground">Choose a new password</h1>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
              <FormSection>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
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
                      <FormLabel>Type it again</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>
              <InlineError>{serverError}</InlineError>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving…" : "Save password"}
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
