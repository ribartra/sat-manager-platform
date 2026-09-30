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

interface ConsentInfo {
  studentName: string;
  studentEmail: string;
  parentName: string | null;
  parentEmail: string;
  approved: boolean;
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

    fetch(`/api/auth/parent-consent?token=${token}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else {
          setInfo(data);
          setApproved(Boolean(data.approved));
        }
      });
  }, [token]);

  async function onSubmit(values: ParentConsentInput) {
    setServerError("");
    const response = await fetch("/api/auth/parent-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: values.password }),
    });
    const data = await response.json();
    if (data.error) {
      setServerError(data.error);
      return;
    }
    setApproved(true);
  }

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
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Authorization recorded. The student can now activate their account.
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <p className="text-sm text-muted-foreground">
                By authorizing, you confirm that this student may create an account and be associated with the teacher
                who issued the invitation.
              </p>
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
              {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Authorizing..." : "Authorize enrollment"}
              </Button>
            </form>
          </Form>
        )}
      </Card>
      <p className="mt-4 text-center text-xs text-gray-500">By authorizing you accept the Terms of Use and the Privacy Policy.</p>
      <LegalLinks className="mt-1" />
    </div>
  );
}
