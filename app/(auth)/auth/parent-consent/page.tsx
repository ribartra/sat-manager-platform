"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      queueMicrotask(() => setError("Missing authorization token."));
      return;
    }

    fetch(`/api/auth/parent-consent?token=${token}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setInfo(data);
          setApproved(Boolean(data.approved));
        }
      });
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const response = await fetch("/api/auth/parent-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await response.json();
    setLoading(false);
    if (data.error) setError(data.error);
    else setApproved(true);
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card padding="lg" className="max-w-sm text-center">
          <p className="font-medium text-red-600">{error}</p>
        </Card>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card padding="lg" className="w-full max-w-md">
        <h1 className="mb-2 text-lg font-semibold text-gray-900">Parent Authorization</h1>
        <p className="mb-5 text-sm text-gray-500">
          {info.parentName ?? info.parentEmail}, please authorize this SAT Practice account enrollment.
        </p>
        <div className="mb-5 rounded-md bg-gray-50 p-4 text-sm text-gray-700">
          <p><span className="font-medium">Student:</span> {info.studentName}</p>
          <p><span className="font-medium">Student email:</span> {info.studentEmail}</p>
          <p><span className="font-medium">Parent email:</span> {info.parentEmail}</p>
        </div>
        {approved ? (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Authorization recorded. The student can now activate their account.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-gray-600">
              By authorizing, you confirm that this student may create an account and be associated with the teacher who issued the invitation.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Parent account password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Authorizing..." : "Authorize enrollment"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
