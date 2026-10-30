"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormSection, PageHeader, PageShell } from "@/components/sat";
import { changePasswordSchema, type ChangePasswordInput } from "@/contracts/auth";
import { InlineError } from "@/components/sat/alert";
import { apiFetch, errorMessage } from "@/lib/api-client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    setServerError("");
    let data: { email?: string; reauthenticate?: boolean };
    try {
      data = await apiFetch("/api/auth/change-password", {
        method: "POST",
        json: { currentPassword: values.currentPassword, newPassword: values.newPassword },
        fallback: "We couldn't change your password. Please try again.",
      });
    } catch (error) {
      setServerError(errorMessage(error));
      return;
    }
    // Changing the password signs out every session, this one included: sign back in here.
    if (data.reauthenticate && data.email) {
      const result = await signIn("credentials", { email: data.email, password: values.newPassword, redirect: false });
      if (result?.error) {
        router.push("/login");
        return;
      }
    }
    setSuccess(true);
    setTimeout(() => router.back(), 900);
  }

  const loading = form.formState.isSubmitting;

  return (
    <PageShell>
      <PageHeader title="Change password" />
      <Card padding="lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormSection>
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
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
                    <FormLabel>Type the new password again</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>
            <InlineError>{serverError}</InlineError>
            {success ? <p className="text-sm text-success">Your password was changed.</p> : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Saving…" : "Save password"}
            </Button>
          </form>
        </Form>
      </Card>
    </PageShell>
  );
}
