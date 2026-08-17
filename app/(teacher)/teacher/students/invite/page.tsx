"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function InviteStudentPage() {
  const [programs, setPrograms] = useState<{ id: string; name: string; teachers: { teacher: { name: string } }[] }[]>([]);
  const [programId, setProgramId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/programs")
      .then((response) => response.json())
      .then((data) => {
        const nextPrograms = data.programs ?? [];
        setPrograms(nextPrograms);
        if (nextPrograms.length === 1) setProgramId(nextPrograms[0].id);
      });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInviteUrl("");
    setLoading(true);
    const res = await fetch("/api/students/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, startDate, programId, isMinor, parentName, parentEmail, parentPhone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create invite.");
      return;
    }
    setInviteUrl(data.inviteUrl);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6">
        <Link href="/teacher" className="text-sm text-blue-600 hover:underline">← Students</Link>
        <h1 className="mt-3 text-xl font-semibold text-gray-900">Invite Student</h1>
      </div>
      <Card as="form" onSubmit={submit} padding="lg" className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Program</label>
          {programs.length === 1 ? (
            <>
              <input type="hidden" value={programId} />
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {programs[0].name}
              </div>
            </>
          ) : (
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            >
              <option value="">Select a program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name} · {program.teachers.map((pt) => pt.teacher.name).join(", ")}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Start date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div className="border-t border-gray-200 pt-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isMinor}
              onChange={(e) => setIsMinor(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Student is a minor (under 18)</span>
          </label>
          <p className="mt-1 text-xs text-gray-500 ml-6">
            If checked, parent information will be linked when the student accepts the invitation.
          </p>
        </div>

        {isMinor && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-blue-900">Parent / guardian account</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Parent name</label>
              <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Parent email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                required={isMinor}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Parent phone</label>
              <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <Button type="submit" disabled={loading || !programId}>
          {loading ? "Creating..." : "Create Invite"}
        </Button>
      </Card>

      {inviteUrl && (
        <Card variant="success" padding="md" className="mt-5 space-y-4">
          <p className="text-sm font-semibold text-green-900">Invite created</p>

          <div>
            <p className="text-xs font-medium text-green-900">Student activation link:</p>
            <Link href={inviteUrl} className="mt-1 block break-all text-sm text-blue-700 underline">
              {inviteUrl}
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
