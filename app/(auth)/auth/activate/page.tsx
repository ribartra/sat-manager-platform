"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { Alert, InlineError } from "@/components/sat/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

interface InviteInfo {
  role: string;
  name: string;
  email: string;
  phone?: string;
  startDate?: string | null;
  programName?: string | null;
  isMinor?: boolean;
}

export default function ActivatePage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [serverError, setServerError] = useState("");
  // Consent is recorded as accepting the Terms of Use (with the clause for students under 18).
  // Checked by default (policy 2026-10-22); the student can uncheck it, and then cannot continue.
  const [acceptTerms, setAcceptTerms] = useState(true);

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
    try {
      await apiFetch("/api/auth/activate", { method: "POST", json: { token, password: values.password, acceptTerms } });
    } catch (error) {
      setServerError(errorMessage(error));
      return;
    }
    router.push("/login?activated=1");
  }

  if (tokenError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4">
        <ErrorState
          className="max-w-sm"
          title="This invitation link doesn't work or has expired. Ask your teacher for a new one."
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
  const isTeacher = invite.role === "TEACHER";
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
              ? "Create your parent account to follow your child's progress."
              : isTeacher
                ? "You were invited as a teacher. Choose a password; then you can invite and follow your own students."
                : "Choose a password to finish setting up your account."}
          </p>
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
                        <Input type="password" placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`} {...field} />
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
                      <FormLabel>Type the password again</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Repeat your password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>
              <Alert tone="info">
                <p>
                  <strong>Before you start:</strong> creating your password means you accept the{" "}
                  <Link href="/terms" target="_blank" className="font-medium text-blue-700 underline">Terms of Use</Link> and the{" "}
                  <Link href="/privacy" target="_blank" className="font-medium text-blue-700 underline">Privacy Policy</Link>.
                  {!isParent && invite.isMinor ? (
                    <>
                      {" "}You are under 18, so your parent or guardian must know about and agree to your account (see
                      &quot;Students under 18&quot; in the Terms).
                    </>
                  ) : null}
                </p>
              </Alert>
              <label className="flex items-start gap-2 text-sm text-foreground">
                <Checkbox className="mt-0.5" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required />
                <span>
                  I have read and accept the{" "}
                  <Link href="/terms" target="_blank" className="text-blue-600 underline hover:text-blue-800">Terms of Use</Link> and the{" "}
                  <Link href="/privacy" target="_blank" className="text-blue-600 underline hover:text-blue-800">Privacy Policy</Link>.
                </span>
              </label>
              <InlineError>{serverError}</InlineError>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !acceptTerms}
                disabledReason={!acceptTerms ? "Accept the Terms of Use and the Privacy Policy to continue." : null}
              >
                {loading ? "Setting up…" : isParent ? "Create account" : "Finish setup"}
              </Button>
            </form>
          </Form>
        </Card>
        <LegalLinks className="mt-4" />
      </div>
    </div>
  );
}
