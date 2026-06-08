"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ParentsClient({ parents, students }: { parents: { id: string; name: string; email: string; students: string[] }[]; students: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function submit(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/parents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, studentIds: [...selected] }),
    });
    setName("");
    setEmail("");
    setPassword("");
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Create / Update Parent</h2>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Parent name" required />
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" required />
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" required minLength={6} />
        <div className="space-y-1">
          {students.map((student) => (
            <label key={student.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={selected.has(student.id)} onChange={(e) => setSelected((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(student.id); else next.delete(student.id);
                return next;
              })} />
              {student.name}
            </label>
          ))}
        </div>
        <Button type="submit">Save Parent</Button>
      </form>
      <div className="rounded-lg border border-gray-200 bg-white">
        {parents.map((parent) => (
          <div key={parent.id} className="border-b border-gray-100 px-4 py-3 last:border-b-0">
            <p className="text-sm font-medium text-gray-900">{parent.name}</p>
            <p className="text-xs text-gray-500">{parent.email}</p>
            <p className="mt-1 text-xs text-gray-400">Students: {parent.students.join(", ") || "None"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
