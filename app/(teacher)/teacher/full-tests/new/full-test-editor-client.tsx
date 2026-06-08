"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const modules = ["Reading & Writing Module 1", "Reading & Writing Module 2", "Math Module 1", "Math Module 2"];

export function FullTestEditor({ questions }: { questions: { id: string; label: string; section: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [moduleQuestionIds, setModuleQuestionIds] = useState<string[][]>([[], [], [], []]);
  const [saving, setSaving] = useState(false);

  function addQuestion(moduleIndex: number, questionId: string) {
    if (!questionId) return;
    setModuleQuestionIds((prev) => prev.map((ids, i) => i === moduleIndex && !ids.includes(questionId) ? [...ids, questionId] : ids));
  }

  async function save() {
    setSaving(true);
    await fetch("/api/full-practice-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status, moduleQuestionIds }),
    });
    setSaving(false);
    router.push("/teacher/full-tests");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Practice Test #1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></Select>
      </div>
      {modules.map((module, index) => {
        const section = index >= 2 ? "MATH" : "RW";
        return (
          <div key={module} className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">{module} ({moduleQuestionIds[index].length} questions)</h2>
            <Select value="" onChange={(e) => addQuestion(index, e.target.value)}>
              <option value="">Add question...</option>
              {questions.filter((q) => q.section === section).map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
            </Select>
            <ul className="mt-3 space-y-1 text-xs text-gray-600">
              {moduleQuestionIds[index].map((id) => <li key={id}>{questions.find((q) => q.id === id)?.label}</li>)}
            </ul>
          </div>
        );
      })}
      <Button onClick={save} disabled={saving || !name || moduleQuestionIds.some((ids) => ids.length === 0)}>{saving ? "Saving..." : "Create Full Test"}</Button>
    </div>
  );
}
