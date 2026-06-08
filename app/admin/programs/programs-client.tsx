"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function ProgramsClient({ teachers }: { teachers: { id: string; name: string; email: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [contractEndsAt, setContractEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    await fetch("/api/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, teacherId, contractEndsAt: contractEndsAt || null }),
    });
    setName("");
    setTeacherId("");
    setContractEndsAt("");
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-[1fr_1fr_180px_auto]">
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Program name" required />
      <Select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} required>
        <option value="">Select teacher</option>
        {teachers.map((teacher) => (
          <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.email}</option>
        ))}
      </Select>
      <Input type="date" value={contractEndsAt} onChange={(event) => setContractEndsAt(event.target.value)} />
      <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
    </form>
  );
}
