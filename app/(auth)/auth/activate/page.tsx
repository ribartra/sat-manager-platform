"use client";

import { useState, FormEvent, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState(false);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    const res = await fetch("/api/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.error) setError(data.error);
    else router.push("/login?activated=1");
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm max-w-sm text-center">
          <p className="text-red-600 font-medium">This invitation link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  const isParent = invite.role === "PARENT";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">
            {isParent ? `Hello, ${invite.name}!` : `Welcome, ${invite.name}!`}
          </h1>
          <p className="text-sm text-gray-500 mb-5">
            {isParent
              ? "Create your parent account to follow your child's progress and approve their enrollment."
              : "Set a password to activate your account."}
          </p>
          {invite.requiresParentConsent && !invite.parentConsentApproved && (
            <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Parent or guardian authorization is still pending. You can set your password after authorization is recorded.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input value={invite.email} disabled />
            </div>
            {invite.phone && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <Input value={invite.phone} disabled />
              </div>
            )}
            {!isParent && invite.startDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <Input value={invite.startDate} disabled />
              </div>
            )}
            {!isParent && invite.programName && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                <Input value={invite.programName} disabled />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || (!isParent && invite.requiresParentConsent && !invite.parentConsentApproved)}
            >
              {loading ? "Activating..." : isParent ? "Create Account" : "Activate Account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
