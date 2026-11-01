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
import { formatDate } from "@/lib/utils";

interface ConsentInfo {
  studentName: string;
  studentEmail: string;
  parentName: string | null;
  parentEmail: string;
  approved: boolean;
  isMinor?: boolean;
  studentHasAccount?: boolean;
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
      queueMicrotask(() => setLoadError("This link is incomplete or has expired. Ask the teacher for a new one."));
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4">
      <Card padding="lg" className="w-full max-w-md">
        <h1 className="mb-2 text-lg font-semibold text-foreground">Parent approval</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Hi {info.parentName ?? info.parentEmail}!{" "}
          {info.isMinor
            ? `Because ${info.studentName} is under 18, we need your OK to enroll them.`
            : `${info.studentName}'s teacher asks for your OK. Once you accept, you can also receive their progress reports.`}
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
          <Alert tone="success">
            {info.studentHasAccount
              ? `Thanks! You have authorized ${info.studentName}'s account.`
              : `Thanks! ${info.studentName} can now finish setting up their account.`}
          </Alert>
        ) : info.accountConflict ? (
          <Alert tone="error" title="This email can't be used for a parent account">
            It&apos;s already used by a different kind of account. Ask the teacher to send the invitation to a different
            parent or guardian email.
          </Alert>
        ) : info.existingParent ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{PARENT_CONSENT_STATEMENT}</p>
            <p className="text-sm text-muted-foreground">
              You already have a parent account with this email. Approving adds this student to it — your password stays the
              same.
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
              {linking ? "Approving…" : "Approve"}
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
                      <FormLabel>Create a password for your parent account</FormLabel>
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
                {loading ? "Approving…" : "Approve"}
              </Button>
            </form>
          </Form>
        )}
      </Card>
      <p className="mt-4 max-w-md text-center text-xs text-gray-500">
        By approving, you accept the Terms of Use and the Privacy Policy.
        {info.consentVersion ? ` Terms updated ${formatDate(`${info.consentVersion}T12:00:00`)}.` : ""}
      </p>
      <LegalLinks className="mt-1" />
    </div>
  );
}
