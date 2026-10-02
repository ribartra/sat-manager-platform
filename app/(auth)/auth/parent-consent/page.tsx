"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
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
import { ErrorState, FormSection, LoadingState } from "@/components/sat";
import { parentConsentSchema, type ParentConsentInput } from "@/contracts/auth";
import { LegalLinks } from "@/components/legal/legal-page";
import { Alert, InlineError } from "@/components/sat/alert";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { PARENT_CONSENT_STATEMENT } from "@/lib/consent";

interface ConsentInfo {
  studentName: string;
  studentEmail: string;
  parentName: string | null;
  parentEmail: string;
  approved: boolean;
  existingParent?: boolean;
  accountConflict?: boolean;
  consentVersion?: string;
}

export default function ParentConsentPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [approved, setApproved] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm<ParentConsentInput>({
    resolver: zodResolver(parentConsentSchema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    if (!token) {
      queueMicrotask(() => setLoadError("Missing authorization token."));
      return;
    }

    apiFetch<Parameters<typeof setInfo>[0] & { approved?: boolean }>(`/api/auth/parent-consent?token=${token}`)
      .then((data) => {
        setInfo(data);
        setApproved(Boolean(data?.approved));
      })
      .catch((error) => setLoadError(errorMessage(error)));
  }, [token]);

  async function submitConsent(password?: string) {
    setServerError("");
    try {
      await apiFetch("/api/auth/parent-consent", { method: "POST", json: { token, password } });
    } catch (error) {
      setServerError(errorMessage(error));
      return;
    }
    setApproved(true);
  }

  async function onSubmit(values: ParentConsentInput) {
    await submitConsent(values.password);
  }

  const [linking, setLinking] = useState(false);

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4">
        <ErrorState className="max-w-sm" title={loadError} />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <LoadingState />
      </div>
    );
  }

  const loading = form.formState.isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card padding="lg" className="w-full max-w-md">
        <h1 className="mb-2 text-lg font-semibold text-foreground">Parent Authorization</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          {info.parentName ?? info.parentEmail}, please authorize this SAT Practice account enrollment.
        </p>
        <div className="mb-5 rounded-md bg-muted p-4 text-sm text-foreground">
          <p>
            <span className="font-medium">Student:</span> {info.studentName}
          </p>
          <p>
            <span className="font-medium">Student email:</span> {info.studentEmail}
          </p>
          <p>
            <span className="font-medium">Parent email:</span> {info.parentEmail}
          </p>
        </div>
        {approved ? (
          <Alert tone="success">Authorization recorded. The student can now activate their account.</Alert>
        ) : info.accountConflict ? (
          <Alert tone="error" title="This email cannot be used for a parent account">
            It already belongs to another type of account. Ask the teacher to send the invitation with a different
            parent/guardian email.
          </Alert>
        ) : info.existingParent ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{PARENT_CONSENT_STATEMENT}</p>
            <p className="text-sm text-muted-foreground">
              You already have a parent account with this email. Authorizing links this student to it; your password does
              not change.
            </p>
            <InlineError>{serverError}</InlineError>
            <Button
              className="w-full"
              disabled={linking}
              onClick={async () => {
                setLinking(true);
                await submitConsent();
                setLinking(false);
              }}
            >
              {linking ? "Authorizing..." : "Authorize enrollment"}
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <p className="text-sm text-muted-foreground">{PARENT_CONSENT_STATEMENT}</p>
              <FormSection>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent account password</FormLabel>
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
                      <FormLabel>Confirm password</FormLabel>
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
                {loading ? "Authorizing..." : "Authorize enrollment"}
              </Button>
            </form>
          </Form>
        )}
      </Card>
      <p className="mt-4 text-center text-xs text-gray-500">
        By authorizing you accept the Terms of Use and the Privacy Policy
        {info.consentVersion ? ` (consent text version ${info.consentVersion})` : ""}.
      </p>
      <LegalLinks className="mt-1" />
    </div>
  );
}
