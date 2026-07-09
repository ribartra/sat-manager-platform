"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MathContent } from "@/components/math-content";

const modules = ["Reading & Writing Module 1", "Reading & Writing Module 2", "Math Module 1", "Math Module 2"];
const expectedCounts = [27, 27, 22, 22];

export function FullTestEditor({
  questions,
}: {
  questions: { id: string; label: string; stem: string; difficulty: string; section: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [moduleQuestionIds, setModuleQuestionIds] = useState<string[][]>([[], [], [], []]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  function addQuestion(moduleIndex: number, questionId: string) {
    if (!questionId) return;
    setModuleQuestionIds((prev) => prev.map((ids, i) => i === moduleIndex && !ids.includes(questionId) ? [...ids, questionId] : ids));
  }

  async function save() {
    setSaving(true);
    setErrors([]);
    setWarnings([]);
    const response = await fetch("/api/full-practice-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status, moduleQuestionIds }),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setErrors(data?.errors ?? [data?.error ?? "Unable to create Exam."]);
      setWarnings(data?.warnings ?? []);
      return;
    }
    router.push("/teacher/full-tests");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Exam #1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></Select>
      </div>
      {modules.map((module, index) => {
        const section = index >= 2 ? "MATH" : "RW";
        return (
          <div key={module} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{module}</h2>
              <span className={moduleQuestionIds[index].length === expectedCounts[index] ? "text-xs text-green-700" : "text-xs text-amber-700"}>
                {moduleQuestionIds[index].length}/{expectedCounts[index]} questions
              </span>
            </div>
            <Select value="" onChange={(e) => addQuestion(index, e.target.value)}>
              <option value="">Add question...</option>
              {questions.filter((q) => q.section === section).map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
            </Select>
            <ul className="mt-3 space-y-1 text-xs text-gray-600">
              {moduleQuestionIds[index].map((id) => {
                const question = questions.find((q) => q.id === id);
                if (!question) return null;
                return (
                  <li key={id} className="rounded border border-gray-100 px-2 py-1">
                    <span className="mb-0.5 block text-[10px] font-medium uppercase text-gray-400">
                      {question.section} · {question.difficulty}
                    </span>
                    <MathContent content={question.stem} className="line-clamp-2" />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Warnings</p>
          <ul className="mt-1 list-disc pl-5">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      )}
      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">Fix these issues before saving:</p>
          <ul className="mt-1 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}
      <Button onClick={save} disabled={saving || !name || moduleQuestionIds.some((ids) => ids.length === 0)}>{saving ? "Saving..." : "Create Exam"}</Button>
    </div>
  );
}
