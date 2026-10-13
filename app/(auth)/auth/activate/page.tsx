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
import { Alert, InlineError } from "@/components/sat/alert";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

interface InviteInfo {
  role: string;
  name: string;
  email: string;
  phone?: string;
  startDate?: string | null;
  programName?: string | null;
  requiresParentConsent?: boolean;
  parentConsentApproved?: boolean;
  parentEmail?: string | null;
}

export default function ActivatePage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [serverError, setServerError] = useState("");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [resendError, setResendError] = useState("");

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
      await apiFetch("/api/auth/activate", { method: "POST", json: { token, password: values.password } });
    } catch (error) {
      setServerError(errorMessage(error));
      return;
    }
    router.push("/login?activated=1");
  }

  async function resendToParent() {
    setResendError("");
    setResendState("sending");
    try {
      await apiFetch("/api/auth/parent-consent/resend", { method: "POST", json: { token } });
      setResendState("sent");
    } catch (error) {
      setResendError(errorMessage(error));
      setResendState("idle");
    }
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
              ? "Create your parent account to follow your child's progress."
              : "Choose a password to finish setting up your account."}
          </p>
          {blockedByConsent ? (
            <Alert tone="warning" className="mb-5">
              <p>
                Your parent or guardian needs to authorize your account first.
                {invite.parentEmail ? (
                  <>
                    {" "}We sent an email to <strong>{invite.parentEmail}</strong>.
                  </>
                ) : null}{" "}
                Once they accept, come back to this link to finish setting up.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={resendToParent}
                  disabled={resendState !== "idle"}
                  disabledReason={resendState === "sent" ? "Email sent. Ask your parent to check their inbox (and spam folder)." : null}
                >
                  {resendState === "sending" ? "Sending…" : resendState === "sent" ? "Email sent" : "Resend email to my parent"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => window.location.reload()}>
                  My parent already accepted
                </Button>
              </div>
              <InlineError>{resendError}</InlineError>
            </Alert>
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
              <InlineError>{serverError}</InlineError>
              <Button type="submit" className="w-full" disabled={loading} disabledReason={blockedByConsent ? "Waiting for your parent or guardian to approve." : null}>
                {loading ? "Setting up…" : isParent ? "Create account" : "Finish setup"}
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
