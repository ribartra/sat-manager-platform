"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function InviteStudentPage() {
  const [programs, setPrograms] = useState<{ id: string; name: string; teachers: { teacher: { name: string } }[] }[]>([]);
  const [programId, setProgramId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [parentConsentUrl, setParentConsentUrl] = useState("");
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
    setParentConsentUrl("");
    setLoading(true);
    const res = await fetch("/api/students/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, startDate, programId, parentName, parentEmail, parentPhone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create invite.");
      return;
    }
    setInviteUrl(data.inviteUrl);
    setParentConsentUrl(data.parentConsentUrl ?? "");
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6">
        <Link href="/teacher" className="text-sm text-blue-600 hover:underline">← Students</Link>
        <h1 className="mt-3 text-xl font-semibold text-gray-900">Invite Student</h1>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Program</label>
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
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Parent / guardian authorization</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Parent name</label>
              <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Parent email</label>
              <Input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Parent phone</label>
              <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Invite"}</Button>
      </form>
      {inviteUrl && (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">Invite created</p>
          {parentConsentUrl && (
            <>
              <p className="mt-2 text-xs font-medium text-green-900">Send this authorization link to the parent first:</p>
              <Link href={parentConsentUrl} className="mt-1 block break-all text-sm text-blue-700 underline">
                {parentConsentUrl}
              </Link>
            </>
          )}
          <p className="mt-3 text-xs font-medium text-green-900">Student activation link:</p>
          <Link href={inviteUrl} className="mt-2 block break-all text-sm text-blue-700 underline">
            {inviteUrl}
          </Link>
        </div>
      )}
    </div>
  );
}
