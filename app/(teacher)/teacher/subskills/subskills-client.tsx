"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface TopicInfo {
  id: string;
  label: string;
  subskills: { id: string; name: string }[];
}

export function SubskillsClient({ topics }: { topics: TopicInfo[] }) {
  const router = useRouter();
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [name, setName] = useState("");
  const topic = topics.find((t) => t.id === topicId);

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/subskills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, name }),
    });
    setName("");
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/subskills/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Topic</label>
        <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
          {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
        </Select>
        <div className="mt-3 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New subskill name" />
          <Button onClick={create}>Add</Button>
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white">
        {(topic?.subskills ?? []).map((subskill) => (
          <div key={subskill.id} className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0">
            <span className="text-sm text-gray-800">{subskill.name}</span>
            <button onClick={() => remove(subskill.id)} className="text-xs text-red-600 hover:underline">Delete</button>
          </div>
        ))}
        {(!topic || topic.subskills.length === 0) && <div className="p-8 text-center text-sm text-gray-400">No subskills yet.</div>}
      </div>
    </div>
  );
}
