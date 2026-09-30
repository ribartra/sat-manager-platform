"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useRouter } from "next/navigation";
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
import { ErrorState, FormSection, LoadingState } from "@/components/sat";
import { activateSchema, type ActivateInput } from "@/contracts/auth";
import { LegalLinks } from "@/components/legal/legal-page";

interface InviteInfo {
  role: string;
  name: string;
  email: string;
  phone?: string;
  startDate?: string | null;
  programName?: string | null;
  requiresParentConsent?: boolean;
  parentConsentApproved?: boolean;
}

export default function ActivatePage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm<ActivateInput>({
    resolver: zodResolver(activateSchema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    if (!token) {
      queueMicrotask(() => setTokenError(true));
      return;
    }

    fetch(`/api/auth/invite-info?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setTokenError(true);
        else setInvite(d);
      });
  }, [token]);

  async function onSubmit(values: ActivateInput) {
    setServerError("");
    const res = await fetch("/api/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: values.password }),
    });
    const data = await res.json();
    if (data.error) {
      setServerError(data.error);
      return;
    }
    router.push("/login?activated=1");
  }

  if (tokenError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4">
        <ErrorState
          className="max-w-sm"
          title="This invitation link is invalid or has expired."
        />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <LoadingState />
      </div>
    );
  }

  const isParent = invite.role === "PARENT";
  const blockedByConsent = !isParent && invite.requiresParentConsent && !invite.parentConsentApproved;
  const loading = form.formState.isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-sm">
        <Card padding="lg">
          <h1 className="mb-1 text-lg font-semibold text-foreground">
            {isParent ? `Hello, ${invite.name}!` : `Welcome, ${invite.name}!`}
          </h1>
          <p className="mb-5 text-sm text-muted-foreground">
            {isParent
              ? "Create your parent account to follow your child's progress and approve their enrollment."
              : "Set a password to activate your account."}
          </p>
          {blockedByConsent ? (
            <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Parent or guardian authorization is still pending. You can set your password after authorization is
              recorded.
            </div>
          ) : null}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormSection>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input value={invite.email} disabled />
                </div>
                {invite.phone ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Phone</label>
                    <Input value={invite.phone} disabled />
                  </div>
                ) : null}
                {!isParent && invite.startDate ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Start date</label>
                    <Input value={invite.startDate} disabled />
                  </div>
                ) : null}
                {!isParent && invite.programName ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Program</label>
                    <Input value={invite.programName} disabled />
                  </div>
                ) : null}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="At least 6 characters" {...field} />
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
                        <Input type="password" placeholder="Repeat your password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>
              {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
              <Button type="submit" className="w-full" disabled={loading || Boolean(blockedByConsent)}>
                {loading ? "Activating..." : isParent ? "Create Account" : "Activate Account"}
              </Button>
            </form>
          </Form>
        </Card>
        <p className="mt-4 text-center text-xs text-gray-500">By continuing you accept the Terms of Use and the Privacy Policy.</p>
        <LegalLinks className="mt-1" />
      </div>
    </div>
  );
}
