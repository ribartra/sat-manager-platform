"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface StudentEditInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  startDate: string;
  active: boolean;
}

export function EditStudentForm({ student }: { student: StudentEditInfo }) {
  const router = useRouter();
  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email);
  const [phone, setPhone] = useState(student.phone);
  const [startDate, setStartDate] = useState(student.startDate);
  const [active, setActive] = useState(student.active);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch(`/api/students/${student.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, startDate, active }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not update student.");
      return;
    }
    router.push(`/teacher/students/${student.id}`);
    router.refresh();
  }

  return (
    <Card as="form" onSubmit={submit} padding="lg" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
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
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Student"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </Card>
  );
}
