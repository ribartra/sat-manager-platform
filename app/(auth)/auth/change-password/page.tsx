"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setServerError(data.error ?? "Could not change password.");
      return;
    }
    setSuccess(true);
    setTimeout(() => router.back(), 900);
  }

  const loading = form.formState.isSubmitting;

  return (
    <PageShell width="narrow" density="comfortable">
      <PageHeader title="Change Password" />
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
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>
            {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
            {success ? <p className="text-sm text-success">Password updated.</p> : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Saving..." : "Save Password"}
            </Button>
          </form>
        </Form>
      </Card>
    </PageShell>
  );
}
